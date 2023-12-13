import { bytesToBase64, stringToBytes } from "base-core/lib/data.js"
import { log } from "base-core/lib/logging.js"
import {
  cancelTokenToAbortSignal,
  checkAndGetCancelToken,
  Scope,
} from "base-core/lib/scope.js"
import {
  arrayType,
  booleanType,
  CookType,
  doubleType,
  int32Type,
  nullableType,
  objectType,
  stringType,
} from "base-core/lib/types.js"
import {
  buildHttpServiceClient,
  defaultBuildHttpServiceClientOptions,
} from "base-node/lib/service.js"
import {
  ShoppingAddress,
  ShoppingCreateOrderRequest,
  ShoppingCreateOrderResponse,
  ShoppingOrderProduct,
  ShoppingProductSearchRequest,
  ShoppingProductSearchResponse,
} from "cm-quantum-peripheral-common/lib/schema/shopping.js"

const zincApiKey = "627419F764B1A028C5316403"
const zincTestCredentials: ZincApiCredentials = {
  email: "developer@cybermanufacture.co",
  password: "m5YUgEVMck8cFDhe",
}

// TODO: Use Product Offers API to retrieve product price
// https://docs.zincapi.com/#product-offers

// https://docs.zincapi.com/#product-search

const zincApiProductSearchRequestType = objectType([
  { name: "retailer", type: stringType },
  { name: "query", type: stringType },
  { name: "page", type: int32Type },
] as const)

const zincApiProductSearchResponseType = objectType([
  { name: "status", type: stringType },
  {
    name: "results",
    type: arrayType(
      objectType([
        { name: "product_id", type: stringType },
        { name: "title", type: stringType },
        { name: "image", type: stringType },
        { name: "num_reviews", type: nullableType(doubleType) },
        { name: "stars", type: nullableType(stringType) },
        { name: "price", type: nullableType(doubleType) },
      ] as const)
    ),
  },
] as const)

// https://docs.zincapi.com/#create-an-order

const zincApiOrderProductType = objectType([
  { name: "product_id", type: stringType },
  { name: "quantity", type: int32Type },
  {
    name: "seller_selection_criteria",
    type: objectType([
      // e.g. ["New"]
      { name: "condition_in", type: arrayType(stringType) },
      { name: "max_item_price", type: doubleType },
      { name: "handling_days_max", type: int32Type },
    ] as const),
  },
] as const)

type ZincApiOrderProduct = CookType<typeof zincApiOrderProductType>

const zincApiAddressType = objectType([
  { name: "first_name", type: stringType },
  { name: "last_name", type: stringType },
  { name: "address_line1", type: stringType },
  { name: "address_line2", type: stringType, optional: true },
  { name: "zip_code", type: stringType },
  { name: "city", type: stringType },
  { name: "state", type: stringType },
  { name: "country", type: stringType },
  { name: "phone_number", type: stringType },
  { name: "instructions", type: stringType, optional: true },
] as const)

type ZincApiAddress = CookType<typeof zincApiAddressType>

const zincApiCredentialsType = objectType([
  { name: "email", type: stringType },
  { name: "password", type: stringType },
  { name: "verification_code", type: stringType, optional: true },
  { name: "totp_2fa_key", type: stringType, optional: true },
] as const)

type ZincApiCredentials = CookType<typeof zincApiCredentialsType>

const zincApiCreateOrderRequestType = objectType([
  { name: "idempotency_key", type: stringType },
  { name: "retailer", type: stringType },
  { name: "products", type: arrayType(zincApiOrderProductType) },
  { name: "shipping_address", type: zincApiAddressType },
  // Can be "cheapest", "fastest", "amazon_day", "free"
  { name: "shipping_method", type: stringType },
  { name: "billing_address", type: zincApiAddressType, optional: true },
  {
    name: "payment_method",
    type: objectType([{ name: "use_gift", type: booleanType }] as const),
    optional: true,
  },
  {
    name: "retailer_credentials",
    type: zincApiCredentialsType,
    optional: true,
  },
  { name: "max_price", type: doubleType },
  { name: "addax", type: booleanType, optional: true },
] as const)

type ZincApiCreateOrderRequest = CookType<typeof zincApiCreateOrderRequestType>

const zincApiCreateOrderResponseType = objectType([
  { name: "request_id", type: stringType, optional: true },
  { name: "_type", type: stringType, optional: true },
  { name: "code", type: stringType, optional: true },
  { name: "message", type: stringType, optional: true },
  { name: "data", type: objectType([] as const), optional: true },
] as const)

type ZincApiCreateOrderResponse = CookType<
  typeof zincApiCreateOrderResponseType
>

const zincHttpServiceSchema = [
  {
    kind: "get",
    value: {
      name: "search",
      query: zincApiProductSearchRequestType,
      response: {
        kind: "json",
        value: zincApiProductSearchResponseType,
      },
    },
  },
  {
    kind: "post",
    value: {
      name: "orders",
      request: {
        kind: "json",
        value: zincApiCreateOrderRequestType,
      },
      response: {
        kind: "json",
        value: zincApiCreateOrderResponseType,
      },
    },
  },
] as const

export async function shoppingProductSearch(
  scope: Scope,
  request: ShoppingProductSearchRequest
): Promise<ShoppingProductSearchResponse> {
  const client = buildHttpServiceClient(zincHttpServiceSchema, {
    ...defaultBuildHttpServiceClientOptions("https://api.zinc.io/v1"),
    headers: [
      {
        name: "Authorization",
        value: `Basic ${bytesToBase64(stringToBytes(`${zincApiKey}:`))}`,
      },
    ],
  })
  const cancelToken = checkAndGetCancelToken(scope)
  const signal = cancelTokenToAbortSignal(cancelToken)
  const response = await client.get_search.fetch(
    {
      retailer: request.retailer,
      query: request.query,
      page: 1,
    },
    signal
  )
  return {
    results: response.results.map((result) => ({
      productId: result.product_id,
      title: result.title,
      imageUrl: result.image,
      numReviews: result.num_reviews ?? undefined,
      stars: result.stars ?? undefined,
      price: result.price ?? undefined,
    })),
  }
}

function buildZincOrderProduct(
  orderProduct: ShoppingOrderProduct
): ZincApiOrderProduct {
  return {
    product_id: orderProduct.productId,
    quantity: orderProduct.quantity,
    seller_selection_criteria: {
      condition_in: ["New"],
      max_item_price: orderProduct.sellerSelectionCriteria.maxItemPrice,
      handling_days_max: orderProduct.sellerSelectionCriteria.handlingDaysMax,
    },
  }
}

function buildZincAddress(address: ShoppingAddress): ZincApiAddress {
  return {
    first_name: address.firstName,
    last_name: address.lastName,
    address_line1: address.addressLine1,
    address_line2: address.addressLine2,
    zip_code: address.zipCode,
    city: address.city,
    state: address.state,
    country: address.country,
    phone_number: address.phoneNumber,
    instructions: address.instructions,
  }
}

function buildZincCreateOrderRequest(
  request: ShoppingCreateOrderRequest
): ZincApiCreateOrderRequest {
  return {
    idempotency_key: request.idempotencyKey,
    retailer: request.retailer,
    products: request.products.map((p) => buildZincOrderProduct(p)),
    shipping_address: buildZincAddress(request.shippingAddress),
    shipping_method: request.shippingMethod,
    billing_address: buildZincAddress(request.shippingAddress),
    payment_method: {
      use_gift: true,
    },
    retailer_credentials: zincTestCredentials,
    max_price: request.maxPrice,
  }
}

function normalizeCreateOrderResponse(
  response: ZincApiCreateOrderResponse
): ShoppingCreateOrderResponse {
  if (response._type === "error" || response.request_id === undefined) {
    log.info("Got a failure response from Zinc")
    console.log(response)
    return {
      ok: false,
      errorCode: response.code,
      errorMessage: response.message,
      errorData: JSON.stringify(response.data),
    }
  }
  return {
    ok: true,
    orderId: response.request_id,
  }
}

export async function shoppingCreateOrder(
  scope: Scope,
  request: ShoppingCreateOrderRequest
): Promise<ShoppingCreateOrderResponse> {
  const client = buildHttpServiceClient(zincHttpServiceSchema, {
    ...defaultBuildHttpServiceClientOptions("https://api.zinc.io/v1"),
    headers: [
      {
        name: "Authorization",
        value: `Basic ${bytesToBase64(stringToBytes(`${zincApiKey}:`))}`,
      },
    ],
  })
  const cancelToken = checkAndGetCancelToken(scope)
  const signal = cancelTokenToAbortSignal(cancelToken)
  const response = await client.post_orders.fetch(
    buildZincCreateOrderRequest(request),
    signal
  )
  return normalizeCreateOrderResponse(response)
}
