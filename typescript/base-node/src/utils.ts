import fs from "node:fs"
import { Buffer } from "node:buffer"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"

export function bytesToNodeBuffer(bytes: Uint8Array): Buffer {
  return Buffer.from(bytes)
}

export async function writeLinesToFile(
  lines: string[],
  filePath: string
): Promise<void> {
  await pipeline(Readable.from(lines), fs.createWriteStream(filePath))
}
