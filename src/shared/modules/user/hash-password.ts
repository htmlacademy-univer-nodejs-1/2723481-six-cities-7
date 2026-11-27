import {scrypt} from 'node:crypto';
import {promisify} from 'node:util';

const deriveKey = promisify(scrypt);

export async function hashPassword(password: string, salt: string): Promise<Buffer> {
  return deriveKey(password, salt, 64) as Promise<Buffer>;
}
