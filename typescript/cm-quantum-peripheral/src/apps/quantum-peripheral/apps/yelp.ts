import {
  cancelTokenToAbortSignal,
  checkAndGetCancelToken,
  Scope,
} from "base-core/lib/scope.js"
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
import {
  buildHttpServiceClient,
  defaultBuildHttpServiceClientOptions,
} from "base-node/lib/service.js"
import { geoLocationType } from "cm-quantum-peripheral-common/lib/schema/common.js"
import {
  YelpBusiness,
  YelpBusinessesSearchRequest,
  YelpBusinessesSearchResponse,
} from "cm-quantum-peripheral-common/lib/schema/yelp.js"
const yelpApiKey =
  "9Q3H5PA4Sbs2fpyC3QN_fc6z5W2I1SS8fVSN5HySnW2QKIeqP_Ng7_JvORaUXCPP2faJMbjmyacK_xXdppfQ7MuN8dhNcaEkY--Wzw4u5Bva3sxHTJQ5LLkSlx4MZHYx"

const yelpApiBusinessType = objectType([
  { name: "id", type: stringType, optional: true },
  { name: "alias", type: stringType, optional: true },
  { name: "name", type: stringType, optional: true },
  { name: "image_url", type: stringType, optional: true },
  { name: "is_closed", type: booleanType, optional: true },
  { name: "url", type: stringType, optional: true },
  { name: "review_count", type: doubleType, optional: true },
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
  { name: "coordinates", type: geoLocationType, optional: true },
  { name: "price", type: stringType, optional: true },
  {
    name: "location",
    type: objectType([
      { name: "display_address", type: arrayType(stringType), optional: true },
    ] as const),
    optional: true,
  },
  { name: "phone", type: stringType, optional: true },
  { name: "display_phone", type: stringType, optional: true },
  { name: "distance", type: doubleType, optional: true },
] as const)

type YelpApiBusiness = CookType<typeof yelpApiBusinessType>

// https://docs.developer.yelp.com/reference/v3_business_search
const yelpApiBusinessesSearchRequestType = objectType([
  { name: "latitude", type: doubleType },
  { name: "longitude", type: doubleType },
  { name: "term", type: stringType, optional: true },
  { name: "radius", type: int32Type, optional: true },
  { name: "categories", type: stringType, optional: true },
  { name: "price", type: stringType, optional: true },
  { name: "open_now", type: booleanType, optional: true },
  { name: "open_at", type: timestampType, optional: true },

  // Additional filters. See https://docs.developer.yelp.com/reference/v3_business_search.
  { name: "attributes", type: arrayType(stringType), optional: true },

  // Suggestion to the search algorithm that the results be sorted by one of the these modes: best_match, rating, review_count or distance.
  // The default is best_match.
  { name: "sort_by", type: stringType, optional: true },

  // Number of results to return
  { name: "limit", type: int32Type },

  // Offset the list of returned results by this amount.
  { name: "offset", type: int32Type, optional: true },
] as const)

const yelpBusinessesHttpServiceSchema = [
  {
    kind: "get",
    value: {
      name: "search",
      query: yelpApiBusinessesSearchRequestType,
      response: {
        kind: "json",
        value: objectType([
          { name: "businesses", type: arrayType(yelpApiBusinessType) },
        ] as const),
      },
    },
  },
] as const

function normalizeBusinessFromYelp(business: YelpApiBusiness): YelpBusiness {
  return {
    id: business.id,
    alias: business.alias,
    name: business.name,
    imageUrl: business.url,
    isClosed: business.is_closed,
    url: business.url,
    reviewCount: business.review_count,
    categories: business.categories,
    rating: business.rating,
    geoLocation: business.coordinates,
    price: business.price,
    displayAddress: business.location?.display_address,
    phone: business.phone,
    displayPhone: business.display_phone,
    distance: business.distance,
  }
}

export async function yelpBusinessesSearch(
  scope: Scope,
  request: YelpBusinessesSearchRequest
): Promise<YelpBusinessesSearchResponse> {
  const client = buildHttpServiceClient(yelpBusinessesHttpServiceSchema, {
    ...defaultBuildHttpServiceClientOptions(
      "https://api.yelp.com/v3/businesses"
    ),
    headers: [{ name: "Authorization", value: `Bearer ${yelpApiKey}` }],
  })
  const cancelToken = checkAndGetCancelToken(scope)
  const signal = cancelTokenToAbortSignal(cancelToken)
  const response = await client.get_search.fetch(
    {
      latitude: request.geoLocation.latitude,
      longitude: request.geoLocation.longitude,
      term: request.term,
      radius: request.radius,
      categories:
        request.categories === undefined
          ? undefined
          : request.categories.join(","),
      price: request.price === undefined ? undefined : request.price.join(","),
      open_now: request.openNow,
      open_at: request.openAt,
      attributes: request.attributes,
      sort_by: request.sortBy,
      limit: request.limit,
      offset: request.offset,
    },
    signal
  )
  return {
    businesses: response.businesses.map((business) =>
      normalizeBusinessFromYelp(business)
    ),
  }
}
