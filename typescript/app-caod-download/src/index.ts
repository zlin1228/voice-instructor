import Axios from "axios"

import fs from "node:fs"
import fsPromises from "node:fs/promises"
import { pipeline } from "node:stream/promises"

import { CookServiceHttpSchema } from "base-core/lib/http-schema.js"
import { log } from "base-core/lib/logging.js"
import { writeTextFile } from "base-node/lib/file.js"
import { Scanner } from "base-core/lib/processing.js"
import {
  cancelTokenToAbortSignal,
  checkAndGetCancelToken,
  Scope,
} from "base-core/lib/scope.js"
import {
  objectType,
  stringType,
  CookType,
  int32Type,
  arrayType,
} from "base-core/lib/types.js"
import {
  buildHttpServiceClient,
  defaultBuildHttpServiceClientOptions,
} from "base-node/lib/service.js"

import "base-node/lib/init.js"
import { isNotUndefined } from "base-core/lib/utils.js"

// https://github.com/ltfc/CAOD

// https://api.quanku.art/cag2.ChinaArtOpenDataService

export const tokenType = objectType([
  { name: "apiKey", type: stringType },
  { name: "apiSec", type: stringType },
] as const)

export type Token = CookType<typeof tokenType>

export const pageType = objectType([
  { name: "skip", type: int32Type },
  { name: "limit", type: int32Type },
] as const)

export const listRequestType = objectType([
  { name: "token", type: tokenType },
  { name: "page", type: pageType },
] as const)

export type ListRequest = CookType<typeof listRequestType>

export const itemType = objectType([
  { name: "caodsn", type: stringType },
  { name: "age", type: stringType },
  { name: "name", type: stringType },
  { name: "author", type: stringType },
  { name: "desc", type: stringType },
  { name: "commentInfo", type: stringType },
  { name: "stampInfo", type: stringType },
  { name: "referenceBook", type: stringType },
  { name: "mediaType", type: stringType },
  { name: "materialType", type: stringType },
  { name: "styleType", type: stringType },
  { name: "size", type: stringType },
  { name: "tags", type: arrayType(stringType) },
  { name: "subjects", type: arrayType(stringType) },
  { name: "technique", type: arrayType(stringType) },
] as const)

export type Item = CookType<typeof itemType>

export const itemWithUrlType = objectType([
  { name: "item", type: itemType },
  { name: "url", type: stringType },
  { name: "error", type: stringType },
] as const)

export type ItemWithUrl = CookType<typeof itemWithUrlType>

export const listResponseType = objectType([
  { name: "data", type: arrayType(itemType) },
  { name: "total", type: int32Type },
] as const)

export type ListResponse = CookType<typeof listResponseType>

export const downloadRequestType = objectType([
  { name: "token", type: tokenType },
  { name: "caodsn", type: stringType },
] as const)

export type DownloadRequest = CookType<typeof downloadRequestType>

export const downloadResponseType = objectType([
  { name: "url", type: stringType },
] as const)

export type DownloadResponse = CookType<typeof downloadResponseType>

export const caodHttpServiceSchema = [
  {
    kind: "post",
    value: {
      name: "list",
      request: {
        kind: "json",
        value: listRequestType,
      },
      response: {
        kind: "json",
        value: listResponseType,
      },
    },
  },
  {
    kind: "post",
    value: {
      name: "getDownloadUrl",
      request: {
        kind: "json",
        value: downloadRequestType,
      },
      response: {
        kind: "json",
        value: downloadResponseType,
      },
    },
  },
] as const

export type CaodHttpService = CookServiceHttpSchema<
  typeof caodHttpServiceSchema
>

export const caodClient = buildHttpServiceClient(caodHttpServiceSchema, {
  ...defaultBuildHttpServiceClientOptions(
    "https://api.quanku.art/cag2.ChinaArtOpenDataService"
  ),
})

function buildItemsScanner(scope: Scope, token: Token): Scanner<Item> {
  const cancelToken = checkAndGetCancelToken(scope)
  const signal = cancelTokenToAbortSignal(cancelToken)
  let count: number | undefined = undefined
  async function* gen() {
    let skip = 0
    for (;;) {
      const response = await caodClient.post_list.fetch(
        {
          token,
          page: {
            skip,
            limit: 100000,
          },
        },
        signal
      )
      count = response.total
      if (response.data.length === 0) break
      skip += response.data.length
      for (const item of response.data) {
        yield item
      }
    }
  }
  return new Scanner(gen(), () => count)
}

async function main() {
  const token: Token = {
    apiKey: "63a2679063e4c509fd9b4ef2",
    apiSec: "Y6JnkGPkxQn9m07zYUyZI1a.4jc4TJklzz15lY+qqJ57oQ==",
  }
  await Scope.with(undefined, [], async (scope) => {
    const itemWithUrls = await buildItemsScanner(scope, token)
      .transform(scope, 4, async (scope, item) => {
        try {
          const cancelToken = checkAndGetCancelToken(scope)
          const signal = cancelTokenToAbortSignal(cancelToken)
          const resp = await caodClient.post_getDownloadUrl.fetch(
            {
              token,
              caodsn: item.caodsn,
            },
            signal
          )
          const url = resp.url
          try {
            const writer = fs.createWriteStream(`images/${item.caodsn}.jpg`)
            const response = await Axios({
              url,
              method: "GET",
              responseType: "stream",
            })
            await pipeline(response.data, writer)
          } catch (e) {
            log.info(`Failed to donwload ${item.caodsn} due to: ${String(e)}`)
            await fsPromises.rm(`images/${item.caodsn}.jpg`, { force: true })
            return {
              url,
              item,
              error: String(e),
            }
          }
          return {
            url,
            item,
            error: "",
          }
        } catch (e) {
          log.info(`Failed to handle ${item.caodsn} due to: ${String(e)}`)
          return undefined
        }
      })
      .logStats(scope)
      .toArray()
    await writeTextFile(
      "item-with-urls.json",
      JSON.stringify(itemWithUrls.filter(isNotUndefined))
    )
  })
}

void main()
