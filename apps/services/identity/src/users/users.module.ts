
import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { UsersController } from './users.controller.js';
import { UsersRepository } from './users.repository.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [UsersController],
  providers: [UsersRepository, UsersService, RolesGuard],
  exports: [UsersRepository, UsersService],
})
export class UsersModule {}
