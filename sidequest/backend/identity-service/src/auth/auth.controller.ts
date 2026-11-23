import { Body, Controller, Cookies, HttpCode, Post, Res, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { signInSchema, signUpSchema, type SignInDto, type SignUpDto } from './auth.schemas.js';
import { AuthService } from './auth.service.js';

@Controller('')
export class AuthController {
  private readonly accessCookieOpts: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'strict';
    path: string;
    maxAge: number;
  };
  private readonly refreshCookieOpts: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'strict';
    path: string;
    maxAge: number;
  };

  constructor(
    private readonly authService: AuthService,
    config: ConfigService,
  ) {
    const baseOpts = {
      httpOnly: true,
      secure: config.get<string>('NODE_ENV') === 'production',
      sameSite: 'strict' as const,
    };
    this.accessCookieOpts = {
      ...baseOpts,
      path: '/api',
      maxAge: 10 * 60 * 1000,
    };
    this.refreshCookieOpts = {
      ...baseOpts,
      path: '/api/identity',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    };
  }

  private setAuthCookies(res: Response, tokens: { accessToken: string; refreshToken: string }) {
    res.cookie('sq_access', tokens.accessToken, this.accessCookieOpts);
    res.cookie('sq_refresh', tokens.refreshToken, this.refreshCookieOpts);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('register')
  @HttpCode(201)
  async signUp(@Body({ schema: signUpSchema }) user: SignUpDto) {
    return this.authService.signUp(user);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  async signIn(
    @Body({ schema: signInSchema }) user: SignInDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.setAuthCookies(res, await this.authService.login(user));
    return { ok: true };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Cookies('sq_refresh') refreshToken: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!refreshToken) {
      throw new UnauthorizedException('Missing refresh token');
    }
    this.setAuthCookies(res, await this.authService.refresh(refreshToken));
    return { ok: true };
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  @Can.Anyone()
  async logout(
    @Cookies('sq_refresh') refreshToken: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (refreshToken) {
      try {
        await this.authService.logout(refreshToken);
      } catch {
        // Ignore revocation errors on logout
      }
    }
    res.clearCookie('sq_access', this.accessCookieOpts);
    res.clearCookie('sq_refresh', this.refreshCookieOpts);
  }
}
