import { execFileSync } from 'node:child_process';
import type { TestProject } from 'vitest/node';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

/**
 * Provides a migrated PostgreSQL database to the integration tests.
 * Uses TEST_DATABASE_URL when set (e.g. a CI service or a local instance),
 * otherwise starts a disposable container with Testcontainers.
 * Migrations are applied with `migrate deploy` (never destructive): tests use unique data.
 */
export default async function setup(project: TestProject) {
  let container: StartedPostgreSqlContainer | undefined;
  let databaseUrl = process.env.TEST_DATABASE_URL;

  if (!databaseUrl) {
    container = await new PostgreSqlContainer(process.env.TEST_POSTGRES_IMAGE ?? 'postgres:17-alpine').start();
    databaseUrl = container.getConnectionUri();
  }

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });

  project.provide('databaseUrl', databaseUrl);

  return async () => {
    await container?.stop();
  };
}
