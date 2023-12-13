import {
  BingSearchWebPagesRequest,
  BingSearchWebPagesResponse,
} from "cm-quantum-peripheral-common/lib/schema/bing.js"
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
  booleanType,
  timestampType,
  doubleType,
  nullableType,
} from "base-core/lib/types.js"
import {
  buildHttpServiceClient,
  defaultBuildHttpServiceClientOptions,
} from "base-node/lib/service.js"
import { log } from "base-core/lib/logging.js"

const bingAccessKey = "f0915b5a04454f54884154796932fb64"

// https://learn.microsoft.com/en-us/bing/search-apis/bing-web-search/quickstarts/rest/nodejs

// https://learn.microsoft.com/en-us/bing/search-apis/bing-web-search/reference/query-parameters
const bingApiWebSearchRequestType = objectType([
  { name: "q", type: stringType },
  { name: "responseFilter", type: stringType, optional: true },
] as const)

type BingApiWebSearchRequest = CookType<typeof bingApiWebSearchRequestType>

// https://learn.microsoft.com/en-us/bing/search-apis/bing-web-search/reference/response-objects#webpage
const bingApiWebSearchPageType = objectType([
  { name: "id", type: stringType },
  { name: "name", type: stringType },
  { name: "url", type: stringType },
  { name: "isFamilyFriendly", type: booleanType },

  // The display URL of the webpage. The URL is meant for display purposes only and is not well formed.
  { name: "displayUrl", type: stringType },

  { name: "snippet", type: stringType },
] as const)

// https://learn.microsoft.com/en-us/bing/search-apis/bing-web-search/reference/response-objects#searchresponse
const bingApiWebSearchResponseType = objectType([
  { name: "_type", type: stringType },
  {
    name: "webPages",
    type: objectType([
      { name: "value", type: arrayType(bingApiWebSearchPageType) },
    ] as const),
    optional: true,
  },
] as const)

type BingApiWebSearchResponse = CookType<typeof bingApiWebSearchResponseType>

const bingWebSearchHttpServiceSchema = [
  {
    kind: "get",
    value: {
      name: "search",
      query: bingApiWebSearchRequestType,
      response: {
        kind: "json",
        value: bingApiWebSearchResponseType,
      },
    },
  },
] as const

export async function bingSearchWebPages(
  scope: Scope,
  request: BingSearchWebPagesRequest
): Promise<BingSearchWebPagesResponse> {
  const client = buildHttpServiceClient(bingWebSearchHttpServiceSchema, {
    ...defaultBuildHttpServiceClientOptions(
      "https://api.bing.microsoft.com/v7.0"
    ),
    headers: [{ name: "Ocp-Apim-Subscription-Key", value: bingAccessKey }],
  })
  const cancelToken = checkAndGetCancelToken(scope)
  const signal = cancelTokenToAbortSignal(cancelToken)
  const response = await client.get_search.fetch(
    {
      q: request.query,
      responseFilter: "webPages",
    },
    signal
  )
  if (response._type !== "SearchResponse" || response.webPages === undefined) {
    log.info("Request to Bing API failed")
    console.log(response)
    throw new Error("Request to Bing API failed")
  }
  return {
    webPages: response.webPages.value.map((page) => ({
      id: page.id,
      name: page.name,
      url: page.url,
      isFamilyFriendly: page.isFamilyFriendly,
      displayUrl: page.displayUrl,
      snippet: page.snippet,
    })),
  }
}
