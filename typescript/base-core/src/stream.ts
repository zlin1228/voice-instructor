import { asyncIterableToArray } from "./concurrency.js"
import { abortIfUndefined } from "./debug.js"
import { stringToJson } from "./string.js"

export type BytesReadable = ReadableStream<Uint8Array>
export type BytesWritable = WritableStream<Uint8Array>

export function asyncIterableToReadable<T>(
  iterable: AsyncIterable<T>
): ReadableStream<T> {
  const iterator = iterable[Symbol.asyncIterator]()
  return new ReadableStream<T>({
    async pull(controller) {
      const { value, done } = await iterator.next()
      if (done) {
        controller.close()
      } else {
        controller.enqueue(value)
      }
    },
  })
}

export async function* readableToAsyncIterable<T>(
  readable: ReadableStream<T>
): AsyncGenerator<T> {
  const reader = readable.getReader()
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      yield value
    }
  } finally {
    reader.releaseLock()
  }
}

export async function readableToString(
  readable: BytesReadable,
  label = "utf-8"
): Promise<string> {
  // eslint-disable-next-line no-undef
  const decoder = new TextDecoderStream(label)
  const textReadable = readable.pipeThrough(decoder)
  return "".concat(
    ...(await asyncIterableToArray(readableToAsyncIterable(textReadable)))
  )
}

export async function readableToJsonObject<T>(
  readable: BytesReadable,
  objectExtractor: (data: unknown) => T
): Promise<T> {
  const text = await readableToString(readable)
  const data = stringToJson(text)
  return objectExtractor(data)
}

export async function* iteratorToAsync<T>(
  iterator: IterableIterator<T>
): AsyncIterableIterator<T> {
  for (const value of iterator) {
    yield value
  }
}

export function stringToReadable(text: string): BytesReadable {
  const textEncoder = new TextEncoder()
  const bytes = textEncoder.encode(text)
  return asyncIterableToReadable(iteratorToAsync([bytes].values()))
}

export async function bytesReadableToArrayBuffer(
  readable: BytesReadable
): Promise<ArrayBuffer> {
  return await new Blob(
    await asyncIterableToArray(readableToAsyncIterable(readable))
  ).arrayBuffer()
}

export function bytesToReadable(bytes: Uint8Array): BytesReadable {
  return asyncIterableToReadable(iteratorToAsync([bytes].values()))
}

export function arrayBufferToReadable(arrayBuffer: ArrayBuffer): BytesReadable {
  return bytesToReadable(new Uint8Array(arrayBuffer))
}

export function emptyReadable(): BytesReadable {
  return asyncIterableToReadable(iteratorToAsync([].values()))
}

export async function* splitReadableToStringIter(
  readable: BytesReadable,
  separator: string
): AsyncGenerator<string> {
  const decoder = new TextDecoderStream()
  const textReadable = readable.pipeThrough(decoder)
  let buf = ""
  for await (const text of readableToAsyncIterable(textReadable)) {
    buf += text
    const values = buf.split(separator)
    for (let i = 0; i < values.length - 1; ++i) {
      yield abortIfUndefined(values[i])
    }
    buf = abortIfUndefined(values[values.length - 1])
  }
  yield buf
}
