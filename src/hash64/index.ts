const encoder = new TextEncoder();
const MASK_64 = 0xffffffffffffffffn;
const FNV_OFFSET_BASIS_64 = 0xcbf29ce484222325n;
const FNV_PRIME_64 = 0x100000001b3n;

function updateByte(hash: bigint, byte: number): bigint {
  return BigInt.asUintN(64, (hash ^ BigInt(byte)) * FNV_PRIME_64);
}

function updateBytes(hash: bigint, bytes: Uint8Array): bigint {
  for (const byte of bytes) hash = updateByte(hash, byte);
  return hash;
}

/** Hash bytes with 64-bit FNV-1a, without the final mixing step. */
export function hash64FNV1a(value: string | Uint8Array): bigint {
  const bytes = typeof value === "string" ? encoder.encode(value) : value;
  return updateBytes(FNV_OFFSET_BASIS_64, bytes);
}

/** Apply the 64-bit finalizer used by the package's distribution-oriented hashes. */
export function mix64(value: bigint): bigint {
  let hash = BigInt.asUintN(64, value);
  hash ^= hash >> 30n;
  hash = BigInt.asUintN(64, hash * 0xbf58476d1ce4e5b9n);
  hash ^= hash >> 27n;
  hash = BigInt.asUintN(64, hash * 0x94d049bb133111ebn);
  hash ^= hash >> 31n;
  return hash & MASK_64;
}

/** Hash a string or byte array with FNV-1a followed by the shared 64-bit finalizer. */
export function hash64(value: string | Uint8Array): bigint {
  return mix64(hash64FNV1a(value));
}

/** Hash multiple fields with length-prefix framing so concatenated inputs cannot collide structurally. */
export function hash64Parts(...parts: (string | Uint8Array)[]): bigint {
  let hash = FNV_OFFSET_BASIS_64;
  for (const part of parts) {
    const bytes = typeof part === "string" ? encoder.encode(part) : part;
    let length = bytes.length;
    while (length >= 0x80) {
      hash = updateByte(hash, (length & 0x7f) | 0x80);
      length = Math.floor(length / 128);
    }
    hash = updateByte(hash, length);
    hash = updateBytes(hash, bytes);
  }
  return mix64(hash);
}
