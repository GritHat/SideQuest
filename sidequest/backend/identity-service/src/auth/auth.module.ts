
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { readFileSync } from 'node:fs';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { CredentialsService } from './credentials.service.js';
import { JwtAuth } from './jwt-auth.provider.js';
import { AuthService } from './auth.service.js';
import { EmailVerificationMailer } from '../mail/email-verification.mailer.js';
import { EmailVerificationController } from '../mail/email-verification.controller.js';


@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        privateKey: process.env.JWT_PRIVATE_KEY ?? readFileSync('keys/private.pem', 'utf8'),
        signOptions: {
          algorithm: 'RS256',
          keyid: 'sidequest-key-1',
          ...({ issuer: process.env.JWT_ISSUER }),
          ...({ audience: process.env.JWT_AUDIENCE }),
          expiresIn: '15m',
        },
      }),
    }),
  ],
  controllers: [AuthController, EmailVerificationController],
  providers: [CredentialsService, JwtAuth, AuthService, EmailVerificationMailer],
})
export class AuthModule {}
