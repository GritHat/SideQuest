import { Injectable } from '@nestjs/common';
import {
  AuthenticationStorage,
  type EmailTokenPurpose,
  type EmailTokenRecord,
  type EmailTokenStore,
} from '@nestjs/authentication';

import { PrismaService } from './prisma.service.js';

/** Email-link tokens in PostgreSQL; checked with authenticationStoreContract. */
@Injectable()
export class PrismaEmailTokenStore implements EmailTokenStore {
  constructor(
    private readonly prisma: PrismaService,
    storage: AuthenticationStorage,
  ) {
    storage.registerSource({ emailTokens: this });
  }

  async saveEmailToken(record: EmailTokenRecord): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.emailToken.create({ data: { ...record } }),
      // Keep the table bounded: a link is expired from its expiresAt instant on.
      this.prisma.emailToken.deleteMany({ where: { expiresAt: { lte: record.createdAt } } }),
    ]);
  }

  /** Single use: of concurrent consumers, only the one whose delete succeeds gets the record. */
  async consumeEmailToken(id: string, purpose: EmailTokenPurpose): Promise<EmailTokenRecord | undefined> {
    const row = await this.prisma.emailToken.findFirst({ where: { id, purpose } });
    if (!row) return undefined;
    const { count } = await this.prisma.emailToken.deleteMany({ where: { id, purpose } });
    if (count !== 1) return undefined;
    return {
      id: row.id,
      purpose: row.purpose as EmailTokenPurpose,
      userId: row.userId,
      email: row.email,
      fingerprint: row.fingerprint ?? undefined,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
    };
  }

  async deleteUserEmailTokens(userId: string, purpose: EmailTokenPurpose): Promise<void> {
    await this.prisma.emailToken.deleteMany({ where: { userId, purpose } });
  }
}
