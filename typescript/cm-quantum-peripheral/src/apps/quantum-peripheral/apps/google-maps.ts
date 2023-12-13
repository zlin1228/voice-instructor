import {
  Client,
  LatLngBounds,
  LatLngLiteral,
  PlaceData,
  PlacesNearbyRanking,
} from "@googlemaps/google-maps-services-js"
import { Scope } from "base-core/lib/scope.js"
import { GeoLocation, GeoLocationBound } from "cm-quantum-peripheral-common/lib/schema/common.js"
import {
  GoogleMapsPlaceData,
  GoogleMapsPlacesNearby,
} from "cm-quantum-peripheral-common/lib/schema/google-maps.js"

const googleMapsApiKey = "AIzaSyCfAbXBVs9SvHhlYDr6iOA2wjhmeSZd2A8"

function getRankByParam(rankBy: string): PlacesNearbyRanking {
  if (rankBy === "prominence") {
    return PlacesNearbyRanking.prominence
  }
  if (rankBy === "distance") {
    return PlacesNearbyRanking.distance
  }
  throw new Error(`Invalid 'rankBy' parameter: ${rankBy}`)
}

function normalizeGeoLocationFromGoogle(location: LatLngLiteral): GeoLocation {
  return {
    latitude: location.lat,
    longitude: location.lng,
  }
}

function normalizeGeoLocationBoundFromGoogle(
  bound: LatLngBounds
): GeoLocationBound {
  return {
    northeast: normalizeGeoLocationFromGoogle(bound.northeast),
    southwest: normalizeGeoLocationFromGoogle(bound.southwest),
  }
}

function normalizePlaceDataFromGoogle(
  place: Partial<PlaceData>
): GoogleMapsPlaceData {
  return {
    formattedAddress: place.formatted_address,
    formattedPhoneNumber: place.formatted_phone_number,
    adrAddress: place.adr_address,
    geoLocation:
      place.geometry === undefined
        ? undefined
        : normalizeGeoLocationFromGoogle(place.geometry.location),
    viewport:
      place.geometry === undefined
        ? undefined
        : normalizeGeoLocationBoundFromGoogle(place.geometry.viewport),
    icon: place.icon,
    name: place.name,
    openNow: place.opening_hours?.open_now,
    businessStatus: place.business_status,
    placeId: place.place_id,
    priceLevel: place.price_level,
    rating: place.rating,
    userRatingsTotal: place.user_ratings_total,
    types: place.types ?? [],
    url: place.url,
    website: place.website,
  }
}

// function makeOptionalField<
//   T,
//   K extends keyof T &
//     keyof {
//       [k in keyof T as undefined extends T[k] ? k : never]: undefined
//     }
// >(
//   obj: T,
//   key: K
// ):
//   | {
//       [k in K]?: Exclude<T[k], undefined>
//     }
//   | undefined {
//   if (obj[key] === undefined) {
//     return undefined
//   }
//   return {
//     [key]: obj[key],
//   } as {
//     [k in K]?: Exclude<T[k], undefined>
//   }
// }

function makeOptionalField<K extends string, T>(
  key: K,
  value: T | undefined
):
  | {
      [k in K]: T
    }
  | undefined {
  if (value === undefined) {
    return undefined
  }
  return {
    [key]: value,
  } as {
    [k in K]: T
  }
}

export async function googleMapsPlacesNearby(
  scope: Scope,
  request: GoogleMapsPlacesNearby
): Promise<GoogleMapsPlaceData[]> {
  const client = new Client()
  const resp = await client.placesNearby({
    params: {
      key: googleMapsApiKey,
      location: request.location,
      ...makeOptionalField("radius", request.radius),
      ...makeOptionalField("keyword", request.keyword),
      ...makeOptionalField("minprice", request.minPrice),
      ...makeOptionalField("maxprice", request.maxPrice),
      ...makeOptionalField("opennow", request.openNow),
      ...makeOptionalField(
        "rankby",
        request.rankBy === undefined
          ? undefined
          : getRankByParam(request.rankBy)
      ),
      ...makeOptionalField("type", request.type),
    },
    timeout: 1000,
  })
  return resp.data.results.map((p) => {
    return normalizePlaceDataFromGoogle(p)
  })
}
