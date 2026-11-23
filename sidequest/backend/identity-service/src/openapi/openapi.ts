import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('SideQuest Identity Service')
    .setDescription('Accounts, sessions and access tokens. Errors use RFC 9457 problem+json.')
    .setVersion('1.0')
    .addCookieAuth('sq_access')
    .build();
  return SwaggerModule.createDocument(app, config);
}
