import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { EmailVerificationService, TokenService, type TokenPair } from '@nestjs/authentication';
import { CredentialsService } from './credentials.service.js';
import type { SignInDto, SignUpDto } from './auth.schemas.js';
import { User } from '../users/user.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly credentialsService: CredentialsService,
    private readonly tokenService: TokenService,
    private readonly emailVerificationService: EmailVerificationService,
  ) {}

  async signUp(dto: SignUpDto): Promise<User> {
    const user = await this.credentialsService.register(dto.username, dto.email, dto.password);
    try {
      await this.emailVerificationService.send({ id: user.id, email: user.email });
    } catch (error) {
      // The account exists either way; the user can ask for the link again.
      this.logger.warn(`Verification email not sent for user ${user.id}: ${String(error)}`);
    }
    return user;
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
