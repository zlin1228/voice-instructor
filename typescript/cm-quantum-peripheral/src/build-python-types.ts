import {
  bingSearchWebPagesRequestType,
  bingSearchWebPagesResponseType,
  bingSearchWebPageType,
} from "cm-quantum-peripheral-common/lib/schema/bing.js"
import {
  linkResponseType,
  geoLocationType,
  geoLocationBoundType,
  imageWithDimensionType,
} from "cm-quantum-peripheral-common/lib/schema/common.js"
import {
  googleDriveCreateNoteRequestType,
  googleDriveCreateNoteResponseType,
} from "cm-quantum-peripheral-common/lib/schema/google-drive.js"
import {
  googleMapsPlaceDataType,
  googleMapsPlacesNearbyType,
} from "cm-quantum-peripheral-common/lib/schema/google-maps.js"
import {
  mediawikiSearchRequestType,
  mediawikiSearchResponseType,
} from "cm-quantum-peripheral-common/lib/schema/mediawiki.js"
import {
  shoppingAddressType,
  shoppingCreateOrderRequestType,
  shoppingCreateOrderResponseType,
  shoppingOrderProductType,
  shoppingProductSearchRequestType,
  shoppingProductSearchResponseType,
  shoppingSearchProductType,
} from "cm-quantum-peripheral-common/lib/schema/shopping.js"
import {
  spotifyGetCurrentUserPlaylistsRequestType,
  spotifyGetCurrentUserPlaylistsResponseType,
  spotifyGetPlaybackStateRequestType,
  spotifyGetPlaybackStateResponseType,
  spotifyPauseRequestType,
  spotifyPlaylistType,
  spotifyPlayRequestType,
  spotifySearchRequestType,
  spotifySearchResponseType,
  spotifySetRepeatModeRequestType,
  spotifySetShuffleModeRequestType,
  spotifySkipToNextRequestType,
  spotifySkipToPreviousRequestType,
  spotifyTrackType,
} from "cm-spotify-client/lib/spotify-schema.js"
import {
  systemCreateAlarmRequestType,
  systemCreateTimerRequestType,
  systemSendMessageRequestType,
} from "cm-quantum-peripheral-common/lib/schema/system.js"
import {
  uberLocationType,
  uberRequestRideRequestType,
  uberRequestRideResponseType,
  uberRideRequestLinkType,
} from "cm-quantum-peripheral-common/lib/schema/uber.js"
import {
  weatherCurrentType,
  weatherDailyType,
  weatherHourlyType,
  weatherQueryRequestType,
  weatherQueryResponseType,
} from "cm-quantum-peripheral-common/lib/schema/weather.js"
import {
  yelpBusinessesSearchRequestType,
  yelpBusinessesSearchResponseType,
  yelpBusinessType,
} from "cm-quantum-peripheral-common/lib/schema/yelp.js"
import {
  youtubeResourceType,
  youtubeSearchType,
} from "cm-quantum-peripheral-common/lib/schema/youtube.js"

import { PydanticModelBuilder } from "base-core/lib/python.js"
import { Scope } from "base-core/lib/scope.js"

export async function printPydenticModel(scope: Scope): Promise<void> {
  const b = new PydanticModelBuilder()

  b.addType("LinkResponse", linkResponseType)
  b.addType("GeoLocation", geoLocationType)
  b.addType("GeoLocationBound", geoLocationBoundType)
  b.addType("ImageWithDimension", imageWithDimensionType)

  b.addType("UberLocation", uberLocationType)
  b.addType("UberRideRequestLink", uberRideRequestLinkType)
  b.addType("UberRequestRideRequest", uberRequestRideRequestType)
  b.addType("UberRequestRideResponse", uberRequestRideResponseType)

  b.addType("GoogleMapsPlaceData", googleMapsPlaceDataType)
  b.addType("GoogleMapsPlacesNearby", googleMapsPlacesNearbyType)

  b.addType("YoutubeSearch", youtubeSearchType)
  b.addType("YoutubeResourceType", youtubeResourceType)

  b.addType("YelpBusiness", yelpBusinessType)
  b.addType("YelpBusinessesSearchRequest", yelpBusinessesSearchRequestType)
  b.addType("YelpBusinessesSearchResponse", yelpBusinessesSearchResponseType)

  b.addType("MediawikiSearchRequest", mediawikiSearchRequestType)
  b.addType("MediawikiSearchResponse", mediawikiSearchResponseType)

  b.addType("SystemCreateAlarmRequest", systemCreateAlarmRequestType)
  b.addType("SystemCreateTimerRequest", systemCreateTimerRequestType)
  b.addType("SystemSendMessageRequest", systemSendMessageRequestType)

  b.addType("WeatherQueryRequest", weatherQueryRequestType)
  b.addType("WeatherQueryResponse", weatherQueryResponseType)
  b.addType("WeatherCurrent", weatherCurrentType)
  b.addType("WeatherDaily", weatherDailyType)
  b.addType("WeatherHourly", weatherHourlyType)

  b.addType("ShoppingSearchProduct", shoppingSearchProductType)
  b.addType("ShoppingProductSearchRequest", shoppingProductSearchRequestType)
  b.addType("ShoppingProductSearchResponse", shoppingProductSearchResponseType)

  b.addType("ShoppingAddress", shoppingAddressType)
  b.addType("ShoppingOrderProduct", shoppingOrderProductType)
  b.addType("ShoppingCreateOrderResponse", shoppingCreateOrderResponseType)
  b.addType("ShoppingCreateOrderRequest", shoppingCreateOrderRequestType)

  b.addType("BingSearchWebPage", bingSearchWebPageType)
  b.addType("BingSearchWebPagesRequest", bingSearchWebPagesRequestType)
  b.addType("BingSearchWebPagesResponse", bingSearchWebPagesResponseType)

  b.addType("GoogleDriveCreateNoteRequest", googleDriveCreateNoteRequestType)
  b.addType("GoogleDriveCreateNoteResponse", googleDriveCreateNoteResponseType)

  b.addType("SpotifyTrack", spotifyTrackType)
  b.addType("SpotifyPlaylist", spotifyPlaylistType)
  b.addType("SpotifySearchRequest", spotifySearchRequestType)
  b.addType("SpotifySearchResponse", spotifySearchResponseType)
  b.addType("SpotifyPlayRequest", spotifyPlayRequestType)
  b.addType("SpotifyPauseRequest", spotifyPauseRequestType)
  b.addType("SpotifySkipToNextRequest", spotifySkipToNextRequestType)
  b.addType("SpotifySkipToPreviousRequest", spotifySkipToPreviousRequestType)
  b.addType("SpotifySetRepeatModeRequest", spotifySetRepeatModeRequestType)
  b.addType("SpotifySetShuffleModeRequest", spotifySetShuffleModeRequestType)
  b.addType(
    "SpotifyGetPlaybackStateRequest",
    spotifyGetPlaybackStateRequestType
  )
  b.addType(
    "SpotifyGetPlaybackStateResponse",
    spotifyGetPlaybackStateResponseType
  )
  b.addType(
    "SpotifyGetCurrentUserPlaylistsRequest",
    spotifyGetCurrentUserPlaylistsRequestType
  )
  b.addType(
    "SpotifyGetPlaybackStateRequest",
    spotifyGetPlaybackStateRequestType
  )
  b.addType(
    "SpotifyGetCurrentUserPlaylistsResponse",
    spotifyGetCurrentUserPlaylistsResponseType
  )
  console.log(b.build())
}

async function main() {
  await Scope.with(undefined, [], async (scope) => {
    await printPydenticModel(scope)
  })
}

void main()
