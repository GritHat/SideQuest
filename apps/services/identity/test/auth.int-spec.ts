import { createPublicKey, generateKeyPairSync, randomUUID, verify } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AuthenticationEvents } from '@nestjs/authentication';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { InMemoryMailTransport, MailTransport, type MailMessage } from '@nestjs/mail';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import { filter, firstValueFrom } from 'rxjs';
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
/**
 * The in-memory mailbox, plus `nextSend()`: a promise that resolves once the transport has handled
 * the next mail (sent or failed). Some mails leave in the background (password reset), so the
 * tests wait for this signal instead of sleeping. Call it BEFORE the request that sends the mail.
 */
class AwaitableMailbox extends InMemoryMailTransport {
  readonly #waiters: Array<() => void> = [];
  override async send(message: MailMessage) {
    try {
      return await super.send(message);
    } finally {
      for (const resolve of this.#waiters.splice(0)) resolve();
    }
  }
  nextSend(): Promise<void> {
    return new Promise((resolve) => this.#waiters.push(resolve));
  }
}
const mailbox = new AwaitableMailbox();
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
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MailTransport)
    .useValue(mailbox)
    .compile();
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

describe('JWKS', () => {
  it('publishes only the public key, with kid and alg, outside the /api/identity prefix', async () => {
    const res = await http().get('/.well-known/jwks.json').expect(200);
    expect(res.headers['cache-control']).toBe('public, max-age=300');
    expect(res.body.keys).toHaveLength(1);
    const [key] = res.body.keys;
    expect(key).toMatchObject({ kty: 'RSA', kid: 'test-key', use: 'sig', alg: 'RS256' });
    for (const privatePart of ['d', 'p', 'q', 'dp', 'dq', 'qi']) {
      expect(key).not.toHaveProperty(privatePart);
    }
    await http().get('/api/identity/.well-known/jwks.json').expect(404);
  });

  it('verifies the signature of an access token issued by login, as the other services will', async () => {
    const { login } = await registerAndLogin();
    const token = cookies(login).sq_access.value;
    const [header, payload, signature] = token.split('.');
    const { keys } = (await http().get('/.well-known/jwks.json').expect(200)).body;
    const jwk = keys.find((k: { kid: string }) => k.kid === JSON.parse(Buffer.from(header, 'base64url').toString()).kid);

    const publicKey = createPublicKey({ key: jwk, format: 'jwk' });
    const signed = Buffer.from(`${header}.${payload}`);
    expect(verify('RSA-SHA256', signed, publicKey, Buffer.from(signature, 'base64url'))).toBe(true);
    // A tampered payload must not verify.
    const forged = Buffer.from(`${header}.${Buffer.from('{"sub":"admin","roles":["admin"]}').toString('base64url')}`);
    expect(verify('RSA-SHA256', forged, publicKey, Buffer.from(signature, 'base64url'))).toBe(false);
  });
});

describe('email verification', () => {
  const tokenFor = (email: string) =>
    mailbox.assertSent({ to: email }).link(/verify-email/).searchParams.get('token') ?? '';

  it('registration sends a single-use link that verifies the address', async () => {
    const { account, login } = await registerAndLogin();
    const sent = mailbox.assertSent({ to: account.email });
    expect(sent.subject).toMatch(/SideQuest/);
    expect(sent.link(/verify-email/).origin).toBe('http://localhost:5173');

    const token = tokenFor(account.email);
    const verified = await http().post('/api/identity/email/verify').send({ token }).expect(200);
    expect(verified.body).toEqual({ email: account.email, emailVerified: true });

    // Single use.
    await http().post('/api/identity/email/verify').send({ token }).expect(400);

    // The profile reflects it (a fresh token loads the user again).
    const relogin = await http().post('/api/identity/login').send({ email: account.email, password: PASSWORD }).expect(200);
    const me = await http().get('/api/identity/me').set('Cookie', cookieHeader(relogin, 'sq_access')).expect(200);
    expect(me.body.emailVerified).toBe(true);
    void login;
  });

  it('rejects unknown tokens (400 problem+json) and malformed bodies (400)', async () => {
    const res = await http().post('/api/identity/email/verify').send({ token: 'not-a-real-token' }).expect(400);
    expect(res.headers['content-type']).toMatch(/problem\+json/);
    await http().post('/api/identity/email/verify').send({}).expect(400);
  });

  it('resend: 202 with a new link when unverified, 409 once verified, 401 without a session', async () => {
    const { account, login } = await registerAndLogin();
    mailbox.clear();
    await http().post('/api/identity/email/verification').set('Cookie', cookieHeader(login, 'sq_access')).expect(202);
    const token = tokenFor(account.email);
    await http().post('/api/identity/email/verify').send({ token }).expect(200);

    const relogin = await http().post('/api/identity/login').send({ email: account.email, password: PASSWORD }).expect(200);
    await http().post('/api/identity/email/verification').set('Cookie', cookieHeader(relogin, 'sq_access')).expect(409);
    await http().post('/api/identity/email/verification').expect(401);
  });
});

describe('password reset', () => {
  const NEW_PASSWORD = 'NewPassword99!z';
  const prisma = () => app.get(PrismaService);
  const forgot = (body: object) => http().post('/api/identity/password/forgot').send(body);
  const reset = (token: string, password = NEW_PASSWORD) =>
    http().post('/api/identity/password/reset').send({ token, password });

  /**
   * Resolves when the background lookup for `email` is over. For an unknown or non-ACTIVE
   * account it is the last thing the library does, so afterwards no mail can still leave.
   * Call it BEFORE the request.
   */
  function resetRequested(email: string) {
    return firstValueFrom(
      app
        .get(AuthenticationEvents)
        .events$.pipe(filter((e) => e.type === 'password-reset-requested' && e.email === email.toLowerCase())),
    );
  }

  /** Asks for a link and returns its token, waiting for the mail instead of sleeping. */
  async function requestResetToken(email: string) {
    const sent = mailbox.nextSend();
    await forgot({ email }).expect(202);
    await sent;
    return mailbox.assertSent({ to: email }).link(/reset-password/).searchParams.get('token') ?? '';
  }

  beforeEach(() => mailbox.clear());

  describe('POST /password/forgot', () => {
    it('202 with no body; the link goes to PASSWORD_RESET_URL at the address stored for the account', async () => {
      const { account } = await registerAndLogin();
      mailbox.clear();

      const sent = mailbox.nextSend();
      const res = await forgot({ email: account.email.toUpperCase() }).expect(202);
      expect(res.text).toBe('');
      await sent;

      const link = mailbox.assertSent({ to: account.email }).link(/reset-password/);
      expect(`${link.origin}${link.pathname}`).toBe('http://localhost:5173/reset-password');
      expect(link.searchParams.get('token')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    });

    it('the same 202 for an unknown address and for a suspended account, and no mail is sent', async () => {
      const unknown = 'nobody@sidequest.test';
      const done = resetRequested(unknown);
      await forgot({ email: unknown }).expect(202);
      await done;
      mailbox.assertNotSent({ to: unknown });

      const { account, id } = await registerAndLogin();
      await prisma().user.update({ where: { id }, data: { status: 'SUSPENDED' } });
      mailbox.clear();
      const suspendedDone = resetRequested(account.email);
      await forgot({ email: account.email }).expect(202);
      await suspendedDone;
      mailbox.assertNotSent({ to: account.email });
    });

    it('400 problem+json for an invalid address or unknown fields', async () => {
      const invalid = await forgot({ email: 'not-an-email' }).expect(400);
      expect(invalid.headers['content-type']).toMatch(/problem\+json/);
      await forgot({ email: 'a@sidequest.test', role: 'admin' }).expect(400);
    });

    it('answers 202 even when the mail server fails, and the next request works', async () => {
      const { account } = await registerAndLogin();
      mailbox.clear();

      mailbox.failNext(new Error('SMTP down'));
      const failed = mailbox.nextSend();
      await forgot({ email: account.email }).expect(202);
      await failed;
      mailbox.assertNotSent({ to: account.email });

      expect(await requestResetToken(account.email)).toMatch(/^[A-Za-z0-9_-]{43}$/);
    });

    it('rate limit: the fourth request within a minute gets 429', async () => {
      const codes: number[] = [];
      for (let i = 0; i < 4; i++) {
        codes.push((await forgot({ email: `probe_${i}@sidequest.test` })).status);
      }
      expect(codes).toEqual([202, 202, 202, 429]);
    });
  });

  describe('POST /password/reset', () => {
    it('stores an Argon2id hash, signs out every session and marks the address verified', async () => {
      const { account, id, login } = await registerAndLogin();
      const token = await requestResetToken(account.email);

      const res = await reset(token).expect(200);
      expect(res.body).toEqual({ ok: true });

      const row = await prisma().user.findUniqueOrThrow({ where: { id } });
      expect(row.passwordHash).toMatch(/^\$argon2id\$/);
      expect(row.emailVerified).toBe(true);

      // The old refresh token is revoked, the old password no longer works, the new one does.
      await http().post('/api/identity/refresh').set('Cookie', cookieHeader(login, 'sq_refresh')).expect(401);
      await http().post('/api/identity/login').send({ email: account.email, password: PASSWORD }).expect(401);
      await http().post('/api/identity/login').send({ email: account.email, password: NEW_PASSWORD }).expect(200);
    });

    it('a link works only once', async () => {
      const { account } = await registerAndLogin();
      const token = await requestResetToken(account.email);

      await reset(token).expect(200);
      const reused = await reset(token, 'AnotherPass88!w').expect(400);
      expect(reused.headers['content-type']).toMatch(/problem\+json/);
      await http().post('/api/identity/login').send({ email: account.email, password: NEW_PASSWORD }).expect(200);
    });

    it('a weak password gets 400 and does not burn the link', async () => {
      const { account } = await registerAndLogin();
      const token = await requestResetToken(account.email);

      const weak = await reset(token, 'weakpassword').expect(400);
      expect(weak.headers['content-type']).toMatch(/problem\+json/);
      await reset(token).expect(200);
    });

    it('400 for an unknown token and for an expired one', async () => {
      await reset('a'.repeat(43)).expect(400);

      const { account, id } = await registerAndLogin();
      const token = await requestResetToken(account.email);
      // Instead of waiting an hour, move the expiry into the past in the database.
      await prisma().emailToken.updateMany({
        where: { userId: id, purpose: 'password-reset' },
        data: { expiresAt: new Date(Date.now() - 1_000) },
      });
      await reset(token).expect(400);
    });

    it('after a reset, the other links sent to the same account stop working', async () => {
      const { account } = await registerAndLogin();
      const first = await requestResetToken(account.email);
      const second = await requestResetToken(account.email);
      expect(second).not.toBe(first);

      await reset(second).expect(200);
      await reset(first, 'AnotherPass88!w').expect(400);
    });

    it('a link stops working if the account is suspended in the meantime', async () => {
      const { account, id } = await registerAndLogin();
      const token = await requestResetToken(account.email);
      await prisma().user.update({ where: { id }, data: { status: 'SUSPENDED' } });

      await reset(token).expect(400);
      const row = await prisma().user.findUniqueOrThrow({ where: { id } });
      expect(row.passwordHash).not.toBeNull();
      await prisma().user.update({ where: { id }, data: { status: 'ACTIVE' } });
      await http().post('/api/identity/login').send({ email: account.email, password: PASSWORD }).expect(200);
    });
  });
});
