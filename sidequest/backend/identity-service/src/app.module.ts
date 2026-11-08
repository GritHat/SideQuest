
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
          key: process.env.JWT_SECRET!, //Secret key used to sign the JWT token
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
