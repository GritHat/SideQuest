import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';

import type { User } from './user.js';
import { UsersService } from './users.service.js';
import { UserPolicy } from '../common/policies/user.policy.js';

@Controller('')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @HttpCode(200)
  @Can.Anyone()
  getMe(@CurrentUser() currentUser: User) {
    return currentUser;
  }

  /**
   * Any authenticated user may delete their own account.
   * UserPolicy.delete(user, targetId) verifies ownership;
   * admins are already allowed by the before() hook.
   */
  @Delete('me')
  @HttpCode(204)
  @Can(UserPolicy, 'delete', (ctx) => [ctx.switchToHttp().getRequest<{ user?: User }>().user?.id ?? ''])
  async deleteMe(@CurrentUser() currentUser: User) {
    await this.usersService.deleteUserById(currentUser.id, currentUser);
  }

  /**
   * Admins only: UserPolicy.before() short-circuits to true for the 'admin'
   * role, while manage() returns false for everyone else.
   */
  @Delete('admin/users/:id')
  @HttpCode(204)
  @Can(UserPolicy, 'manage')
  async deleteUserById(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() currentUser: User) {
    await this.usersService.deleteUserById(id, currentUser);
  }
}
