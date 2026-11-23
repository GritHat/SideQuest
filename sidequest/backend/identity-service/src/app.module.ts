
import { readFileSync } from 'node:fs';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AuthenticationModule } from '@nestjs/authentication';
import { AuthorizationModule } from '@nestjs/authorization';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module.js';
import { JwksModule } from './auth/jwks.module.js';
import { UsersModule } from './users/users.module.js';
import { PrismaRefreshTokenStore } from './prisma/prisma.refreshtoken.store.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { envSchema } from './config/env.schema.js';
import { HealthController } from './health/health.controller.js';
import { ProblemDetailsFilter } from './common/problem-details.filter.js';


@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    AuthenticationModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        accessToken: {
          key: readFileSync(config.getOrThrow('JWT_PRIVATE_KEY_FILE'), 'utf8'),
          alg: 'RS256',
          kid: config.getOrThrow('JWT_KEY_ID'),
          issuer: config.getOrThrow('JWT_ISSUER'),
          audience: config.getOrThrow('JWT_AUDIENCE'),
          ttl: '10m',
        },
        refreshToken: {
          ttl: '30d',
          absoluteTtl: '90d',
        },
      }),
      inject: [ConfigService],
    }),
    AuthorizationModule.forRoot(),
    PrismaModule,
    UsersModule,
    AuthModule,
    JwksModule,
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => envSchema.parse(config),
    }),
  ],
  providers: [
    PrismaRefreshTokenStore,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
  ],
  controllers: [
    HealthController
  ],
})


export class AppModule {}
