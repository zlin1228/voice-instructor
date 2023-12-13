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

export const bingSearchWebPagesRequestType = objectType([
  { name: "query", type: stringType },
] as const)

export type BingSearchWebPagesRequest = CookType<
  typeof bingSearchWebPagesRequestType
>

export const bingSearchWebPageType = objectType([
  { name: "id", type: stringType },
  { name: "name", type: stringType },
  { name: "url", type: stringType },
  { name: "isFamilyFriendly", type: booleanType },

  // The display URL of the webpage. The URL is meant for display purposes only and is not well formed.
  { name: "displayUrl", type: stringType },

  { name: "snippet", type: stringType },
] as const)

export const bingSearchWebPagesResponseType = objectType([
  {
    name: "webPages",
    type: arrayType(bingSearchWebPageType),
  },
] as const)

export type BingSearchWebPagesResponse = CookType<
  typeof bingSearchWebPagesResponseType
>

export const bingEndpoints = [
  {
    kind: "post",
    value: {
      name: "bingSearchWebPages",
      request: {
        kind: "json",
        value: bingSearchWebPagesRequestType,
      },
      response: {
        kind: "json",
        value: bingSearchWebPagesResponseType,
      },
    },
  },
] as const
