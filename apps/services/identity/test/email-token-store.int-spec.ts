import { inject } from 'vitest';
import type { AuthenticationStorage } from '@nestjs/authentication';
import { authenticationStoreContract } from '@nestjs/authentication/testing';
import type { ConfigService } from '@nestjs/config';

import { PrismaService } from '../src/prisma/prisma.service.js';
import { PrismaEmailTokenStore } from '../src/prisma/prisma.email-token.store.js';

// The library's contract for email-link stores: single use, also under concurrency.
describe('PrismaEmailTokenStore (contract)', () => {
  const config = { getOrThrow: () => inject('databaseUrl') } as unknown as ConfigService;
  const prisma = new PrismaService(config);
  const storage = { registerSource: () => undefined } as unknown as AuthenticationStorage;

  beforeAll(() => prisma.$connect());
  afterAll(() => prisma.$disconnect());

  const cases = authenticationStoreContract(
    () => ({ emailTokens: new PrismaEmailTokenStore(prisma, storage) }),
    { contracts: ['emailTokens'], concurrent: true },
  );

  for (const c of cases) {
    it(c.name, () => c.run());
  }
});
