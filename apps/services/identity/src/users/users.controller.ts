import { Controller, Delete, Get, HttpCode, Param } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';

import type { User } from './user.js';
import { UsersService } from './users.service.js';
import { Roles } from '../common/guards/roles.guard.js';

@Controller('')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @HttpCode(200)
  @Can.Anyone()
  getMe(@CurrentUser() currentUser: User) {
    return currentUser;
  }

  @Delete('me')
  @HttpCode(204)
  @Can.Anyone()
  async deleteUser(@CurrentUser() currentUser: User) {
    await this.usersService.deleteUserById(currentUser.id, currentUser);
  }

  @Delete('admin/users/:id')
  @Roles(['admin'])
  @HttpCode(204)
  @Can.Anyone()
  async deleteUserById(@Param('id') id: string, @CurrentUser() currentUser: User) {
    await this.usersService.deleteUserById(id, currentUser);
  }
}
