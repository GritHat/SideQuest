import { Injectable } from '@nestjs/common';
import {
  AuthenticationStorage,
  type RefreshTokenRecord,
  type RefreshTokenStore,
} from '@nestjs/authentication';
import { Redis } from 'ioredis';

const DEFAULT_FAMILY_TTL_SECONDS = 60 * 60 * 24 * 30;

@Injectable()
export class RedisRefreshTokenStore implements RefreshTokenStore {
  private readonly redis: Redis;

  constructor(storage: AuthenticationStorage) {
    this.redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
    storage.registerSource({ refreshTokens: this });
  }

  private tokenKey = (id: string) => `rt:${id}`;
  private familyRevokedKey = (familyId: string) => `rt:revoked:${familyId}`;
  private userFamiliesKey = (userId: string) => `rt:user:${userId}`;

  async saveRefreshToken(record: RefreshTokenRecord): Promise<void> {
    const ttlSeconds = Math.max(1, Math.ceil((record.expiresAt.getTime() - Date.now()) / 1000));
    const familyTtl = Math.max(
      1,
      Math.ceil((record.familyExpiresAt.getTime() - Date.now()) / 1000),
    );

    await this.redis
      .multi()
      .set(this.tokenKey(record.id), JSON.stringify(record), 'EX', ttlSeconds)
      .sadd(this.userFamiliesKey(record.userId), record.familyId)
      .expire(this.userFamiliesKey(record.userId), familyTtl)
      .exec();
  }

  async getRefreshToken(id: string): Promise<RefreshTokenRecord | undefined> {
    const raw = await this.redis.get(this.tokenKey(id));
    if (!raw) return undefined;

    const parsed = JSON.parse(raw) as {
      id: string;
      familyId: string;
      userId: string;
      createdAt: string;
      expiresAt: string;
      familyExpiresAt: string;
      usedAt?: string;
      claims?: Record<string, unknown>;
    };

    return {
      ...parsed,
      createdAt: new Date(parsed.createdAt),
      expiresAt: new Date(parsed.expiresAt),
      familyExpiresAt: new Date(parsed.familyExpiresAt),
      usedAt: parsed.usedAt ? new Date(parsed.usedAt) : undefined,
    };
  }

  async markRefreshTokenUsed(id: string, at: Date): Promise<boolean> {
    const record = await this.getRefreshToken(id);
    if (!record || record.usedAt) return false;

    record.usedAt = at;
    const ttlSeconds = Math.max(1, Math.ceil((record.expiresAt.getTime() - Date.now()) / 1000));
    await this.redis.set(this.tokenKey(id), JSON.stringify(record), 'EX', ttlSeconds);
    return true;
  }

  async revokeRefreshTokenFamily(familyId: string): Promise<void> {
    await this.redis.set(
      this.familyRevokedKey(familyId),
      '1',
      'EX',
      DEFAULT_FAMILY_TTL_SECONDS,
    );
  }

  async isRefreshTokenFamilyRevoked(familyId: string): Promise<boolean> {
    return (await this.redis.exists(this.familyRevokedKey(familyId))) === 1;
  }

  async revokeUserRefreshTokens(userId: string): Promise<void> {
    const families = await this.redis.smembers(this.userFamiliesKey(userId));
    if (families.length === 0) return;

    const pipeline = this.redis.multi();
    for (const familyId of families) {
      pipeline.set(
        this.familyRevokedKey(familyId),
        '1',
        'EX',
        DEFAULT_FAMILY_TTL_SECONDS,
      );
    }
    pipeline.del(this.userFamiliesKey(userId));
    await pipeline.exec();
  }
}
