
import { ConflictException, Injectable } from '@nestjs/common';
import argon2 from 'argon2';
import type { User } from '../users/user.js';
import { UsersRepository } from '../users/users.repository.js';

const ARGON2_OPTIONS = {
  type: argon2.argon2id as 2,
  raw: false as const,
};

@Injectable()
export class CredentialsService {
  private dummyHashPromise?: Promise<string>;

  constructor(private readonly usersRepository: UsersRepository) {}

  hashPassword(password: string): Promise<string> {
    return argon2.hash(password, ARGON2_OPTIONS);
  }

  private getDummyHash(): Promise<string> {
    if (!this.dummyHashPromise) {
      this.dummyHashPromise = this.hashPassword('dummy-password-for-timing');
    }
    return this.dummyHashPromise;
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
    const hash = found?.passwordHash ?? (await this.getDummyHash());
    const valid = await argon2.verify(hash, password);

    if (!valid || !found?.passwordHash || found.user.status !== 'ACTIVE') {
      return null;
    }

    if (argon2.needsRehash(found.passwordHash)) {
      await this.usersRepository.updatePasswordHash(
        found.user.id,
        await this.hashPassword(password),
      );
    }

    return found.user;
  }
}
