import { Scope } from "base-core/lib/scope.js"
import { QuantumPeripheralHttpService } from "cm-quantum-peripheral-common/lib/schema/schema.js"
import { buildUberRideRequestLink, uberRequestRide } from "./apps/uber.js"
import { googleMapsPlacesNearby } from "./apps/google-maps.js"
import { youtubeSearch } from "./apps/youtube.js"
import { yelpBusinessesSearch } from "./apps/yelp.js"
import { mediawikiSearch } from "./apps/mediawiki.js"
import { weatherQuery } from "./apps/weather.js"
import { shoppingCreateOrder, shoppingProductSearch } from "./apps/shopping.js"
import { bingSearchWebPages } from "./apps/bing.js"
import { googleDriveCreateNote } from "./apps/google-drive.js"
import { buildSpotifyHttpService } from "cm-spotify-client/lib/spotify.js"

export async function buildQuantumPeripheralHttpService(
  scope: Scope,
  config: {}
): Promise<QuantumPeripheralHttpService> {
  const spotifyClient = await buildSpotifyHttpService(scope)
  return {
    get_test: async (scope, query) => {
      return {
        what: "This is Quantum Peripheral",
      }
    },
    post_buildUberRideRequestLink: async (scope, request) => {
      return await buildUberRideRequestLink(request)
    },
    post_uberRequestRide: async (scope, request) => {
      return await uberRequestRide(scope, request)
    },
    post_googleMapsPlacesNearby: async (scope, request) => {
      return await googleMapsPlacesNearby(scope, request)
    },
    post_youtubeSearch: async (scope, request) => {
      return await youtubeSearch(scope, request)
    },
    post_yelpBusinessesSearch: async (scope, request) => {
      return await yelpBusinessesSearch(scope, request)
    },
    post_mediawikiSearch: async (scope, request) => {
      return await mediawikiSearch(scope, request)
    },
    post_systemCreateAlarm: async (scope, request) => {
      return {}
    },
    post_systemCreateTimer: async (scope, request) => {
      return {}
    },
    post_systemSendMessage: async (scope, request) => {
      return {}
    },
    post_weatherQuery: async (scope, request) => {
      return await weatherQuery(scope, request)
    },
    post_shoppingProductSearch: async (scope, request) => {
      return await shoppingProductSearch(scope, request)
    },
    post_shoppingCreateOrder: async (scope, request) => {
      return await shoppingCreateOrder(scope, request)
    },
    post_bingSearchWebPages: async (scope, request) => {
      return await bingSearchWebPages(scope, request)
    },
    post_googleDriveCreateNote: async (scope, request) => {
      return await googleDriveCreateNote(scope, request)
    },
    ...spotifyClient,
  }
}
