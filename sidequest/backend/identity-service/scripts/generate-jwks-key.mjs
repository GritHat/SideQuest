import { createPublicKey, generateKeyPairSync } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const directory = new URL('../keys/', import.meta.url);
const path = new URL('private.pem', directory);
mkdirSync(directory, { recursive: true, mode: 0o700 });

const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

try {
  writeFileSync(path, privateKey, { flag: 'wx', mode: 0o600 });
  console.log('Created keys/private.pem.');
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log('Using existing keys/private.pem.');
}

const publicKey = createPublicKey(readFileSync(path)).export({ type: 'spki', format: 'pem' });
writeFileSync(new URL('public.pem', directory), publicKey);
