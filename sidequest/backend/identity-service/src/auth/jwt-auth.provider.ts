
import { Injectable } from '@nestjs/common';
import { AuthenticationRegistry, JwtBearerProvider, type JwtClaims } from '@nestjs/authentication';
import type { User } from '../users/user.js';
import { UsersRepository } from '../users/users.repository.js';

@Injectable()
export class JwtAuth extends JwtBearerProvider<User> {
  constructor(
    private readonly usersRepository: UsersRepository,
    registry: AuthenticationRegistry,
  ) {
    super({ realm: 'store' });
    registry.registerProvider(this);
  }

  validate({ sub }: JwtClaims) {
    return sub ? this.usersRepository.findById(sub) : null;
  }
}
