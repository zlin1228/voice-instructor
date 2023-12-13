import { abort } from "./debug.js"
import { stringToJson } from "./string.js"
import { _base64ToBytes, _bytesToBase64 } from "./_base64.js"

export function bytesToString(bytes: Uint8Array, label = "utf-8"): string {
  const decoder = new TextDecoder(label)
  return decoder.decode(bytes)
}

export function bytesToJsonObject<T>(
  bytes: Uint8Array,
  objectExtractor: (data: unknown) => T
): T {
  const json = bytesToString(bytes)
  const data = stringToJson(json)
  return objectExtractor(data)
}

export function stringToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

export function bytesHavePrefix(
  bytes: Uint8Array,
  prefix: Uint8Array
): boolean {
  if (bytes.length < prefix.length) return false
  for (let i = 0; i < prefix.length; ++i) {
    if (bytes[i] !== prefix[i]) {
      return false
    }
  }
  return true
}

export function bytesHavePostfix(
  bytes: Uint8Array,
  postfix: Uint8Array
): boolean {
  if (bytes.length < postfix.length) return false
  for (let i = 0; i < postfix.length; ++i) {
    if (bytes[bytes.length - postfix.length + i] !== postfix[i]) {
      return false
    }
  }
  return true
}

export function bytesToHex(bytes: Uint8Array): string {
  const hashArray = Array.from(bytes)
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

export function arrayBufferToUint8Array(arrayBuffer: ArrayBuffer): Uint8Array {
  return arrayBuffer instanceof Uint8Array
    ? arrayBuffer
    : new Uint8Array(arrayBuffer)
}

export function bytesToBase64(bytes: Uint8Array): string {
  return _bytesToBase64(bytes)
}

export function base64ToBytes(b64: string): Uint8Array {
  return _base64ToBytes(b64)
}

export function bytesToDataView(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
}

export function bytesToFloat32Array(bytes: Uint8Array): number[] {
  if (bytes.byteLength % 4 !== 0) {
    throw abort(
      `The length of Uint8Array should be a multiple of 4, but got [${bytes.byteLength}]`
    )
  }
  const dataView = bytesToDataView(bytes)
  const values: number[] = []
  for (let i = 0; i < bytes.byteLength; i += 4) {
    values.push(dataView.getFloat32(i, true))
  }
  return values
}
