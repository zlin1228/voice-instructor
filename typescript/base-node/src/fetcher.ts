import { bytesToString } from "base-core/lib/data.js"
import { Scope } from "base-core/lib/scope.js"

export type DataFetcher = (scope: Scope, uri: string) => Promise<Uint8Array>

export type ResourceFetcher = <R>(
  scope: Scope,
  uri: string,
  extractor: (bytes: Uint8Array) => Promise<R>
) => Promise<R>

export function makeDummyDataFetcher(): DataFetcher {
  return async (scope: Scope, uri: string): Promise<Uint8Array> => {
    throw new Error(`Dummy data fetcher cannot fetch resource ${uri}`)
  }
}

export function makeDataResourceFetcher(
  dataFetcher: DataFetcher
): ResourceFetcher {
  return async <R>(
    scope: Scope,
    uri: string,
    extractor: (bytes: Uint8Array) => Promise<R>
  ): Promise<R> => {
    const bytes = await dataFetcher(scope, uri)
    return await extractor(bytes)
  }
}

export function makeRetryResourceFetcher(
  resourceFetcher: ResourceFetcher,
  retryLimit: number
): ResourceFetcher {
  return async <R>(
    scope: Scope,
    uri: string,
    extractor: (bytes: Uint8Array) => Promise<R>
  ): Promise<R> => {
    let retry = 0
    for (;;) {
      try {
        return await resourceFetcher(scope, uri, extractor)
      } catch (e) {
        if (retry === retryLimit) throw e
        ++retry
      }
    }
  }
}

export function stringFetcher(
  resourceFetcher: ResourceFetcher
): (scope: Scope, uri: string) => Promise<string> {
  return async (scope: Scope, uri: string): Promise<string> => {
    return await resourceFetcher(scope, uri, async (bytes) =>
      bytesToString(bytes)
    )
  }
}

// export function makeRateLimitedResourceFetcher(
//   fetcher: DataFetcher,
//   waitSeconds: number
// ): DataFetcher {
//   const rateLimiter = new RateLimiter(waitSeconds, 0)
//   return async (scope: Scope, uri: string): Promise<BytesReadable> => {
//     await rateLimiter.delay(scope)
//     return await fetcher(scope, uri)
//   }
// }
