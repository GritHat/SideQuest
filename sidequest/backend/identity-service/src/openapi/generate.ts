/**
 * Writes openapi.json without a database or keys: the app is created in
 * preview mode, so no provider is instantiated. Run with `npm run openapi:generate`.
 */
import { writeFileSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { RequestMethod } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';

const placeholders: Record<string, string> = {
  DATABASE_URL: 'postgresql://openapi:openapi@localhost:5432/openapi',
  JWT_KEY_ID: 'openapi',
  JWT_ISSUER: 'openapi',
  JWT_AUDIENCE: 'openapi',
};
for (const [key, value] of Object.entries(placeholders)) {
  process.env[key] ??= value;
}

const { AppModule } = await import('../app.module.js');
const { API_PREFIX, APP_OPTIONS } = await import('../app.setup.js');
const { buildOpenApiDocument } = await import('./openapi.js');

const app = await NestFactory.create<NestExpressApplication>(AppModule, { ...APP_OPTIONS, preview: true, logger: false });
app.setGlobalPrefix(API_PREFIX, { exclude: [{ path: '.well-known/jwks.json', method: RequestMethod.GET }] });
writeFileSync('openapi.json', `${JSON.stringify(buildOpenApiDocument(app), null, 2)}\n`);
await app.close();
console.log('openapi.json written');
