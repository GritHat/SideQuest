import { generateKeyPairSync } from 'node:crypto';
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const keysDir = join(process.cwd(), 'keys');
mkdirSync(keysDir, { recursive: true });

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem',
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem',
  },
});

const privateKeyPath = join(keysDir, 'private.pem');
const publicKeyPath = join(keysDir, 'public.pem');

writeFileSync(privateKeyPath, privateKey, { mode: 0o600 });
chmodSync(privateKeyPath, 0o600);
writeFileSync(publicKeyPath, publicKey, { mode: 0o644 });

console.log('Generated RSA key pair in keys/private.pem (0600) and keys/public.pem');
