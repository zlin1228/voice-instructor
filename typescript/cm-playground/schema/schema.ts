import { CookServiceHttpSchema } from "base-core/lib/http-schema.js"
import { objectType } from "base-core/lib/types.js"

export const playgroundHttpServiceSchema = [
  // {
  //   kind: "post",
  //   value: {
  //     name: "spotifySearch",
  //     request: {
  //       kind: "json",
  //       value: spotifySearchRequestType,
  //     },
  //     response: {
  //       kind: "json",
  //       value: spotifySearchResponseType,
  //     },
  //   },
  // },
  // {
  //   kind: "post",
  //   value: {
  //     name: "spotifyPlay",
  //     request: {
  //       kind: "json",
  //       value: spotifyPlayRequestType,
  //     },
  //     response: {
  //       kind: "json",
  //       value: emptyResponseType,
  //     },
  //   },
  // },
] as const

export type PlaygroundHttpService = CookServiceHttpSchema<
  typeof playgroundHttpServiceSchema
>
