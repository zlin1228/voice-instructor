import { objectType, stringType } from "base-core/lib/types.js"
import { CookServiceHttpSchema } from "base-core/lib/http-schema.js"
import { googleMapsEndpoints } from "./google-maps.js"
import { uberEndpoints } from "./uber.js"
import { youtubeEndpoints } from "./youtube.js"
import { yelpEndpoints } from "./yelp.js"
import { mediawikiEndpoints } from "./mediawiki.js"
import { systemEndpoints } from "./system.js"
import { weatherEndpoints } from "./weather.js"
import { shoppingEndpoints } from "./shopping.js"
import { bingEndpoints } from "./bing.js"
import { googleDriveEndpoints } from "./google-drive.js"
import { spotifyEndpoints } from "cm-spotify-client/lib/spotify-schema.js"

// TODO:
//  * Add idempotency key to avoid repeated side-effects due to retries

export const quantumPeripheralHttpServiceSchema = [
  {
    kind: "get",
    value: {
      name: "test",
      query: objectType([] as const),
      response: {
        kind: "json",
        value: objectType([{ name: "what", type: stringType }] as const),
      },
    },
  },
  ...uberEndpoints,
  ...googleMapsEndpoints,
  ...youtubeEndpoints,
  ...yelpEndpoints,
  ...mediawikiEndpoints,
  ...systemEndpoints,
  ...weatherEndpoints,
  ...shoppingEndpoints,
  ...bingEndpoints,
  ...googleDriveEndpoints,
  ...spotifyEndpoints,
] as const

export type QuantumPeripheralHttpService = CookServiceHttpSchema<
  typeof quantumPeripheralHttpServiceSchema
>
