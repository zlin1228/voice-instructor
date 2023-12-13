import { webcrypto } from "node:crypto"

import { stringToBytes } from "base-core/lib/data.js"

export async function bytesHash128_221019(
  bytes: Uint8Array
): Promise<Uint8Array> {
  const hashBuffer = await webcrypto.subtle.digest("SHA-256", bytes)
  return new Uint8Array(hashBuffer).slice(0, 128 / 8)
}

export async function jsonHash128_221019(
  normalizedValue: unknown
): Promise<Uint8Array> {
  return await bytesHash128_221019(
    stringToBytes(JSON.stringify(normalizedValue))
  )
}
