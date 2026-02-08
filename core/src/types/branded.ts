/**
 * branded types for compile-time safety of domain primitives.
 * prevents accidentally mixing session ids with session codes,
 * raw strings with base64-encoded keys, etc.
 *
 * branded types add zero runtime overhead — they only exist at compile time.
 */

declare const __brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [__brand]: B };

// -- session identifiers --

/** 6-char alphanumeric session code (e.g. "ABC123") */
export type SessionId = Brand<string, "SessionId">;

/** network address in "ip:port" format (e.g. "192.168.1.10:4040") */
export type NetworkAddress = Brand<string, "NetworkAddress">;

// -- cryptographic types --

/** base64-encoded public key */
export type Base64PublicKey = Brand<string, "Base64PublicKey">;

/** base64-encoded ciphertext */
export type Base64Ciphertext = Brand<string, "Base64Ciphertext">;

/** base64-encoded nonce */
export type Base64Nonce = Brand<string, "Base64Nonce">;

/** base64-encoded auth proof */
export type Base64Proof = Brand<string, "Base64Proof">;

// -- protocol types --

/** monotonic sequence number */
export type SequenceNumber = Brand<number, "SequenceNumber">;

// -- type constructors (assertion at boundaries, zero-cost in hot paths) --

export function asSessionId(s: string): SessionId {
  return s as SessionId;
}

export function asNetworkAddress(s: string): NetworkAddress {
  return s as NetworkAddress;
}

export function asBase64PublicKey(s: string): Base64PublicKey {
  return s as Base64PublicKey;
}

export function asBase64Ciphertext(s: string): Base64Ciphertext {
  return s as Base64Ciphertext;
}

export function asBase64Nonce(s: string): Base64Nonce {
  return s as Base64Nonce;
}

export function asBase64Proof(s: string): Base64Proof {
  return s as Base64Proof;
}

export function asSequenceNumber(n: number): SequenceNumber {
  return n as SequenceNumber;
}
