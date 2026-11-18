
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { getJwksSigningKey, jwksKeyId } from './jwks-key.js';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { CredentialsService } from './credentials.service.js';
import { JwtAuth } from './jwt-auth.provider.js';
import { AuthService } from './auth.service.js';


@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        privateKey: getJwksSigningKey(),
        signOptions: {
          algorithm: 'RS256',
          keyid: jwksKeyId,
          ...(process.env.JWT_ISSUER !== undefined && { issuer: process.env.JWT_ISSUER }),
          ...(process.env.JWT_AUDIENCE !== undefined && { audience: process.env.JWT_AUDIENCE }),
          expiresIn: '15m',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [CredentialsService, JwtAuth, AuthService],
})
export class AuthModule {}
