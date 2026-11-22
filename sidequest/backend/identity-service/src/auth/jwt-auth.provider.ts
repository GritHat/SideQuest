
import { type ExecutionContext, Injectable } from '@nestjs/common';
import { AuthenticationRegistry, JwtBearerProvider, type JwtClaims } from '@nestjs/authentication';
import type { Request } from 'express';
import type { User } from '../users/user.js';
import { UsersRepository } from '../users/users.repository.js';

@Injectable()
export class JwtAuth extends JwtBearerProvider<User> {
  constructor(
    private readonly usersRepository: UsersRepository,
    registry: AuthenticationRegistry,
  ) {
    super({ realm: 'identity' });
    registry.registerProvider(this);
  }

  override authenticate(context: ExecutionContext) {
    if (context.getType() === 'http') {
      const req = context.switchToHttp().getRequest<Request>();
      const cookies = req.cookies as Record<string, string | undefined> | undefined;
      if (!req.headers.authorization && cookies?.access_token) {
        req.headers.authorization = `Bearer ${cookies.access_token}`;
      }
    }
    return super.authenticate(context);
  }

  async validate({ sub }: JwtClaims) {
    if (!sub) return null;
    const user = await this.usersRepository.findById(sub);
    return user?.status === 'ACTIVE' ? user : null;
  }
}
