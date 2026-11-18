
import { Module } from '@nestjs/common';
import { getJwksSigningKey, jwksKeyId } from './auth/jwks-key.js';
import { AuthenticationModule } from '@nestjs/authentication';
import { AuthorizationModule } from '@nestjs/authorization';
import { AuthModule } from './auth/auth.module.js';
import { JwksModule } from './auth/jwks.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    AuthenticationModule.forRootAsync({
      useFactory: () => ({
        accessToken: {
          key: getJwksSigningKey(),
          alg: 'RS256',
          kid: jwksKeyId,
          issuer: process.env.JWT_ISSUER, //Issuer of the JWT token
          audience: process.env.JWT_AUDIENCE, //Audience of the JWT token, da cambiare dopo aver deciso il nome della core app.
          ttl: '15m',
        },
      }),
    }),
    AuthorizationModule.forRoot(),
    UsersModule,
    AuthModule,
    JwksModule,
  ],
})
export class AppModule {}
