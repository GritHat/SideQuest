
import { ConflictException, Injectable } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import type { User } from '../users/user.js';
import { UsersRepository } from '../users/users.repository.js';

@Injectable()
export class CredentialsService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  hashPassword(password: string): Promise<string> {
    return this.passwordHasher.hash(password);
  }

  async register(username: string, email: string, password: string): Promise<User> {
    if (await this.usersRepository.findByEmail(email)) {
      throw new ConflictException('Email already registered');
    }
    if (await this.usersRepository.findByUsername(username)) {
      throw new ConflictException('Username already taken');
    }
    try {
      return await this.usersRepository.create(email, {
        username,
        passwordHash: await this.hashPassword(password),
      });
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') {
        throw new ConflictException('Email or username already registered');
      }
      throw error;
    }
  }

  async verify(email: string, password: string): Promise<User | null> {
    const found = await this.usersRepository.findCredentialsByEmail(email);
    const valid = await this.passwordHasher.verify(password, found?.passwordHash);

    if (!valid || !found?.passwordHash || found.user.status !== 'ACTIVE') {
      return null;
    }

    if (this.passwordHasher.needsRehash(found.passwordHash)) {
      await this.usersRepository.updatePasswordHash(
        found.user.id,
        await this.hashPassword(password),
      );
    }

    return found.user;
  }
}
