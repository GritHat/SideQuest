import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import request from 'supertest';
import { inject } from 'vitest';

// Environment first: ConfigModule validates it when AppModule is imported.
const keyDir = mkdtempSync(join(tmpdir(), 'identity-keys-'));
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
writeFileSync(join(keyDir, 'private.pem'), privateKey.export({ type: 'pkcs8', format: 'pem' }));
Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: inject('databaseUrl'),
  JWT_PRIVATE_KEY_FILE: join(keyDir, 'private.pem'),
  JWT_KEY_ID: 'test-key',
  JWT_ISSUER: 'sidequest-identity',
  JWT_AUDIENCE: 'sidequest-api',
  TRUSTED_ORIGINS: 'http://localhost:5173',
  TRUST_PROXY: 'false',
});

const { AppModule } = await import('../src/app.module.js');
const { APP_OPTIONS, configureApp } = await import('../src/app.setup.js');
const { PrismaService } = await import('../src/prisma/prisma.service.js');
const { UsersService } = await import('../src/users/users.service.js');

const PASSWORD = 'Abcdefgh12!x';
let app: NestExpressApplication;
const http = () => request(app.getHttpServer());

/** Cookie name → { value, attributes } from a response's Set-Cookie headers. */
function cookies(res: request.Response) {
  const out: Record<string, { value: string; attrs: string }> = {};
  for (const line of (res.headers['set-cookie'] as unknown as string[] | undefined) ?? []) {
    const [pair, ...attrs] = line.split(';');
    const [name, ...value] = pair.split('=');
    out[name.trim()] = { value: value.join('='), attrs: attrs.join(';') };
  }
  return out;
}
const cookieHeader = (res: request.Response, ...names: string[]) =>
  names.map((n) => `${n}=${cookies(res)[n].value}`).join('; ');

function newAccount() {
  const id = randomUUID().slice(0, 8);
  return { username: `user_${id}`, email: `user_${id}@sidequest.test`, password: PASSWORD };
}
async function registerAndLogin(account = newAccount()) {
  const registered = await http().post('/api/identity/register').send(account).expect(201);
  const login = await http().post('/api/identity/login').send({ email: account.email, password: account.password }).expect(200);
  return { account, id: registered.body.id as string, login };
}

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = configureApp(moduleRef.createNestApplication<NestExpressApplication>(APP_OPTIONS));
  await app.init();
});
afterAll(() => app?.close());
beforeEach(() => {
  // Rate limits are tested on purpose below; the other tests start from a clean counter.
  const storage = app.get(ThrottlerStorage) as unknown as { storage: Map<string, unknown>; hitExpirations?: Map<string, unknown> };
  storage.storage.clear();
  storage.hitExpirations?.clear();
});

describe('registration', () => {
  it('201 with the public profile only: no password, no hash', async () => {
    const res = await http().post('/api/identity/register').send(newAccount()).expect(201);
    expect(res.body).toMatchObject({ roles: ['user'], status: 'ACTIVE' });
    expect(JSON.stringify(res.body)).not.toMatch(/password|hash|argon/i);
  });

  it('409 when the email or the username is already used', async () => {
    const account = newAccount();
    await http().post('/api/identity/register').send(account).expect(201);
    await http().post('/api/identity/register').send({ ...newAccount(), email: account.email }).expect(409);
    await http().post('/api/identity/register').send({ ...newAccount(), username: account.username }).expect(409);
  });

  it('400 problem+json listing the invalid fields, and nothing is created', async () => {
    const res = await http()
      .post('/api/identity/register')
      .send({ username: 'x', email: 'not-an-email', password: 'abc', role: 'ADMIN' })
      .expect(400);
    expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
    expect(res.body).toMatchObject({ type: 'about:blank', title: 'Bad Request', status: 400, instance: '/api/identity/register' });
    expect(res.body.errors.map((e: { path: string }) => e.path)).toEqual(expect.arrayContaining(['username', 'email', 'password']));
    const prisma = app.get(PrismaService);
    expect(await prisma.user.count({ where: { email: 'not-an-email' } })).toBe(0);
  });
});

describe('login, session cookies and access token', () => {
  it('sets HttpOnly SameSite=Strict cookies with the manifesto paths', async () => {
    const { login } = await registerAndLogin();
    const set = cookies(login);
    expect(set.sq_access.attrs).toMatch(/Path=\/api(;|$)/);
    expect(set.sq_refresh.attrs).toMatch(/Path=\/api\/identity(;|$)/);
    for (const c of [set.sq_access, set.sq_refresh]) {
      expect(c.attrs).toMatch(/HttpOnly/i);
      expect(c.attrs).toMatch(/SameSite=Strict/i);
    }
    expect(login.body).toEqual({ ok: true });
  });

  it('issues an RS256 token with kid, iss, aud, sub and roles, and no personal data', async () => {
    const { id, login } = await registerAndLogin();
    const [header, payload] = cookies(login).sq_access.value.split('.').slice(0, 2)
      .map((part) => JSON.parse(Buffer.from(part, 'base64url').toString()));
    expect(header).toMatchObject({ alg: 'RS256', kid: 'test-key' });
    expect(payload).toMatchObject({ sub: id, iss: 'sidequest-identity', aud: 'sidequest-api', roles: ['user'] });
    expect(payload.exp - payload.iat).toBe(600);
    expect(JSON.stringify(payload)).not.toMatch(/@|email|username/);
  });

  it('GET /me with the access cookie returns the profile; without it 401', async () => {
    const { id, login } = await registerAndLogin();
    const me = await http().get('/api/identity/me').set('Cookie', cookieHeader(login, 'sq_access')).expect(200);
    expect(me.body).toMatchObject({ id });
    expect(JSON.stringify(me.body)).not.toMatch(/hash/i);
    await http().get('/api/identity/me').expect(401);
  });

  it('401 for a wrong password and for a suspended account', async () => {
    const { account, id } = await registerAndLogin();
    await http().post('/api/identity/login').send({ email: account.email, password: PASSWORD + 'x' }).expect(401);
    await app.get(UsersService).changeStatus(id, 'SUSPENDED', { id: 'admin', roles: ['admin'] } as never);
    await http().post('/api/identity/login').send({ email: account.email, password: PASSWORD }).expect(401);
  });
});

describe('refresh and logout', () => {
  it('refresh rotates the token; reusing the old one is rejected and revokes the family', async () => {
    const { login } = await registerAndLogin();
    const first = await http().post('/api/identity/refresh').set('Cookie', cookieHeader(login, 'sq_refresh')).expect(200);
    await http().post('/api/identity/refresh').set('Cookie', cookieHeader(login, 'sq_refresh')).expect(401);
    // Reuse means theft: the rotated token of the same family is revoked too.
    await http().post('/api/identity/refresh').set('Cookie', cookieHeader(first, 'sq_refresh')).expect(401);
  });

  it('logout works with the refresh cookie alone, clears both cookies and revokes the session', async () => {
    const { login } = await registerAndLogin();
    const out = await http().post('/api/identity/logout').set('Cookie', cookieHeader(login, 'sq_refresh')).expect(204);
    expect(cookies(out).sq_access.attrs).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect(cookies(out).sq_refresh.attrs).toMatch(/Expires=Thu, 01 Jan 1970/);
    await http().post('/api/identity/refresh').set('Cookie', cookieHeader(login, 'sq_refresh')).expect(401);
  });

  it('logout without any cookie is still 204 (idempotent)', async () => {
    await http().post('/api/identity/logout').expect(204);
  });

  it('refresh is rejected after the account is suspended or deleted', async () => {
    const suspended = await registerAndLogin();
    await app.get(UsersService).changeStatus(suspended.id, 'SUSPENDED', { id: 'admin', roles: ['admin'] } as never);
    await http().post('/api/identity/refresh').set('Cookie', cookieHeader(suspended.login, 'sq_refresh')).expect(401);

    const deleted = await registerAndLogin();
    await http().delete('/api/identity/me').set('Cookie', cookieHeader(deleted.login, 'sq_access')).expect(204);
    await http().post('/api/identity/refresh').set('Cookie', cookieHeader(deleted.login, 'sq_refresh')).expect(401);
  });
});

describe('authorization', () => {
  it('a plain user cannot delete another user (403, nothing deleted); an admin can (204)', async () => {
    const victim = await registerAndLogin();
    const user = await registerAndLogin();
    await http().delete(`/api/identity/admin/users/${victim.id}`).set('Cookie', cookieHeader(user.login, 'sq_access')).expect(403);
    expect(await app.get(PrismaService).user.findUnique({ where: { id: victim.id } })).not.toBeNull();

    const admin = newAccount();
    const created = await http().post('/api/identity/register').send(admin).expect(201);
    await app.get(PrismaService).user.update({ where: { id: created.body.id }, data: { role: 'ADMIN' } });
    const adminLogin = await http().post('/api/identity/login').send({ email: admin.email, password: PASSWORD }).expect(200);
    await http().delete(`/api/identity/admin/users/${victim.id}`).set('Cookie', cookieHeader(adminLogin, 'sq_access')).expect(204);
    expect(await app.get(PrismaService).user.findUnique({ where: { id: victim.id } })).toBeNull();
  });

  it('without a session, protected routes answer 401', async () => {
    await http().delete(`/api/identity/admin/users/${randomUUID()}`).expect(401);
    await http().delete('/api/identity/me').expect(401);
  });
});

describe('cross-cutting protections', () => {
  it('rejects a state-changing request from a foreign origin (CSRF) with 403', async () => {
    const account = newAccount();
    await http()
      .post('/api/identity/register')
      .set('Origin', 'https://evil.example')
      .set('Sec-Fetch-Site', 'cross-site')
      .send(account)
      .expect(403);
  });

  it('accepts the same request from a trusted origin', async () => {
    await http().post('/api/identity/register').set('Origin', 'http://localhost:5173').send(newAccount()).expect(201);
  });

  it('rate-limits login: the sixth attempt within a minute gets 429', async () => {
    const codes: number[] = [];
    for (let i = 0; i < 6; i++) {
      codes.push((await http().post('/api/identity/login').send({ email: 'nobody@sidequest.test', password: 'wrong' })).status);
    }
    expect(codes).toEqual([401, 401, 401, 401, 401, 429]);
  });

  it('health is public', async () => {
    await http().get('/api/identity/health').expect(200, { status: 'ok' });
  });
});
