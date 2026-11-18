
import { Module } from '@nestjs/common';
import { AuthenticationModule } from '@nestjs/authentication';
import { AuthorizationModule } from '@nestjs/authorization';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    AuthenticationModule.forRootAsync({
      useFactory: () => ({
        accessToken: {
          key: process.env.JWT_SECRET!,
          alg: 'HS256',
          issuer: process.env.JWT_ISSUER,
          audience: process.env.JWT_AUDIENCE,
          ttl: '15m',
        },
      }),
    }),
    AuthorizationModule.forRoot(),
    UsersModule,
    AuthModule,
  ],
})
export class AppModule {}
