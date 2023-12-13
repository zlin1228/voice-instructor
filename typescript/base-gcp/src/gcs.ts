import fsPromises from "node:fs/promises"
import path from "node:path"

import { Storage } from "@google-cloud/storage"

import { bytesToString } from "base-core/lib/data.js"
import { throwError } from "base-core/lib/exception.js"
import { Scope } from "base-core/lib/scope.js"
import { stringCutFirst, stringRemovePrefix } from "base-core/lib/string.js"
import {
  listFilesRecursively,
  makeTemporaryDirectory,
  writeBytesIterFile,
} from "base-node/lib/file.js"
import { asyncIterableToArray } from "base-core/lib/concurrency.js"
import { Scanner, transformProcess } from "base-core/lib/processing.js"

const storage = new Storage()

export function parseGcsPath(gcsPath: string):
  | {
      bucketName: string
      fileName: string
    }
  | undefined {
  const p1 = stringRemovePrefix(gcsPath, "gs://")
  if (p1 === undefined) return undefined
  const p2 = stringCutFirst(p1, "/")
  if (p2 === undefined) return undefined
  return { bucketName: p2[0], fileName: p2[1] }
}

export function getGcpConsoleLinkToGcsPath(gcsPath: string): string {
  return `https://console.cloud.google.com/storage/browser/${
    stringRemovePrefix(gcsPath, "gs://") ??
    throwError(`Invalid GCS path: ${gcsPath}`)
  }`
}

export async function readGcsBytesFile(
  scope: Scope,
  gcsPath: string
): Promise<Uint8Array> {
  const { bucketName, fileName } =
    parseGcsPath(gcsPath) ?? throwError(`Invalid GCS path: ${gcsPath}`)
  const contents = await storage.bucket(bucketName).file(fileName).download()
  return contents[0]
}

export async function readGcsTextFile(
  scope: Scope,
  gcsPath: string
): Promise<string> {
  const bytes = await readGcsBytesFile(scope, gcsPath)
  return bytesToString(bytes)
}

export async function uploadGcsDirectory(
  scope: Scope,
  directory: string,
  gcsPath: string
): Promise<void> {
  const { bucketName, fileName } =
    parseGcsPath(gcsPath) ?? throwError(`Invalid GCS path: [${gcsPath}]`)
  await Scanner.fromSync(
    await asyncIterableToArray(listFilesRecursively(scope, directory))
  )
    .transform(scope, 10, async (scope, file) => {
      return await storage
        .bucket(bucketName)
        .upload(path.join(directory, file), {
          destination: path.join(fileName, file),
        })
    })
    .drain()
}

export async function uploadGcsBytesIterFile(
  scope: Scope,
  bytesIter: AsyncIterable<Uint8Array>,
  gcsPath: string
): Promise<void> {
  const { bucketName, fileName } =
    parseGcsPath(gcsPath) ?? throwError(`Invalid GCS path: [${gcsPath}]`)
  const dir = await makeTemporaryDirectory(scope, "upload-gcs")
  const filePath = path.join(dir, "file")
  try {
    await writeBytesIterFile(filePath, bytesIter)
    await storage.bucket(bucketName).upload(filePath, {
      destination: fileName,
    })
  } finally {
    await fsPromises.rm(dir, { recursive: true, force: true })
  }
}

export async function deleteGcsFile(
  scope: Scope,
  gcsPath: string
): Promise<void> {
  const { bucketName, fileName } =
    parseGcsPath(gcsPath) ?? throwError(`Invalid GCS path: [${gcsPath}]`)
  await storage.bucket(bucketName).file(fileName).delete({
    ignoreNotFound: true,
  })
}
