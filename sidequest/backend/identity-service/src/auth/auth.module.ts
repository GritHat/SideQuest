
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {EmailVerificationService,EmailVerificationHandler} from '@nestjs/authentication';
import { PrismaModule } from '../prisma/prisma.module.js';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { CredentialsService } from './credentials.service.js';
import { JwtAuth } from './jwt-auth.provider.js';
import { EmailVerificationMailer } from '../mail/email-verification.mailer.js';
import { EmailVerificationController } from '../mail/email-verification.controller.js';

@Module({
  imports: [
    UsersModule,
    ConfigModule,
    PrismaModule,
  ],
  controllers: [AuthController, EmailVerificationController],
  providers: [
    AuthService,
    CredentialsService,
    JwtAuth,
    EmailVerificationMailer
  ],
})
export class AuthModule {}
