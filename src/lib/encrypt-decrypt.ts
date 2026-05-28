// encrypt-decrypt.ts

import { AppError } from '@/lib/errors';
import {
  createCipheriv,
  createDecipheriv,
  pbkdf2Sync,
  randomBytes,
} from 'crypto';

const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const IV_LENGTH = 16;
const KEY_LENGTH = 32;
const ALGORITHM = 'aes-256-cbc';

const toUint8Array = (buffer: Buffer): Uint8Array<ArrayBuffer> =>
  buffer as unknown as Uint8Array<ArrayBuffer>;

function getSecretKey(): string {
  const key = process.env.SECRET_KEY;
  if (!key || key.length < 32) {
    throw new AppError('CONFIG_ERROR', {
      cause:
        'SECRET_KEY must be at least 32 characters and match between app and ws server',
    });
  }
  return key;
}

function deriveKey(salt: Buffer): Buffer {
  const secretKey = getSecretKey();
  return pbkdf2Sync(
    secretKey,
    toUint8Array(salt),
    PBKDF2_ITERATIONS,
    KEY_LENGTH,
    'sha256',
  );
}

export function encrypt(text: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = deriveKey(salt);

  const cipher = createCipheriv(ALGORITHM, toUint8Array(key), toUint8Array(iv));
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const combined = Buffer.concat([
    toUint8Array(salt),
    toUint8Array(iv),
    toUint8Array(Buffer.from(encrypted, 'base64')),
  ]);

  return base64UrlEncode(combined);
}

export function decrypt(encryptedText: string): string {
  const combined = base64UrlDecode(encryptedText);

  const salt = combined.subarray(0, SALT_LENGTH);
  const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const encryptedBytes = combined.subarray(SALT_LENGTH + IV_LENGTH);

  const key = deriveKey(salt);

  const decipher = createDecipheriv(
    ALGORITHM,
    toUint8Array(key),
    toUint8Array(iv),
  );
  let decrypted = decipher.update(toUint8Array(encryptedBytes));
  decrypted = Buffer.concat([
    toUint8Array(decrypted),
    toUint8Array(decipher.final()),
  ]);

  return decrypted.toString('utf8');
}

function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(base64urlString: string): Buffer {
  let padded = base64urlString.replace(/-/g, '+').replace(/_/g, '/');
  while (padded.length % 4) {
    padded += '=';
  }
  return Buffer.from(padded, 'base64');
}

if (require.main === module) {
  const originalString =
    'hello websocket! this message travels between app and ws server.';

  try {
    const encrypted = encrypt(originalString);
    console.log('original:', originalString);
    console.log('encrypted:', encrypted);
    console.log("contains ':'?", encrypted.includes(':'));

    const decrypted = decrypt(encrypted);
    console.log('decrypted:', decrypted);
    console.log('success:', originalString === decrypted);
  } catch (error) {
    console.error('error:', error);
  }
}
