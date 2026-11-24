import { Injectable } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import argon2 from 'argon2';

const ARGON2_OPTIONS = {
  type: argon2.argon2id as 2,
  raw: false as const,
};

/**
 * @nestjs/authentication's PasswordHasher only supports scrypt parameters and has no custom
 * hasher option, while Identity hashes passwords with Argon2id. Override all three methods
 * together so any library path using PasswordHasher stays consistent.
 */
@Injectable()
export class Argon2PasswordHasherProvider {
  private dummyHash?: Promise<string>;

  constructor(passwordHasher: PasswordHasher) {
    passwordHasher.hash = (password) => argon2.hash(password, ARGON2_OPTIONS);
    passwordHasher.verify = async (password, encoded) => {
      const hash = encoded ?? (await (this.dummyHash ??= argon2.hash('dummy-password-for-timing', ARGON2_OPTIONS)));
      return Boolean(encoded) && (await argon2.verify(hash, password));
    };
    passwordHasher.needsRehash = (encoded) => argon2.needsRehash(encoded);
  }
}
