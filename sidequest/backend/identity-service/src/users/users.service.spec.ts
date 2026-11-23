import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { TokenService } from '@nestjs/authentication';
import { UserStatus } from '@prisma/client';

import type { User } from './user.js';
import type { UsersRepository } from './users.repository.js';
import { UsersService } from './users.service.js';

const user = (id: string, roles: User['roles'] = ['user']): User => ({
  id, username: id, email: `${id}@x.it`, emailVerified: false, status: 'ACTIVE', roles,
});
const admin = user('admin', ['admin']);
const alice = user('alice');
const bob = user('bob');

function setup(existing: User[] = [alice, bob, admin]) {
  const repo = {
    findById: vi.fn(async (id: string) => existing.find((u) => u.id === id) ?? null),
    deleteUserById: vi.fn(),
    updateStatus: vi.fn(async (id: string, status: UserStatus) => ({ ...existing.find((u) => u.id === id)!, status })),
  };
  const tokens = { revokeAll: vi.fn() };
  const service = new UsersService(repo as unknown as UsersRepository, tokens as unknown as TokenService);
  return { service, repo, tokens };
}

describe('UsersService.deleteUserById(id, actor)', () => {
  it.each([
    ['an admin deletes another user', 'bob', admin],
    ['a user deletes their own account', 'alice', alice],
  ])('allows it when %s: sessions are revoked before the deletion', async (_, id, actor) => {
    const { service, repo, tokens } = setup();
    await service.deleteUserById(id, actor);
    expect(tokens.revokeAll).toHaveBeenCalledWith(id);
    expect(repo.deleteUserById).toHaveBeenCalledWith(id);
    expect(tokens.revokeAll.mock.invocationCallOrder[0]).toBeLessThan(repo.deleteUserById.mock.invocationCallOrder[0]);
  });

  it('forbids a non-admin from deleting someone else, with no side effects', async () => {
    const { service, repo, tokens } = setup();
    await expect(service.deleteUserById('bob', alice)).rejects.toBeInstanceOf(ForbiddenException);
    expect(tokens.revokeAll).not.toHaveBeenCalled();
    expect(repo.deleteUserById).not.toHaveBeenCalled();
  });

  it('answers 404 for an unknown user, with no side effects', async () => {
    const { service, repo, tokens } = setup();
    await expect(service.deleteUserById('ghost', admin)).rejects.toBeInstanceOf(NotFoundException);
    expect(tokens.revokeAll).not.toHaveBeenCalled();
    expect(repo.deleteUserById).not.toHaveBeenCalled();
  });
});

describe('UsersService.changeStatus(id, status, actor)', () => {
  it.each([UserStatus.SUSPENDED, UserStatus.DISABLED])('revokes every session when an admin sets %s', async (status) => {
    const { service, tokens } = setup();
    expect(await service.changeStatus('bob', status, admin)).toMatchObject({ status });
    expect(tokens.revokeAll).toHaveBeenCalledWith('bob');
  });

  it('does not revoke sessions when an admin re-activates a user', async () => {
    const { service, tokens } = setup();
    await service.changeStatus('bob', UserStatus.ACTIVE, admin);
    expect(tokens.revokeAll).not.toHaveBeenCalled();
  });

  it('forbids non-admins, even on their own account', async () => {
    const { service, repo } = setup();
    await expect(service.changeStatus('alice', UserStatus.ACTIVE, alice)).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.updateStatus).not.toHaveBeenCalled();
  });

  it('answers 404 for an unknown user', async () => {
    const { service } = setup();
    await expect(service.changeStatus('ghost', UserStatus.SUSPENDED, admin)).rejects.toBeInstanceOf(NotFoundException);
  });
});
