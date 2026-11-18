
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
          dir: join(process.cwd(), 'src/mail/templates'),
        }),

        from: process.env.SMTP_FROM!,
      }),
    }),

    AuthenticationModule.forRootAsync({
      useFactory: () => ({
        accessToken: {
          key: process.env.JWT_SECRET!,
          issuer: process.env.JWT_ISSUER,
          audience: process.env.JWT_AUDIENCE,
          ttl: '15m',
        },
        emailVerification: { 
          url: `${process.env.APP_URL}/verify-email`,
          ttl: '1h'
        },
        allowInMemoryStorage: true,
      }),
    }),

    AuthorizationModule.forRoot(),
    UsersModule,
    AuthModule,
  ],
})
export class AppModule {}
