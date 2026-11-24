import { inject } from 'vitest';
import type { AuthenticationStorage } from '@nestjs/authentication';
import { authenticationStoreContract } from '@nestjs/authentication/testing';
import type { ConfigService } from '@nestjs/config';

import { PrismaService } from '../src/prisma/prisma.service.js';
import { PrismaRefreshTokenStore } from '../src/prisma/prisma.refreshtoken.store.js';

// The library's own contract for refresh-token stores, run against PostgreSQL.
// `concurrent: true` races parallel calls on one token: a read-then-write store fails it.
describe('PrismaRefreshTokenStore (contract)', () => {
  const config = { getOrThrow: () => inject('databaseUrl') } as unknown as ConfigService;
  const prisma = new PrismaService(config);
  const storage = { registerSource: () => undefined } as unknown as AuthenticationStorage;

  beforeAll(() => prisma.$connect());
  afterAll(() => prisma.$disconnect());

  const cases = authenticationStoreContract(
    () => ({ refreshTokens: new PrismaRefreshTokenStore(prisma, storage) }),
    { contracts: ['refreshTokens'], concurrent: true },
  );

  for (const c of cases) {
    it(c.name, () => c.run());
  }
});
