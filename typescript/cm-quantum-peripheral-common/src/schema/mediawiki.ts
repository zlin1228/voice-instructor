import {
  arrayType,
  CookType,
  int32Type,
  objectType,
  stringType,
} from "base-core/lib/types.js"

// See: https://www.mediawiki.org/wiki/API:Opensearch
export const mediawikiSearchRequestType = objectType([
  // site must be "wikimedia-en"
  { name: "site", type: stringType },

  // Search string.
  { name: "search", type: stringType },

  // Maximum number of results to return. The value must be between 1 and 500.
  { name: "limit", type: int32Type, optional: true },
] as const)

export type MediawikiSearchRequest = CookType<typeof mediawikiSearchRequestType>

export const mediawikiSearchResponseType = objectType([
  {
    name: "results",
    type: arrayType(
      objectType([
        { name: "title", type: stringType },
        { name: "url", type: stringType },
      ] as const)
    ),
  },
] as const)

export type MediawikiSearchResponse = CookType<
  typeof mediawikiSearchResponseType
>

export const mediawikiEndpoints = [
  {
    kind: "post",
    value: {
      name: "mediawikiSearch",
      request: {
        kind: "json",
        value: mediawikiSearchRequestType,
      },
      response: {
        kind: "json",
        value: mediawikiSearchResponseType,
      },
    },
  },
] as const
