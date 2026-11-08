
import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { CredentialsService } from './credentials.service.js';
import { JwtAuth } from './jwt-auth.provider.js';
import { JwksController } from './jwks.controller.js';

@Module({
  imports: [UsersModule],
  controllers: [AuthController, JwksController],
  providers: [CredentialsService, JwtAuth, AuthService],
})
export class AuthModule {}
