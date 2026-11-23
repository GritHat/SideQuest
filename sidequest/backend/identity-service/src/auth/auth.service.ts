import { Injectable, UnauthorizedException } from '@nestjs/common';
import { TokenService, type TokenPair } from '@nestjs/authentication';
import { CredentialsService } from './credentials.service.js';
import type { SignInDto, SignUpDto } from './auth.schemas.js';
import { User } from '../users/user.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly credentialsService: CredentialsService,
    private readonly tokenService: TokenService,
  ) {}

  async signUp(dto: SignUpDto): Promise<User> {
    return this.credentialsService.register(dto.username, dto.email, dto.password);
  }

  async login(dto: SignInDto): Promise<TokenPair> {
    const user = await this.credentialsService.verify(dto.email, dto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.tokenService.issue(user.id, {
      method: 'password',
      claims: { roles: user.roles },
    });
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    return this.tokenService.refresh(refreshToken);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.tokenService.revoke(refreshToken);
  }
}
