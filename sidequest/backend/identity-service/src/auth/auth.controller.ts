import { Body, Controller, HttpCode, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { Public } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { signInSchema, signUpSchema, type SignInDto, type SignUpDto } from './auth.schemas.js';
import { AuthService } from './auth.service.js';

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private setAuthCookies(res: Response, tokens: { accessToken: string; refreshToken: string }) {
    res.cookie('access_token', tokens.accessToken, COOKIE_OPTS);
    res.cookie('refresh_token', tokens.refreshToken, COOKIE_OPTS);
  }

  private getRefreshToken(req: Request): string {
    const token = (req.cookies as Record<string, string | undefined> | undefined)?.refresh_token;
    if (!token) {
      throw new UnauthorizedException('Missing refresh token');
    }
    return token;
  }

  @Public()
  @Post('sign-up')
  @HttpCode(201)
  async signUp(@Body({ schema: signUpSchema }) user: SignUpDto) {
    return this.authService.signUp(user);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('sign-in')
  @HttpCode(200)
  async signIn(
    @Body({ schema: signInSchema }) user: SignInDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.setAuthCookies(res, await this.authService.login(user));
    return { ok: true };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.setAuthCookies(res, await this.authService.refresh(this.getRefreshToken(req)));
    return { ok: true };
  }

  @Post('logout')
  @HttpCode(204)
  @Can.Anyone()
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(this.getRefreshToken(req));
    res.clearCookie('access_token', COOKIE_OPTS);
    res.clearCookie('refresh_token', COOKIE_OPTS);
  }
}
