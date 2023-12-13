import {
  findHttpHeader,
  HttpHeader,
  httpHeadersToFetchHeaders,
} from "base-core/lib/http.js"
import {
  ServiceHttpSchema,
  ResponseHttpSchema,
  GetMethodHttpSchema,
  PostMethodHttpSchema,
  CookQueryHttpSchema,
  CookResponseHttpSchema,
  CookRequestHttpSchema,
  buildHttpQuerySearchParams,
  EndpointHttpSchema,
  CookServiceEndpointKey,
  valueToHttpJson,
  PutMethodHttpSchema,
} from "base-core/lib/http-schema.js"
import { dispatchOneOf } from "base-core/lib/one-of.js"
import {
  BytesReadable,
  bytesReadableToArrayBuffer,
} from "base-core/lib/stream.js"
import {
  coreNormalizer,
  commonNormalizer,
} from "base-core/lib/types-common.js"

function buildResponse(
  schema: ResponseHttpSchema,
  response: Response
): unknown {
  if (!response.ok) {
    throw new Error(
      `fetch() failed: ${response.status} - ${response.statusText}`
    )
  }
  return dispatchOneOf(schema, {
    empty: async () => undefined,
    stream: async () => response.body,
    bytes: async () => new Uint8Array(await response.arrayBuffer()),
    json: async (type) =>
      commonNormalizer(type, (await response.json()) as unknown) as unknown,
  })
}

export type CookHttpServiceEndpoint<E extends EndpointHttpSchema> = E extends {
  readonly kind: "get"
  readonly value: GetMethodHttpSchema<any>
}
  ? {
      buildUrl: (query: CookQueryHttpSchema<E["value"]["query"]>) => string
      fetch: (
        query: CookQueryHttpSchema<E["value"]["query"]>,
        signal: AbortSignal
      ) => Promise<CookResponseHttpSchema<E["value"]["response"]>>
    }
  : E extends {
      readonly kind: "post"
      readonly value: PostMethodHttpSchema
    }
  ? {
      fetch: (
        request: CookRequestHttpSchema<E["value"]["request"]>,
        signal: AbortSignal
      ) => Promise<CookResponseHttpSchema<E["value"]["response"]>>
    }
  : E extends {
      readonly kind: "put"
      readonly value: PutMethodHttpSchema
    }
  ? {
      fetch: (
        request: CookRequestHttpSchema<E["value"]["request"]>,
        signal: AbortSignal
      ) => Promise<CookResponseHttpSchema<E["value"]["response"]>>
    }
  : never

export type CookHttpServiceClient<T extends ServiceHttpSchema> =
  T extends readonly [
    infer E extends EndpointHttpSchema,
    ...infer Rest extends ServiceHttpSchema
  ]
    ? {
        [K in CookServiceEndpointKey<E>]: CookHttpServiceEndpoint<E>
      } & CookHttpServiceClient<Rest>
    : {}

export interface BuildHttpServiceClientOptions {
  readonly baseUrl: string
  readonly headers: HttpHeader[]
}

export function defaultBuildHttpServiceClientOptions(
  baseUrl: string
): BuildHttpServiceClientOptions {
  return {
    baseUrl,
    headers: [],
  }
}

export function buildHttpServiceClient<S extends ServiceHttpSchema>(
  schema: S,
  options: BuildHttpServiceClientOptions
): CookHttpServiceClient<S> {
  const client: Record<string, unknown> = {}
  for (const methodSchema of schema) {
    dispatchOneOf(methodSchema, {
      get: (getSchema) => {
        const buildUrl = (query: Record<string, unknown>) => {
          query = coreNormalizer(getSchema.query, query) as Record<
            string,
            unknown
          >
          const params = buildHttpQuerySearchParams(getSchema.query, query)
          const search = params.toString()
          return `${options.baseUrl}/${getSchema.name}${
            search === "" ? "" : `?${search}`
          }`
        }
        const doFetch = async (
          query: Record<string, unknown>,
          signal: AbortSignal
        ) => {
          const response = await fetch(buildUrl(query), {
            method: "GET",
            signal,
            headers: httpHeadersToFetchHeaders(options.headers),
          })
          return buildResponse(getSchema.response, response)
        }
        client[`get_${getSchema.name}`] = {
          buildUrl,
          fetch: doFetch,
        }
      },
      post: (postSchema) => {
        const doFetch = async (request: unknown, signal: AbortSignal) => {
          const {
            data,
            contentType,
          }: { data: unknown; contentType: string | undefined } =
            await dispatchOneOf(postSchema.request, {
              empty: async () => ({ data: undefined, contentType: undefined }),
              bytes: async () => ({
                data: request,
                contentType: "application/octet-stream",
              }),
              json: async (type) => ({
                data: JSON.stringify(valueToHttpJson(type, request)),
                contentType: "application/json",
              }),
              stream: async () => ({
                data: await bytesReadableToArrayBuffer(
                  request as BytesReadable
                ),
                contentType: "application/octet-stream",
              }),
            })
          const headers = httpHeadersToFetchHeaders(options.headers)
          if (
            contentType !== undefined &&
            findHttpHeader(options.headers, "Content-Type") === undefined
          ) {
            headers.append("Content-Type", contentType)
          }
          const response = await fetch(
            `${options.baseUrl}/${postSchema.name}`,
            {
              method: "POST",
              body: data as any,
              signal,
              headers,
            }
          )
          return buildResponse(postSchema.response, response)
        }
        client[`post_${postSchema.name}`] = {
          fetch: doFetch,
        }
      },
      put: (putSchema) => {
        const doFetch = async (request: unknown, signal: AbortSignal) => {
          const {
            data,
            contentType,
          }: { data: unknown; contentType: string | undefined } =
            await dispatchOneOf(putSchema.request, {
              empty: async () => ({ data: undefined, contentType: undefined }),
              bytes: async () => ({
                data: request,
                contentType: "application/octet-stream",
              }),
              json: async (type) => ({
                data: JSON.stringify(valueToHttpJson(type, request)),
                contentType: "application/json",
              }),
              stream: async () => ({
                data: await bytesReadableToArrayBuffer(
                  request as BytesReadable
                ),
                contentType: "application/octet-stream",
              }),
            })
          const headers = httpHeadersToFetchHeaders(options.headers)
          if (
            contentType !== undefined &&
            findHttpHeader(options.headers, "Content-Type") === undefined
          ) {
            headers.append("Content-Type", contentType)
          }
          const response = await fetch(`${options.baseUrl}/${putSchema.name}`, {
            method: "PUT",
            body: data as any,
            signal,
            headers,
          })
          return buildResponse(putSchema.response, response)
        }
        client[`put_${putSchema.name}`] = {
          fetch: doFetch,
        }
      },
    })
  }
  return client as CookHttpServiceClient<S>
}
