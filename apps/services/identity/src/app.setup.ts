import { BadRequestException, RequestMethod, StandardSchemaValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestApplicationOptions } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';

export const API_PREFIX = 'api/identity';

/** Options for NestFactory.create / createNestApplication: built-in cookie parsing. */
export const APP_OPTIONS: NestApplicationOptions = { cookies: {} };

/**
 * HTTP pipeline shared by main.ts and the integration tests, so tests run the
 * exact production configuration.
 */
export function configureApp(app: NestExpressApplication): NestExpressApplication {
  const config = app.get(ConfigService);

  app.set('trust proxy', config.get<boolean | string[]>('TRUST_PROXY', false));
  app.enableCsrfProtection({ trustedOrigins: config.get<string[]>('TRUSTED_ORIGINS', []) });
  app.useSecurityHeaders();
  app.enableShutdownHooks();
  // The JWKS lives at the well-known path that token verifiers expect.
  app.setGlobalPrefix(API_PREFIX, { exclude: [{ path: '.well-known/jwks.json', method: RequestMethod.GET }] });
  app.useGlobalPipes(
    new StandardSchemaValidationPipe({
      exceptionFactory: (issues) =>
        new BadRequestException({
          message: 'Validation failed',
          errors: issues.map((issue) => ({
            path: (issue.path ?? []).map((p) => (typeof p === 'object' ? String(p.key) : String(p))).join('.'),
            message: issue.message,
          })),
        }),
    }),
  );
  return app;
}
