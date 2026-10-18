import * as Crypto from 'expo-crypto';

/** UUID strings, so a later cloud sync can adopt local IDs unchanged. */
export function newId(): string {
  const webCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return webCrypto?.randomUUID ? webCrypto.randomUUID() : Crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}
