import { arrayZip2 } from "base-core/lib/array.js"
import { bytesToString } from "base-core/lib/data.js"
import { throwError } from "base-core/lib/exception.js"
import {
  cancelTokenToAbortSignal,
  checkAndGetCancelToken,
  Scope,
} from "base-core/lib/scope.js"
import {
  objectType,
  stringType,
  int32Type,
  arrayType,
} from "base-core/lib/types.js"
import { commonNormalizer } from "base-core/lib/types-common.js"
import { isArray } from "base-core/lib/utils.js"
import {
  buildHttpServiceClient,
  defaultBuildHttpServiceClientOptions,
} from "base-node/lib/service.js"
import {
  MediawikiSearchRequest,
  MediawikiSearchResponse,
} from "cm-quantum-peripheral-common/lib/schema/mediawiki.js"

// See: https://www.mediawiki.org/wiki/API:Opensearch
const mediawikiApiSearchRequestType = objectType([
  { name: "action", type: stringType },
  { name: "search", type: stringType },
  { name: "limit", type: int32Type, optional: true },
] as const)

const mediawikiSearchHttpServiceSchema = [
  {
    kind: "get",
    value: {
      name: "api.php",
      query: mediawikiApiSearchRequestType,
      response: {
        kind: "bytes",
        value: undefined,
      },
    },
  },
] as const

const sitesMap = new Map([["wikipedia-en", "https://en.wikipedia.org/w"]])

export async function mediawikiSearch(
  scope: Scope,
  request: MediawikiSearchRequest
): Promise<MediawikiSearchResponse> {
  const siteUrl = sitesMap.get(request.site)
  if (siteUrl === undefined) {
    throw new Error("Invalid site")
  }
  const client = buildHttpServiceClient(mediawikiSearchHttpServiceSchema, {
    ...defaultBuildHttpServiceClientOptions(siteUrl),
  })
  const cancelToken = checkAndGetCancelToken(scope)
  const signal = cancelTokenToAbortSignal(cancelToken)
  const response = await client["get_api.php"].fetch(
    {
      action: "opensearch",
      search: request.search,
      limit: request.limit,
    },
    signal
  )
  const respObj = JSON.parse(bytesToString(response)) as unknown
  if (!isArray(respObj)) {
    throw new Error("Invalid response from mediawiki")
  }
  const titles = commonNormalizer(arrayType(stringType), respObj[1])
  const urls = commonNormalizer(arrayType(stringType), respObj[3])
  const results = (
    arrayZip2(titles, urls) ?? throwError("Invalid response from mediawiki")
  ).map(([title, url]) => ({ title, url }))
  return {
    results,
  }
}
