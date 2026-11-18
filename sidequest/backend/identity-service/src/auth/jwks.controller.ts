import {Controller, Get} from '@nestjs/common';
import {Public} from '@nestjs/authentication';
import { createPublicKey } from 'node:crypto';
import { getJwksSigningKey, jwksKeyId } from './jwks-key.js';

@Public()
@Controller('.well-known')
export class JwksController {
  @Get('jwks.json')
  getJwks() {
    const jwk = createPublicKey(getJwksSigningKey()).export({ format: 'jwk' });
    return {
      keys: [
        {
          ...jwk,
          kid: jwksKeyId,
          use: 'sig',
          alg: 'RS256',
        },
      ],
    };
  }
}
