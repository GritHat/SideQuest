import { readFileSync } from 'node:fs';

export const jwksKeyId = 'sidequest-key-1';

let signingKey: string | undefined;

export function getJwksSigningKey(): string {
  return (signingKey ??= process.env.JWT_PRIVATE_KEY ?? readFileSync('keys/private.pem', 'utf8'));
}
