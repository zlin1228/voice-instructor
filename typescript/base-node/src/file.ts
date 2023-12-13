import fs from "node:fs"
import fsPromises from "node:fs/promises"
import stream from "node:stream"
import { tmpdir } from "node:os"
import { sep } from "node:path"

import { Scope, ScopeAttachment } from "base-core/lib/scope.js"

import {
  BytesReadable,
  BytesWritable,
  readableToString,
} from "base-core/lib/stream.js"
import { stringToJson } from "base-core/lib/string.js"

export function createFileReadable(filename: string): BytesReadable {
  return stream.Readable.toWeb(fs.createReadStream(filename)) as BytesReadable
}

export function createFileWritable(filename: string): BytesWritable {
  // eslint-disable-next-line
  return (stream.Writable as any).toWeb(fs.createWriteStream(filename))
}

export async function writeTextFile(
  filename: string,
  content: string
): Promise<void> {
  return await fs.promises.writeFile(filename, content)
}

export async function readTextFile(filename: string): Promise<string> {
  return await readableToString(createFileReadable(filename))
}

export async function readJsonFile<T>(
  filename: string,
  objectExtractor: (data: unknown) => T
): Promise<T> {
  const json = await readableToString(createFileReadable(filename))
  const data = stringToJson(json)
  return objectExtractor(data)
}

export async function writeBytesFile(
  filename: string,
  bytes: Uint8Array
): Promise<void> {
  return await fs.promises.writeFile(filename, bytes, {
    flag: "wx",
  })
}

export async function writeBytesIterFile(
  filename: string,
  bytesIter: AsyncIterable<Uint8Array>
): Promise<void> {
  return await fs.promises.writeFile(filename, bytesIter, {
    flag: "wx",
  })
}

export async function readBytesFile(filename: string): Promise<Uint8Array> {
  return await fs.promises.readFile(filename)
}

export async function fileExists(filename: string): Promise<boolean> {
  try {
    await fsPromises.access(filename, fs.constants.F_OK)
    return true
  } catch (e) {
    return false
  }
}

export async function fileSize(filename: string): Promise<number | undefined> {
  try {
    const stat = await fsPromises.stat(filename)
    return stat.size
  } catch (e) {
    return undefined
  }
}

const temporaryDirectoryAttachmentKey = Symbol("TemporaryDirectory")

function getTemporaryDirectoryAttachment(
  scope: Scope | undefined
): string | undefined {
  return scope?.getAttachment(temporaryDirectoryAttachmentKey) as
    | string
    | undefined
}

export function buildAttachmentForTemporaryDirectory(
  path: string
): ScopeAttachment {
  return [
    temporaryDirectoryAttachmentKey,
    async (scope) => {
      return path
    },
  ]
}
export async function makeTemporaryDirectory(
  scope: Scope,
  name: string
): Promise<string> {
  const temporaryDirectory = getTemporaryDirectoryAttachment(scope) ?? tmpdir()
  const dir = await fsPromises.mkdtemp(`${temporaryDirectory}${sep}${name}-`)
  scope.onLeave(async () => {
    await fsPromises.rm(dir, { recursive: true, force: true })
  })
  return dir
}

export async function* listFilesRecursively(
  scope: Scope,
  directory: string
): AsyncGenerator<string> {
  async function* process(names: string[]): AsyncGenerator<string> {
    const entries = await fsPromises.readdir(directory, {
      withFileTypes: true,
    })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        yield* process([...names, entry.name])
      } else {
        yield [...names, entry.name].join("/")
      }
    }
  }
  yield* process([])
}
