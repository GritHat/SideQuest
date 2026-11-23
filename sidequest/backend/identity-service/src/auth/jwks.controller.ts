import { createPublicKey, type JsonWebKey } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Controller, Get, Header } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '@nestjs/authentication';

export interface JwksDocument {
  keys: (JsonWebKey & { kid: string; use: 'sig'; alg: 'RS256' })[];
}

/**
 * Publishes the public half of the access-token signing key (RFC 7517), so the
 * other services verify tokens locally (manifesto §3, §5). Served outside the
 * /api/identity prefix, at /.well-known/jwks.json.
 */
@Public()
@Controller('.well-known')
export class JwksController {
  private readonly document: JwksDocument;

  constructor(config: ConfigService) {
    // Derived from the private key: there is no separate public key to keep in sync.
    const privateKeyPem = readFileSync(config.getOrThrow<string>('JWT_PRIVATE_KEY_FILE'), 'utf8');
    const jwk = createPublicKey(privateKeyPem).export({ format: 'jwk' });
    this.document = {
      keys: [{ ...jwk, kid: config.getOrThrow<string>('JWT_KEY_ID'), use: 'sig', alg: 'RS256' }],
    };
  }

  @Get('jwks.json')
  @Header('Cache-Control', 'public, max-age=300')
  getJwks(): JwksDocument {
    return this.document;
  }
}
