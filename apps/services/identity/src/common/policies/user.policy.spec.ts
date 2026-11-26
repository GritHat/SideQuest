import 'reflect-metadata';
import { ForbiddenException, type INestApplication } from '@nestjs/common';
import { AuthorizationModule } from '@nestjs/authorization';
import { Test } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';

import type { User } from '../../users/user.js';
import { UsersController } from '../../users/users.controller.js';
import { UsersService } from '../../users/users.service.js';
import { UserPolicy } from './user.policy.js';

const makeUser = (id: string, roles: User['roles'] = ['user']): User => ({
  id,
  username: id,
  email: `${id}@sidequest.test`,
  emailVerified: true,
  status: 'ACTIVE',
  roles,
});

const ALICE_ID = '11111111-1111-4111-8111-111111111111';
const BOB_ID = '22222222-2222-4222-8222-222222222222';
const ADMIN_ID = '33333333-3333-4333-8333-333333333333';
const MOD_ID = '44444444-4444-4444-8444-444444444444';

describe('UserPolicy', () => {
  const policy = new UserPolicy();
  const alice = makeUser(ALICE_ID, ['user']);
  const mod = makeUser(MOD_ID, ['moderator']);
  const admin = makeUser(ADMIN_ID, ['admin']);

  describe('before()', () => {
    it('short-circuits to true for admin on manage', () => {
      expect(policy.before(admin, 'manage')).toBe(true);
    });

    it.each([['deleteSelf' as const], ['manage' as const]])(
      'returns undefined for non-admin on %s',
      (ability) => {
        expect(policy.before(alice, ability)).toBeUndefined();
      },
    );

    it.each([
      ['unauthenticated caller', null],
      ['plain user', alice],
      ['moderator', mod],
    ])('returns undefined (falls through to ability) for %s', (_, actor) => {
      expect(policy.before(actor, 'manage')).toBeUndefined();
    });
  });

  describe('deleteSelf()', () => {
    it('allows any authenticated user and denies unauthenticated callers', () => {
      expect(policy.deleteSelf(alice)).toBe(true);
      expect(policy.deleteSelf(mod)).toBe(true);
      expect(policy.deleteSelf(admin)).toBe(true);
      expect(policy.deleteSelf(null)).toBe(false);
    });
  });

  describe('manage()', () => {
    it.each([
      ['unauthenticated caller', null],
      ['plain user', alice],
      ['moderator', mod],
    ])('denies %s (only admins pass via before())', (_, actor) => {
      expect(policy.manage(actor)).toBe(false);
    });
  });
});

describe('UsersController authorization wiring', () => {
  let app: INestApplication;
  let currentActor: User | null = null;
  const usersService = {
    deleteUserById: vi.fn(async (id: string, actor: User) => {
      if (!actor.roles.includes('admin') && actor.id !== id) {
        throw new ForbiddenException();
      }
    }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        AuthorizationModule.forRoot({
          getUser: (ctx) =>
            ctx.switchToHttp().getRequest<{ user?: User }>().user ?? null,
        }),
      ],
      controllers: [UsersController],
      providers: [
        UserPolicy,
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    const authStateSymbol = Symbol.for('nestjs.authentication.state');
    app.use(
      (
        req: Request & { user?: User } & Record<symbol, unknown>,
        _res: Response,
        next: NextFunction,
      ) => {
        if (currentActor) {
          req.user = currentActor;
          req[authStateSymbol] = { user: currentActor };
        }
        next();
      },
    );
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    currentActor = null;
    usersService.deleteUserById.mockClear();
  });

  it('GET /me returns the authenticated user', async () => {
    currentActor = makeUser(ALICE_ID);
    const res = await request(app.getHttpServer()).get('/me').expect(200);
    expect(res.body).toMatchObject({ id: ALICE_ID });
  });

  it('DELETE /me allows the authenticated user and denies unauthenticated requests before calling the service', async () => {
    await request(app.getHttpServer()).delete('/me').expect(401);
    expect(usersService.deleteUserById).not.toHaveBeenCalled();

    currentActor = makeUser(ALICE_ID);
    await request(app.getHttpServer()).delete('/me').expect(204);
    expect(usersService.deleteUserById).toHaveBeenCalledWith(
      ALICE_ID,
      currentActor,
    );
  });

  it('DELETE /admin/users/:id allows admin, rejects plain users (even on own id) and moderators, and validates UUID', async () => {
    await request(app.getHttpServer())
      .delete(`/admin/users/${BOB_ID}`)
      .expect(401);

    currentActor = makeUser(ALICE_ID, ['user']);
    await request(app.getHttpServer())
      .delete(`/admin/users/${ALICE_ID}`)
      .expect(403);
    await request(app.getHttpServer())
      .delete(`/admin/users/${BOB_ID}`)
      .expect(403);

    currentActor = makeUser(MOD_ID, ['moderator']);
    await request(app.getHttpServer())
      .delete(`/admin/users/${BOB_ID}`)
      .expect(403);
    expect(usersService.deleteUserById).not.toHaveBeenCalled();

    currentActor = makeUser(ADMIN_ID, ['admin']);
    await request(app.getHttpServer())
      .delete('/admin/users/not-a-uuid')
      .expect(400);
    expect(usersService.deleteUserById).not.toHaveBeenCalled();

    await request(app.getHttpServer())
      .delete(`/admin/users/${BOB_ID}`)
      .expect(204);
    expect(usersService.deleteUserById).toHaveBeenCalledWith(
      BOB_ID,
      currentActor,
    );
  });
});
