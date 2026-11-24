import { join } from 'node:path';
import { Injectable } from '@nestjs/common';
import {
  AuthenticationRegistry,
  PasswordResetHandler,
  type PasswordResetLink,
} from '@nestjs/authentication';
import { Mailer, type Mailable } from '@nestjs/mail';
import { UsersRepository } from '../users/users.repository.js';

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
  ) {
    super();
    registry.registerHandler('passwordReset', this);
  }

  async findUser(
    email: string,
  ): Promise<{
    id: string;
    email: string;
    passwordHash: string | null;
  } | null> {
    const found = await this.usersRepository.findCredentialsByEmail(email);
    if (!found || found.user.status !== 'ACTIVE') {
      return null;
    }
    return {
      id: found.user.id,
      email: found.user.email,
      passwordHash: found.passwordHash,
    };
  }

  async send(link: PasswordResetLink): Promise<void> {
    await this.mailer.send(PasswordResetMail, { to: link.email, data: link });
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.usersRepository.updatePasswordHash(userId, passwordHash);
  }
}
