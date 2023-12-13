import {
  objectType,
  stringType,
  CookType,
  timestampType,
  arrayType,
} from "base-core/lib/types.js"
import { imageWithDimensionType } from "./common.js"

export const youtubeSearchType = objectType([
  { name: "query", type: stringType },
] as const)

export type YoutubeSearch = CookType<typeof youtubeSearchType>

export const youtubeResourceType = objectType([
  // `kind` can be one of "youtube#video", "youtube#playlist", "youtube#channel"
  { name: "kind", type: stringType, optional: true },
  { name: "id", type: stringType, optional: true },
  { name: "channelId", type: stringType, optional: true },
  { name: "channelTitle", type: stringType, optional: true },
  { name: "description", type: stringType, optional: true },
  { name: "publishedAt", type: timestampType, optional: true },
  {
    name: "thumbnails",
    type: objectType([
      { name: "default", type: imageWithDimensionType, optional: true },
      { name: "high", type: imageWithDimensionType, optional: true },
      { name: "maxres", type: imageWithDimensionType, optional: true },
      { name: "medium", type: imageWithDimensionType, optional: true },
      { name: "standard", type: imageWithDimensionType, optional: true },
    ] as const),
    optional: true,
  },
  { name: "title", type: stringType, optional: true },

  // Deep link to this resource
  { name: "link", type: stringType, optional: true },
] as const)

export type YoutubeResource = CookType<typeof youtubeResourceType>

export const youtubeEndpoints = [
  {
    kind: "post",
    value: {
      name: "youtubeSearch",
      request: {
        kind: "json",
        value: youtubeSearchType,
      },
      response: {
        kind: "json",
        value: arrayType(youtubeResourceType),
      },
    },
  },
] as const
