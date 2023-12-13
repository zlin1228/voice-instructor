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

// TODO: Handle product variants (lookup variants for a product, buy a specific variant)

export const shoppingProductSearchRequestType = objectType([
  // Valid retailers:
  //  - `amazon`
  { name: "retailer", type: stringType },

  { name: "query", type: stringType },

  // TODO: Add pagination
] as const)

export type ShoppingProductSearchRequest = CookType<
  typeof shoppingProductSearchRequestType
>

export const shoppingSearchProductType = objectType([
  { name: "productId", type: stringType },
  { name: "title", type: stringType },
  { name: "imageUrl", type: stringType },
  { name: "numReviews", type: doubleType, optional: true },
  { name: "stars", type: stringType, optional: true },

  // The price in cents.
  { name: "price", type: doubleType, optional: true },
] as const)

export type ShoppingSearchProduct = CookType<typeof shoppingSearchProductType>

export const shoppingProductSearchResponseType = objectType([
  {
    name: "results",
    type: arrayType(shoppingSearchProductType),
  },
] as const)

export type ShoppingProductSearchResponse = CookType<
  typeof shoppingProductSearchResponseType
>

// https://docs.zincapi.com/#create-an-order
// When placing order, we should restrict the order by max price and max shipping days to ensure the actual order matches user's expectation

export const shoppingOrderProductType = objectType([
  { name: "productId", type: stringType },
  { name: "quantity", type: int32Type },
  {
    name: "sellerSelectionCriteria",
    type: objectType([
      { name: "maxItemPrice", type: doubleType },
      { name: "handlingDaysMax", type: int32Type },
    ] as const),
  },
] as const)

export type ShoppingOrderProduct = CookType<typeof shoppingOrderProductType>

export const shoppingAddressType = objectType([
  { name: "firstName", type: stringType },
  { name: "lastName", type: stringType },
  { name: "addressLine1", type: stringType },
  { name: "addressLine2", type: stringType, optional: true },
  { name: "zipCode", type: stringType },
  { name: "city", type: stringType },

  // The USPS abbreviation for the state of the address (e.g. CA)
  { name: "state", type: stringType },

  // The ISO abbreviation for the country of the address (e.g. US)
  // See https://www.theodora.com/country_digraphs.html
  { name: "country", type: stringType },

  { name: "phoneNumber", type: stringType },
  { name: "instructions", type: stringType, optional: true },
] as const)

export type ShoppingAddress = CookType<typeof shoppingAddressType>

export const shoppingCreateOrderRequestType = objectType([
  { name: "idempotencyKey", type: stringType },
  { name: "retailer", type: stringType },
  { name: "products", type: arrayType(shoppingOrderProductType) },
  { name: "shippingAddress", type: shoppingAddressType },
  // Can be "cheapest", "fastest", "free"
  { name: "shippingMethod", type: stringType },
  { name: "maxPrice", type: doubleType },
] as const)

export type ShoppingCreateOrderRequest = CookType<
  typeof shoppingCreateOrderRequestType
>

export const shoppingCreateOrderResponseType = objectType([
  { name: "ok", type: booleanType },
  { name: "orderId", type: stringType, optional: true },
  { name: "errorCode", type: stringType, optional: true },
  { name: "errorMessage", type: stringType, optional: true },
  { name: "errorData", type: stringType, optional: true },
] as const)

export type ShoppingCreateOrderResponse = CookType<
  typeof shoppingCreateOrderResponseType
>

export const shoppingEndpoints = [
  {
    kind: "post",
    value: {
      name: "shoppingProductSearch",
      request: {
        kind: "json",
        value: shoppingProductSearchRequestType,
      },
      response: {
        kind: "json",
        value: shoppingProductSearchResponseType,
      },
    },
  },
  {
    kind: "post",
    value: {
      name: "shoppingCreateOrder",
      request: {
        kind: "json",
        value: shoppingCreateOrderRequestType,
      },
      response: {
        kind: "json",
        value: shoppingCreateOrderResponseType,
      },
    },
  },
] as const
