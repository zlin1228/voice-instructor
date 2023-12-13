import {
  Type,
  CookType,
  ObjectType,
  ObjectSpec,
  ArrayType,
  StringType,
  BooleanType,
  NullableType,
  TimestampType,
  DoubleType,
  Int32Type,
  BinaryType,
  UnionType,
  MapType,
} from "./types.js"
import { BytesReadable } from "./stream.js"
import { OneOf, OneOfSubValue } from "./one-of.js"
import { Scope } from "./scope.js"
import { CoreClosure, coreNormalizer } from "./types-common.js"
import { bytesToBase64 } from "./data.js"
import { isNotUndefined } from "./utils.js"

export type QueryHttpSchema<Spec extends ObjectSpec<CoreClosure>> = ObjectType<
  CoreClosure,
  Spec
>

export type StreamHttpSchema = undefined

export type BytesHttpSchema = undefined

export type EmptyHttpSchema = undefined

export type JsonHttpSchema<T> = Type<CoreClosure, T>

export type RequestHttpSchema = OneOf<{
  stream: StreamHttpSchema
  bytes: BytesHttpSchema
  empty: EmptyHttpSchema
  json: JsonHttpSchema<any>
}>

export type ResponseHttpSchema = OneOf<{
  stream: StreamHttpSchema
  bytes: BytesHttpSchema
  empty: EmptyHttpSchema
  json: JsonHttpSchema<any>
}>

export interface GetMethodHttpSchema<Spec extends ObjectSpec<CoreClosure>> {
  name: string
  query: QueryHttpSchema<Spec>
  response: ResponseHttpSchema
}

export interface PostMethodHttpSchema {
  name: string
  request: RequestHttpSchema
  response: ResponseHttpSchema
}

export interface PutMethodHttpSchema {
  name: string
  request: RequestHttpSchema
  response: ResponseHttpSchema
}

export type EndpointHttpSchema = OneOf<{
  get: GetMethodHttpSchema<any>
  post: PostMethodHttpSchema
  put: PutMethodHttpSchema
}>

export type ServiceHttpSchema = readonly EndpointHttpSchema[]

export type CookQueryHttpSchema<T extends QueryHttpSchema<any>> = CookType<T>

export type CookRequestHttpSchema<T extends RequestHttpSchema> = {
  stream: BytesReadable
  bytes: Uint8Array
  empty: void
  json: CookType<OneOfSubValue<T, "json">>
}[T["kind"]]

export type CookResponseHttpSchema<T extends ResponseHttpSchema> = {
  stream: BytesReadable
  bytes: Uint8Array
  empty: void
  json: CookType<OneOfSubValue<T, "json">>
}[T["kind"]]

export type CookServiceEndpointKey<T extends EndpointHttpSchema> = {
  get: `get_${T["value"]["name"]}`
  post: `post_${T["value"]["name"]}`
  put: `put_${T["value"]["name"]}`
}[T["kind"]]

export type CookServiceEndpointValue<T extends EndpointHttpSchema> = {
  get: (
    scope: Scope,
    query: CookQueryHttpSchema<OneOfSubValue<T, "get">["query"]>
  ) => Promise<CookResponseHttpSchema<OneOfSubValue<T, "get">["response"]>>
  post: (
    scope: Scope,
    request: CookRequestHttpSchema<OneOfSubValue<T, "post">["request"]>
  ) => Promise<CookResponseHttpSchema<OneOfSubValue<T, "post">["response"]>>
  put: (
    scope: Scope,
    request: CookRequestHttpSchema<OneOfSubValue<T, "put">["request"]>
  ) => Promise<CookResponseHttpSchema<OneOfSubValue<T, "put">["response"]>>
}[T["kind"]]

export type CookServiceHttpSchema<T extends ServiceHttpSchema> =
  T extends readonly [
    infer E extends EndpointHttpSchema,
    ...infer Rest extends ServiceHttpSchema
  ]
    ? {
        [K in CookServiceEndpointKey<E>]: CookServiceEndpointValue<E>
      } & CookServiceHttpSchema<Rest>
    : {}

export function buildHttpQuerySearchParams<
  Spec extends ObjectSpec<CoreClosure>
>(
  querySchema: QueryHttpSchema<Spec>,
  query: CookType<ObjectType<CoreClosure, Spec>>
): URLSearchParams {
  const q = coreNormalizer(querySchema, query)
  const params = new URLSearchParams()
  querySchema.destructObject(q, ({ name, optional, type }, value) => {
    if (value === undefined) return
    const valueToText = <T>(
      type: Type<CoreClosure, T>,
      value: T
    ): string | undefined => {
      return type.extractValue<string | undefined>(value, {
        [StringType.symbol]: (type, value) => value,
        [DoubleType.symbol]: (type, value) => value.toString(),
        [Int32Type.symbol]: (type, value) => value.toString(),
        [ObjectType.symbol]: (type, value) => JSON.stringify(value),
        [ArrayType.symbol]: (type, value) => JSON.stringify(value),
        [MapType.symbol]: (type, value) => JSON.stringify(value),
        [BooleanType.symbol]: (type, value) => (value ? "true" : "false"),
        [TimestampType.symbol]: (type, value) => value.getTime().toString(),
        [BinaryType.symbol]: (type, value) => bytesToBase64(value),
        [NullableType.symbol]: (type, value) =>
          value === null ? undefined : valueToText(type.type, value),
      })
    }
    const s = valueToText(type, value)
    if (s !== undefined) {
      params.append(name, s)
    }
  })
  return params
}

export function valueToHttpJson<T>(
  type: Type<CoreClosure, T>,
  value: T
): unknown {
  return type.extractValue(value, {
    [StringType.symbol]: (type, value) => value,
    [DoubleType.symbol]: (type, value) => value,
    [Int32Type.symbol]: (type, value) => value,
    [ObjectType.symbol]: (type, value) =>
      Object.fromEntries(
        type
          .destructObject(value, (field, value) => {
            return value === undefined
              ? undefined
              : [field.name, valueToHttpJson(field.type, value)]
          })
          .filter(isNotUndefined)
      ) as unknown,
    [ArrayType.symbol]: (type, value) =>
      value.map((v) => valueToHttpJson(type.type, v)),
    [MapType.symbol]: (type, value) =>
      Object.fromEntries(
        Object.entries(value).map(([k, v]) => [
          k,
          valueToHttpJson(type.type, v),
        ])
      ),
    [BooleanType.symbol]: (type, value) => value,
    [TimestampType.symbol]: (type, value) => value,
    [BinaryType.symbol]: (type, value) => bytesToBase64(value),
    [NullableType.symbol]: (type, value) =>
      value === null ? undefined : valueToHttpJson(type.type, value),
  })
}
