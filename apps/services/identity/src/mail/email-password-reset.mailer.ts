import { join } from 'node:path';
import { Injectable } from '@nestjs/common';
import {
  AuthenticationRegistry,
  AuthenticationStorage,
  PasswordResetHandler,
  type PasswordResetLink,
  type SessionStore,
} from '@nestjs/authentication';
import { Mailer, type Mailable } from '@nestjs/mail';
import { UsersRepository } from '../users/users.repository.js';

// Identity uses stateless JWT access tokens + refresh tokens, never server-side session cookies.
// PasswordResetService still requires the `sessions` contract at boot in production and calls
// `deleteUserSessions` during reset, so we register a no-op store here.
const NOOP_SESSION_STORE: SessionStore = {
  getSession: () => Promise.resolve(undefined),
  createSession: () => Promise.resolve(),
  touchSession: () => Promise.resolve(),
  deleteSession: () => Promise.resolve(false),
  listUserSessions: () => Promise.resolve([]),
  deleteUserSessions: () => Promise.resolve(),
};

@Injectable()
export class PasswordResetMail implements Mailable<PasswordResetLink> {
  render({ url }: PasswordResetLink) {
    return {
      subject: 'Reset your password',
      template: 'password-reset',
      context: { url },
      attachments: [
        {
          filename: 'logo.jpeg',
          path: join(import.meta.dirname, 'assets', 'logo.jpeg'),
          cid: 'logo',
        },
      ],
    };
  }
}

@Injectable()
export class PasswordResetMailer extends PasswordResetHandler {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly mailer: Mailer,
    registry: AuthenticationRegistry,
    storage: AuthenticationStorage,
  ) {
    super();
    registry.registerHandler('passwordReset', this);
    storage.registerSource({ sessions: NOOP_SESSION_STORE });
  }

  async findUser( email: string,): Promise<{ id: string; email: string; passwordHash: string | null } | null> {
    const found = await this.usersRepository.findCredentialsByEmail(email);
    if (!found || found.user.status !== 'ACTIVE') {
      return null;
    }
    return { id: found.user.id,email: found.user.email,passwordHash: found.passwordHash};
  }

  async send(link: PasswordResetLink): Promise<void> {
    await this.mailer.send(PasswordResetMail, { to: link.email, data: link });
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.usersRepository.updatePasswordHash(userId, passwordHash);
  }
}
