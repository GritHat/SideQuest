
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
      if (!req.headers.authorization) {
        const sqAccess = extractCookie(req.headers.cookie, 'sq_access');
        if (sqAccess) {
          req.headers.authorization = `Bearer ${sqAccess}`;
        }
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

function extractCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const prefix = `${name}=`;
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      try {
        return decodeURIComponent(trimmed.slice(prefix.length));
      } catch {
        return undefined; // malformed encoding: treat as no token (401), not as a 500
      }
    }
  }
  return undefined;
}
