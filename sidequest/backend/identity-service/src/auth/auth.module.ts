
import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { CredentialsService } from './credentials.service.js';
import { TokensController } from './tokens.controller.js';
import { JwtAuth } from './jwt-auth.provider.js';

@Module({
  imports: [UsersModule],
  controllers: [TokensController, AuthController],
  providers: [CredentialsService, JwtAuth],
})
export class AuthModule {}
