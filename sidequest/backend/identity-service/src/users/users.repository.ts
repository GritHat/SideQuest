import { Injectable } from '@nestjs/common';
import type { Role as PrismaRole, User as PrismaUser } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service.js';
import type { User } from './user.js';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    email: string,
    {
      username,
      passwordHash = null,
      emailVerified = false,
    }: { username?: string; passwordHash?: string | null; emailVerified?: boolean } = {},
  ): Promise<User> {
    if (!username) {
      throw new Error('Username is required');
    }

    const user = await this.prisma.user.create({
      data: {
        username: normalizeUsername(username),
        email: normalizeEmail(email),
        passwordHash,
        emailVerified,
        role: 'USER',
      },
    });

    return toUser(user);
  }

  async findById(id: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? toUser(user) : null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { username: normalizeUsername(username) },
    });

    return user ? toUser(user) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
    });

    return user ? toUser(user) : null;
  }

  /** For password sign-in only. */
  async findCredentialsByEmail(email: string): Promise<{ user: User; passwordHash: string | null } | null> {
    const user = await this.prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
    if (!user) {
      return null;
    }

    return {
      user: toUser(user),
      passwordHash: user.passwordHash,
    };
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });
  }

  async updateEmail(id: string, email: string): Promise<User | null> {
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        email: normalizeEmail(email),
        emailVerified: false,
      },
    });

    return toUser(user);
  }

  async deleteUserById(id: string): Promise<void> {
    if (!(await this.findById(id))) {
      throw new Error(`User with id ${id} not found`);
    }
    await this.prisma.user.delete({ where: { id } });
  }
}


const normalizeEmail = (email: string) => email.trim().normalize('NFC').toLowerCase();
const normalizeUsername = (username: string) => username.trim();

const toUser = ({ id, username, email, emailVerified, role }: PrismaUser): User => ({
  id,
  username,
  email,
  emailVerified,
  roles: [role.toLowerCase() as User['roles'][number]],
});
