import {
  objectType,
  stringType,
  CookType,
  int32Type,
  arrayType,
  booleanType,
  timestampType,
  doubleType,
} from "base-core/lib/types.js"
import { geoLocationType } from "./common.js"

export const yelpBusinessType = objectType([
  { name: "id", type: stringType, optional: true },
  { name: "alias", type: stringType, optional: true },
  { name: "name", type: stringType, optional: true },
  { name: "imageUrl", type: stringType, optional: true },
  { name: "isClosed", type: booleanType, optional: true },
  { name: "url", type: stringType, optional: true },
  { name: "reviewCount", type: doubleType, optional: true },
  {
    name: "categories",
    type: arrayType(
      objectType([
        { name: "alias", type: stringType, optional: true },
        { name: "title", type: stringType, optional: true },
      ] as const)
    ),
    optional: true,
  },
  { name: "rating", type: doubleType, optional: true },
  { name: "geoLocation", type: geoLocationType, optional: true },
  { name: "price", type: stringType, optional: true },
  { name: "displayAddress", type: arrayType(stringType), optional: true },
  { name: "phone", type: stringType, optional: true },
  { name: "displayPhone", type: stringType, optional: true },
  { name: "distance", type: doubleType, optional: true },
] as const)

export type YelpBusiness = CookType<typeof yelpBusinessType>

// https://docs.developer.yelp.com/reference/v3_business_search
export const yelpBusinessesSearchRequestType = objectType([
  { name: "geoLocation", type: geoLocationType },

  // Search term, e.g. "food" or "restaurants".
  { name: "term", type: stringType, optional: true },

  // A suggested search radius in meters. The max value is 40,000 meters.
  { name: "radius", type: int32Type, optional: true },

  // Categories to filter the search results with.
  { name: "categories", type: arrayType(stringType), optional: true },

  // Pricing levels to filter the search result with: 1 = $, 2 = $$, 3 = $$$, 4 = $$$$.
  // e.g., "1, 2, 3" will filter the results to show the ones that are $, $$, or $$$.
  { name: "price", type: arrayType(int32Type), optional: true },

  // When set to true, only return the businesses that are open now.
  // `openNow` and `openAt` cannot be used together.
  { name: "openNow", type: booleanType, optional: true },

  // If specified, it will return businesses open at the given time.
  // `openNow` and `openAt` cannot be used together.
  { name: "openAt", type: timestampType, optional: true },

  // Additional filters. See https://docs.developer.yelp.com/reference/v3_business_search.
  { name: "attributes", type: arrayType(stringType), optional: true },

  // Suggestion to the search algorithm that the results be sorted by one of the these modes: best_match, rating, review_count or distance.
  // The default is best_match.
  { name: "sortBy", type: stringType, optional: true },

  // Number of results to return
  { name: "limit", type: int32Type },

  // Offset the list of returned results by this amount.
  { name: "offset", type: int32Type, optional: true },
] as const)

export type YelpBusinessesSearchRequest = CookType<
  typeof yelpBusinessesSearchRequestType
>

export const yelpBusinessesSearchResponseType = objectType([
  { name: "businesses", type: arrayType(yelpBusinessType) },
] as const)

export type YelpBusinessesSearchResponse = CookType<
  typeof yelpBusinessesSearchResponseType
>

export const yelpEndpoints = [
  {
    kind: "post",
    value: {
      name: "yelpBusinessesSearch",
      request: {
        kind: "json",
        value: yelpBusinessesSearchRequestType,
      },
      response: {
        kind: "json",
        value: yelpBusinessesSearchResponseType,
      },
    },
  },
] as const
