import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module.js';
import { API_PREFIX, APP_OPTIONS, configureApp } from './app.setup.js';
import { buildOpenApiDocument } from './openapi/openapi.js';

async function bootstrap() {
  const app = configureApp(await NestFactory.create<NestExpressApplication>(AppModule, APP_OPTIONS));
  const config = app.get(ConfigService);

  if (config.get<string>('NODE_ENV') === 'development') {
    SwaggerModule.setup(`${API_PREFIX}/docs`, app, buildOpenApiDocument(app));
  }

  await app.listen(config.get<number>('PORT', 3000));
}

void bootstrap();
