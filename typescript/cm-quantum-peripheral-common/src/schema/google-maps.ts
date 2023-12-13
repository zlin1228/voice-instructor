import {
  objectType,
  stringType,
  booleanType,
  int32Type,
  doubleType,
  arrayType,
  CookType,
} from "base-core/lib/types.js"
import { geoLocationType, geoLocationBoundType } from "./common.js"

// https://github.com/googlemaps/google-maps-services-js/blob/67a2479/src/common.ts
export const googleMapsPlaceDataType = objectType([
  { name: "formattedAddress", type: stringType, optional: true },
  { name: "formattedPhoneNumber", type: stringType, optional: true },

  // See [adr microformat](http://microformats.org/wiki/adr)
  { name: "adrAddress", type: stringType, optional: true },

  { name: "geoLocation", type: geoLocationType, optional: true },

  // `viewport` contains the recommended viewport for displaying the returned result
  { name: "viewport", type: geoLocationBoundType, optional: true },

  // the URL of a suggested icon which may be displayed to the user when indicating this result on a map.
  { name: "icon", type: stringType, optional: true },

  // the human-readable name, usually the canonicalized business name.
  { name: "name", type: stringType, optional: true },

  { name: "openNow", type: booleanType, optional: true },
  { name: "businessStatus", type: stringType, optional: true },
  { name: "placeId", type: stringType, optional: true },

  // The price level of the place, on a scale of 0 to 4.
  { name: "priceLevel", type: int32Type, optional: true },

  // The place's rating, from 1.0 to 5.0, based on aggregated user reviews.
  { name: "rating", type: doubleType, optional: true },

  // The total number of ratings from users
  { name: "userRatingsTotal", type: doubleType, optional: true },

  // An array of feature types describing the given result
  { name: "types", type: arrayType(stringType) },

  // It contains the URL of the official Google page for this place.
  { name: "url", type: stringType, optional: true },

  // The authoritative website for this place.
  { name: "website", type: stringType, optional: true },
] as const)

export type GoogleMapsPlaceData = CookType<typeof googleMapsPlaceDataType>

// https://github.com/googlemaps/google-maps-services-js/blob/67a2479/src/places/placesnearby.ts
export const googleMapsPlacesNearbyType = objectType([
  { name: "location", type: geoLocationType },

  // `radius` is the distance (in meters) within which to return place results.
  // The maximum allowed radius is 50,000 meters.
  // `radius` must not be included if `rankby=distance` is specified.
  { name: "radius", type: doubleType, optional: true },

  // A term to be matched against all content that Google has indexed for this place.
  { name: "keyword", type: stringType, optional: true },

  // Restricts results to only those places within the specified range.
  // Valid values range between 0 (most affordable) to 4 (most expensive), inclusive.
  { name: "minPrice", type: int32Type, optional: true },

  // Restricts results to only those places within the specified range.
  // Valid values range between 0 (most affordable) to 4 (most expensive), inclusive.
  { name: "maxPrice", type: int32Type, optional: true },

  // Returns only those places that are open for business at the time the query is sent.
  { name: "openNow", type: booleanType, optional: true },

  // Specifies the order in which results are listed.
  // Valid values are:
  //   - "prominence" [default]: results are sorted based on their importance
  //   - "distance": biases search results in ascending order by their distance from the specified `location`
  // `rankby` must not be included if `radius` is specified.
  { name: "rankBy", type: stringType, optional: true },

  // Restricts the results to places matching the specified type.
  { name: "type", type: stringType, optional: true },

  // TODO: Support page token
] as const)

export type GoogleMapsPlacesNearby = CookType<typeof googleMapsPlacesNearbyType>

export const googleMapsEndpoints = [
  {
    kind: "post",
    value: {
      name: "googleMapsPlacesNearby",
      request: {
        kind: "json",
        value: googleMapsPlacesNearbyType,
      },
      response: {
        kind: "json",
        value: arrayType(googleMapsPlaceDataType),
      },
    },
  },
] as const
