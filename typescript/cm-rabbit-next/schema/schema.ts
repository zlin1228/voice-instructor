import { CookServiceHttpSchema } from "base-core/lib/http-schema.js"
import { objectType } from "base-core/lib/types.js"

import {
  spotifyPlayRequestType as peripheralSpotifyPlayRequestType,
  spotifySearchRequestType as peripheralSpotifySearchRequestType,
  spotifySearchResponseType as peripheralSpotifySearchResponseType,
} from "cm-spotify-client/lib/spotify-schema.js"

export const spotifyPlayRequestType = peripheralSpotifyPlayRequestType
export const spotifySearchRequestType = peripheralSpotifySearchRequestType
export const spotifySearchResponseType = peripheralSpotifySearchResponseType
export const emptyResponseType = objectType([] as const)

export const os2HttpServiceSchema = [
  {
    kind: "post",
    value: {
      name: "spotifySearch",
      request: {
        kind: "json",
        value: spotifySearchRequestType,
      },
      response: {
        kind: "json",
        value: spotifySearchResponseType,
      },
    },
  },
  {
    kind: "post",
    value: {
      name: "spotifyPlay",
      request: {
        kind: "json",
        value: spotifyPlayRequestType,
      },
      response: {
        kind: "json",
        value: emptyResponseType,
      },
    },
  },
] as const

export type Os2HttpService = CookServiceHttpSchema<typeof os2HttpServiceSchema>
