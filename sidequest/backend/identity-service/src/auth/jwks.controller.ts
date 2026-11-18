import {Controller, Get} from '@nestjs/common';
import {Public} from '@nestjs/authentication';
import { createPublicKey } from 'node:crypto';
import { readFileSync } from 'node:fs';

@Public()
@Controller('.well-known')
export class JwksController {
  @Get('jwks.json')
  getJwks() {
    const publicKey = createPublicKey(
      process.env.JWT_PRIVATE_KEY ?? readFileSync('keys/public.pem', 'utf8'),
    );
    const jwk = publicKey.export({ format: 'jwk' });
    return {
      keys: [
        {
          ...jwk,
          kid: 'sidequest-key-1',
          use: 'sig',
          alg: 'RS256',
        },
      ],
    };
  }
}
