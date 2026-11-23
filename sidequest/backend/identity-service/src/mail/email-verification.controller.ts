import { BadRequestException, Body, ConflictException, Controller, HttpCode, Post } from '@nestjs/common';
import { CurrentUser, EmailVerificationService, Public } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import { Throttle } from '@nestjs/throttler';

import type { User } from '../users/user.js';
import { verifyEmailSchema, type VerifyEmailDto } from './email-verification.schemas.js';

@Controller('email')
export class EmailVerificationController {
  constructor(private readonly emailVerificationService: EmailVerificationService) {}

  /** Called by the page the link opens, which POSTs the token from its URL. */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('verify')
  @HttpCode(200)
  async verify(@Body({ schema: verifyEmailSchema }) { token }: VerifyEmailDto) {
    const verified = await this.emailVerificationService.verify(token);
    if (!verified) {
      throw new BadRequestException('Invalid or expired link');
    }
    return { email: verified.email, emailVerified: true };
  }

  /** "Send the link again", to the signed-in user's current address. */
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('verification')
  @Can.Anyone()
  @HttpCode(202)
  async resend(@CurrentUser() user: User) {
    if (user.emailVerified) {
      throw new ConflictException('Email address already verified');
    }
    await this.emailVerificationService.send(user);
  }
}
