import { randomBytes } from 'crypto';

export function generateRandomTokenHex(length: number = 32): string {
  return randomBytes(length).toString('hex');
}
