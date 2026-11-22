
import { readFileSync } from 'node:fs';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthenticationModule } from '@nestjs/authentication';
import { AuthorizationModule } from '@nestjs/authorization';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module.js';
import { RedisRefreshTokenStore } from './auth/redis-refresh-token.store.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }]),
    AuthenticationModule.forRootAsync({
      useFactory: () => ({
        accessToken: {
          key: process.env.JWT_PRIVATE_KEY ?? readFileSync('keys/private.pem', 'utf8'),
          alg: 'RS256',
          issuer: process.env.JWT_ISSUER || undefined,
          audience: process.env.JWT_AUDIENCE || undefined,
          ttl: '15m',
        },
      }),
    }),
    AuthorizationModule.forRoot(),
    UsersModule,
    AuthModule,
  ],
  providers: [
    RedisRefreshTokenStore,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
