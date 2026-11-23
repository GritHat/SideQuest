import { ConflictException } from '@nestjs/common';
import argon2 from 'argon2';

import type { User } from '../users/user.js';
import type { UsersRepository } from '../users/users.repository.js';
import { CredentialsService } from './credentials.service.js';

const PASSWORD = 'Abcdefgh12!x';

function makeUser(overrides: Partial<User> = {}): User {
  return { id: 'u1', username: 'explorer', email: 'explorer@x.it', emailVerified: false, status: 'ACTIVE', roles: ['user'], ...overrides };
}

function fakeRepository(overrides: Partial<Record<keyof UsersRepository, unknown>> = {}) {
  return {
    findByEmail: vi.fn().mockResolvedValue(null),
    findByUsername: vi.fn().mockResolvedValue(null),
    create: vi.fn(async (email: string, { username }: { username: string }) => makeUser({ email, username })),
    findCredentialsByEmail: vi.fn().mockResolvedValue(null),
    updatePasswordHash: vi.fn(),
    ...overrides,
  };
}

describe('CredentialsService.register(username, email, password)', () => {
  it('creates the user with an Argon2id hash, never the plain password', async () => {
    const create = vi.fn(async (email: string, { username }: { username: string }) => makeUser({ email, username }));
    const repo = fakeRepository({ create });
    const user = await new CredentialsService(repo as unknown as UsersRepository).register('explorer', 'explorer@x.it', PASSWORD);

    expect(user.username).toBe('explorer');
    const { passwordHash } = create.mock.calls[0][1] as unknown as { passwordHash: string };
    expect(passwordHash).toMatch(/^\$argon2id\$/);
    expect(passwordHash).not.toContain(PASSWORD);
    expect(await argon2.verify(passwordHash, PASSWORD)).toBe(true);
  });

  it.each([
    ['email already registered', { findByEmail: vi.fn().mockResolvedValue(makeUser()) }],
    ['username already taken', { findByUsername: vi.fn().mockResolvedValue(makeUser()) }],
    ['a concurrent insert hits the unique constraint (P2002)', { create: vi.fn().mockRejectedValue({ code: 'P2002' }) }],
  ])('rejects with 409 when the %s', async (_, overrides) => {
    const repo = fakeRepository(overrides);
    await expect(
      new CredentialsService(repo as unknown as UsersRepository).register('explorer', 'explorer@x.it', PASSWORD),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not hide unexpected repository errors', async () => {
    const repo = fakeRepository({ create: vi.fn().mockRejectedValue(new Error('db down')) });
    await expect(
      new CredentialsService(repo as unknown as UsersRepository).register('explorer', 'explorer@x.it', PASSWORD),
    ).rejects.toThrow('db down');
  });
});

describe('CredentialsService.verify(email, password)', () => {
  let hash: string;
  beforeAll(async () => {
    hash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
  });

  const withAccount = (user: User | null, passwordHash: string | null = hash) =>
    new CredentialsService(
      fakeRepository({
        findCredentialsByEmail: vi.fn().mockResolvedValue(user ? { user, passwordHash } : null),
      }) as unknown as UsersRepository,
    );

  it('returns the user for the right password of an active account', async () => {
    expect(await withAccount(makeUser()).verify('explorer@x.it', PASSWORD)).toMatchObject({ id: 'u1' });
  });

  it.each([
    ['the password is wrong', makeUser(), PASSWORD + 'x'],
    ['the account does not exist (dummy hash is still checked)', null, PASSWORD],
    ['the account is SUSPENDED', makeUser({ status: 'SUSPENDED' }), PASSWORD],
    ['the account is DISABLED', makeUser({ status: 'DISABLED' }), PASSWORD],
  ])('returns null when %s', async (_, user, password) => {
    expect(await withAccount(user).verify('explorer@x.it', password)).toBeNull();
  });

  it('returns null for an account without a password (e.g. created by another sign-in method)', async () => {
    expect(await withAccount(makeUser(), null).verify('explorer@x.it', PASSWORD)).toBeNull();
  });
});
