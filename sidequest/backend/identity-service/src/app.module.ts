
import { Module } from '@nestjs/common';
import { AuthenticationModule } from '@nestjs/authentication';
import { AuthorizationModule } from '@nestjs/authorization';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { readFileSync} from 'node:fs';

@Module({
  imports: [
    AuthenticationModule.forRootAsync({
      useFactory: () => ({
        accessToken: {
          key: readFileSync('keys/private.pem', 'utf8'), //Secret key used to sign the JWT token
          alg: 'RS256', //Algorithm used to sign the JWT token
          kid: 'sidequest-key-1',
          issuer: process.env.JWT_ISSUER, //Issuer of the JWT token
          audience: process.env.JWT_AUDIENCE, //Audience of the JWT token, da cambiare dopo aver deciso il nome della core app.
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
