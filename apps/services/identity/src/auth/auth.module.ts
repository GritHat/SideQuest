
import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { CredentialsService } from './credentials.service.js';
import { JwtAuth } from './jwt-auth.provider.js';
import { AuthService } from './auth.service.js';
import { EmailVerificationController } from '../mail/email-verification.controller.js';
import { EmailVerificationMailer, VerifyEmailMail } from '../mail/email-verification.mailer.js';

@Module({
  imports: [UsersModule],
  controllers: [AuthController, EmailVerificationController],
  providers: [CredentialsService, JwtAuth, AuthService, EmailVerificationMailer, VerifyEmailMail],
})
export class AuthModule {}
