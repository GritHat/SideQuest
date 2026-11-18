
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { readFileSync } from 'node:fs';
import { AuthenticationModule } from '@nestjs/authentication';
import { AuthorizationModule } from '@nestjs/authorization';
import {
  FileTemplateEngine,
  LogMailTransport,
  MailModule,
  SmtpTransport,
} from '@nestjs/mail';
import { join } from 'node:path';

import { AuthModule } from './auth/auth.module.js';
import { JwksModule } from './auth/jwks.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    /*MailModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        transport: new SmtpTransport({
          host: 'smtp.resend.com',
          port: 465,
          secure: true,
          auth: {
            user: 'resend',
            pass: config.getOrThrow<string>('RESEND_API_KEY'),
          },
        }),
        templates: new FileTemplateEngine({
          dir: join(import.meta.dirname, 'mail/templates'),
        }),
        from: config.getOrThrow<string>('MAIL_FROM'),
      }),
    }),*/
    MailModule.forRootAsync({
      useFactory: () => ({
        transport: new SmtpTransport({
          url: process.env.SMTP_URL!,
        }),

        templates: new FileTemplateEngine({
          dir: join(import.meta.dirname, 'mail', 'templates'),
        }),

        from: process.env.SMTP_FROM!,
      }),
    }),

    AuthenticationModule.forRootAsync({
      useFactory: () => ({
        accessToken: {
          key: process.env.JWT_PRIVATE_KEY ?? readFileSync('keys/private.pem', 'utf8'),
          alg: 'RS256',
          kid: 'sidequest-key-1',
          issuer: process.env.JWT_ISSUER, //Issuer of the JWT token
          audience: process.env.JWT_AUDIENCE, //Audience of the JWT token, da cambiare dopo aver deciso il nome della core app.
          ttl: '15m',
        },
        emailVerification: {
          url: process.env.EMAIL_VERIFICATION_URL ?? `${process.env.APP_URL}/verify-email`,
          ttl: '15m',
        },
        allowInMemoryStorage: true,
      }),
    }),

    AuthorizationModule.forRoot(),
    UsersModule,
    AuthModule,
    JwksModule,
  ],
})
export class AppModule {}
