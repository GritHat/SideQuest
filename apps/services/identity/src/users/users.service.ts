import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { TokenService } from '@nestjs/authentication';
import { UserStatus } from '@prisma/client';

import type { User } from './user.js';
import { UsersRepository } from './users.repository.js';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly tokenService: TokenService,
  ) {}

  async deleteUserById(id: string, currentUser: User): Promise<void> {
    if (!currentUser.roles.includes('admin') && currentUser.id !== id) {
      throw new ForbiddenException('You can only delete your own account');
    }

    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.tokenService.revokeAll(id);
    await this.usersRepository.deleteUserById(id);
  }

  async changeStatus(id: string, status: UserStatus, actor: User): Promise<User> {
    if (!actor.roles.includes('admin')) {
      throw new ForbiddenException('Only admins can change user status');
    }

    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.usersRepository.updateStatus(id, status);
    if (status !== UserStatus.ACTIVE) {
      await this.tokenService.revokeAll(id);
    }
    return updated;
  }
}
