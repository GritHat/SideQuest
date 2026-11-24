import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
} from '@nestjs/common';
import { PasswordResetService, Public } from '@nestjs/authentication';
import { Throttle } from '@nestjs/throttler';

import {
  forgotPasswordSchema,
  resetPasswordSchema,
  type ForgotPasswordDto,
  type ResetPasswordDto,
} from './email-password-reset.schemas.js';

@Public()
@Controller('password')
export class PasswordResetController {
  constructor(private readonly passwordResetService: PasswordResetService) {}

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('forgot')
  @HttpCode(202)
  forgot(@Body({ schema: forgotPasswordSchema }) { email }: ForgotPasswordDto) {
    this.passwordResetService.request(email);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('reset')
  @HttpCode(200)
  async reset(
    @Body({ schema: resetPasswordSchema })
    { token, password }: ResetPasswordDto,
  ) {
    const result = await this.passwordResetService.reset(token, password);
    if (!result) {
      throw new BadRequestException('Invalid or expired link');
    }
    return { ok: true };
  }
}
