import argon2 from 'argon2';
import { PasswordHasher } from '@nestjs/authentication';
import { vi } from 'vitest';

import { CredentialsService } from '../auth/credentials.service.js';
import type { User } from '../users/user.js';
import {
  PasswordResetMail,
  PasswordResetMailer,
} from './email-password-reset.mailer.js';
import {
  forgotPasswordSchema,
  resetPasswordSchema,
} from './email-password-reset.schemas.js';

const NEW_PASSWORD = 'NewPassword34!y';

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-1',
  username: 'explorer',
  email: 'explorer@sidequest.local',
  emailVerified: false,
  status: 'ACTIVE',
  roles: ['user'],
  ...overrides,
});

describe('password reset schemas', () => {
  it('forgotPasswordSchema accepts only a valid email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'a@b.test' }).success).toBe(
      true,
    );
    expect(
      forgotPasswordSchema.safeParse({ email: 'not-an-email' }).success,
    ).toBe(false);
    expect(
      forgotPasswordSchema.safeParse({ email: 'a@b.test', token: 'x' }).success,
    ).toBe(false);
  });

  it('resetPasswordSchema enforces token and RNF-01 password policy', () => {
    expect(
      resetPasswordSchema.safeParse({ token: 'tok', password: NEW_PASSWORD })
        .success,
    ).toBe(true);
    expect(
      resetPasswordSchema.safeParse({ token: '', password: NEW_PASSWORD })
        .success,
    ).toBe(false);
    expect(
      resetPasswordSchema.safeParse({ token: 'tok', password: 'weakpassword' })
        .success,
    ).toBe(false);
    expect(
      resetPasswordSchema.safeParse({
        token: 'tok',
        password: NEW_PASSWORD,
        email: 'a@b.test',
      }).success,
    ).toBe(false);
  });
});

describe('PasswordResetMailer', () => {
  function setup(
    found: { user: User; passwordHash: string | null } | null = {
      user: makeUser(),
      passwordHash: '$argon2id$old',
    },
  ) {
    const usersRepository = {
      findCredentialsByEmail: vi.fn().mockResolvedValue(found),
      updatePasswordHash: vi.fn().mockResolvedValue(undefined),
    };
    const mailer = { send: vi.fn().mockResolvedValue(undefined) };
    const credentialsService = new CredentialsService(usersRepository as never);
    const passwordHasher = new PasswordHasher({ logN: 10 });
    const registry = { registerHandler: vi.fn() };
    const storage = { registerSource: vi.fn() };

    const handler = new PasswordResetMailer(
      usersRepository as never,
      mailer as never,
      credentialsService,
      passwordHasher,
      registry as never,
      storage as never,
    );

    return {
      handler,
      usersRepository,
      mailer,
      passwordHasher,
      registry,
      storage,
    };
  }

  it('registers itself as the passwordReset handler and delegates PasswordHasher.hash to Argon2id', async () => {
    const { handler, passwordHasher, registry, storage } = setup();
    expect(registry.registerHandler).toHaveBeenCalledWith(
      'passwordReset',
      handler,
    );
    expect(storage.registerSource).toHaveBeenCalledWith({
      sessions: expect.any(Object),
    });

    const hash = await passwordHasher.hash(NEW_PASSWORD);
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await argon2.verify(hash, NEW_PASSWORD)).toBe(true);
  });

  it('returns the account only for ACTIVE users', async () => {
    const active = setup({ user: makeUser(), passwordHash: '$argon2id$old' });
    await expect(
      active.handler.findUser('explorer@sidequest.local'),
    ).resolves.toEqual({
      id: 'user-1',
      email: 'explorer@sidequest.local',
      passwordHash: '$argon2id$old',
    });

    const suspended = setup({
      user: makeUser({ status: 'SUSPENDED' }),
      passwordHash: '$argon2id$old',
    });
    await expect(
      suspended.handler.findUser('explorer@sidequest.local'),
    ).resolves.toBeNull();

    const missing = setup(null);
    await expect(
      missing.handler.findUser('nobody@sidequest.local'),
    ).resolves.toBeNull();
  });

  it('sends reset emails through PasswordResetMail and delegates password updates', async () => {
    const { handler, mailer, usersRepository } = setup();
    const link = {
      userId: 'user-1',
      email: 'explorer@sidequest.local',
      url: 'http://localhost:5173/reset-password?token=abc',
      expiresAt: new Date(),
    };

    await handler.send(link);
    expect(mailer.send).toHaveBeenCalledWith(PasswordResetMail, {
      to: link.email,
      data: link,
    });

    await handler.updatePassword('user-1', '$argon2id$new');
    expect(usersRepository.updatePasswordHash).toHaveBeenCalledWith(
      'user-1',
      '$argon2id$new',
    );
  });
});
