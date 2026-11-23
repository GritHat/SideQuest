import { writeFileSync } from 'node:fs';
import { StandardSchemaValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module.js';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cookies: {}
  });
  const config = app.get(ConfigService)
  const trustedOrigins = config.get('TRUSTED_ORIGINS', []);
  app.set('trust proxy', config.get<boolean | string[]>('TRUST_PROXY', false));
  
  app.enableCsrfProtection({trustedOrigins: trustedOrigins});
  app.useSecurityHeaders();
  app.enableShutdownHooks();
  app.setGlobalPrefix('api/identity');
  app.useGlobalPipes(new StandardSchemaValidationPipe());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Identity Service')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  writeFileSync('openapi.json', JSON.stringify(document, null, 2));

  if (config.get<string>('NODE_ENV') === 'development') {
    SwaggerModule.setup('api/identity/docs', app, document);
  }

  await app.listen(
    config.get('PORT', 3000)
  );
}

void bootstrap();