import { Controller, Delete, HttpCode, Param } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';

import type { User } from './user.js';
import { UsersService } from './users.service.js';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Delete(':id')
  @HttpCode(204)
  @Can.Anyone()
  async deleteUser(@Param('id') id: string, @CurrentUser() currentUser: User) {
    await this.usersService.deleteUserById(id, currentUser);
  }
}
