import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import type { User } from './user.js';
import { UsersRepository } from './users.repository.js';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async deleteUserById(id: string, currentUser: User): Promise<void> {
    if (!currentUser.roles.includes('admin') && currentUser.id !== id) {
      throw new ForbiddenException('You can only delete your own account');
    }

    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.usersRepository.deleteUserById(id);
  }
}
