import { IndexableMap } from "./algo/index-collection.js"
import { PriorityIndex } from "./algo/priority-index.js"
import { comparatorChain, comparatorExtract } from "./array.js"
import { abortIfUndefined } from "./debug.js"
import { log } from "./logging.js"
import { makeThrottledAsyncProcessor, Scope, sleepSeconds } from "./scope.js"
import { randomLinear } from "./utils.js"

export type ResourceConsumer<T> = <R>(
  scope: Scope,
  consume: (resource: T) => Promise<R>
) => Promise<R>

export function makeSingleResourceConsumer<T>(
  resource: T
): ResourceConsumer<T> {
  return async <R>(
    scope: Scope,
    consume: (resource: T) => Promise<R>
  ): Promise<R> => {
    return await consume(resource)
  }
}

interface ResourceState<T> {
  readonly resource: T
  readonly concurrency: number
  readonly bannedUntil: Date | undefined
  readonly healthy: number | undefined
  readonly lastComplete: Date | undefined
  readonly obsoleted: boolean
}

export interface ResourcePoolOptions<T> {
  readonly workerCount: number
  readonly concurrencyLimits: number[]
  readonly softRetryLimit: number
  readonly hardRetryLimit: number
}

export function buildDefaultResourcePoolOptions<T>(): ResourcePoolOptions<T> {
  return {
    workerCount: 100,
    concurrencyLimits: [1],
    softRetryLimit: 5,
    hardRetryLimit: 20,
  }
}

export class ResourcePool<T> {
  #isResourceAvailable<T>(state: ResourceState<T>): boolean {
    return (
      !state.obsoleted &&
      state.bannedUntil === undefined &&
      (state.healthy === undefined ||
        (this.#options.concurrencyLimits[state.healthy] ?? 1) >
          state.concurrency)
    )
  }

  readonly #healthIndex = new PriorityIndex<string, ResourceState<T>>(
    comparatorChain(
      comparatorExtract((s) => {
        return this.#isResourceAvailable(s) ? 0 : 1
      }),
      comparatorExtract((s) => {
        return -(s.healthy ?? 0)
      })
    )
  )

  readonly #resourceMap = new IndexableMap<string, ResourceState<T>>([
    this.#healthIndex,
  ])

  readonly #options: ResourcePoolOptions<T>
  readonly #processor: <R>(task: () => Promise<R>) => Promise<R>

  #pendingCount = 0

  constructor(scope: Scope, options: ResourcePoolOptions<T>) {
    this.#options = options
    this.#processor = makeThrottledAsyncProcessor(
      scope,
      this.#options.workerCount
    )
  }

  addResource(key: string, resource: T): void {
    const s = this.#resourceMap.get(key)
    if (s === undefined) {
      this.#resourceMap.set(key, {
        resource,
        concurrency: 0,
        bannedUntil: undefined,
        healthy: undefined,
        lastComplete: undefined,
        obsoleted: false,
      })
    } else if (s.obsoleted) {
      this.#resourceMap.set(key, {
        ...s,
        obsoleted: false,
      })
    }
  }

  obsoleteResource(key: string): void {
    const s = this.#resourceMap.get(key)
    if (s === undefined) {
      return
    }
    this.#resourceMap.set(key, {
      ...s,
      obsoleted: true,
    })
  }

  async #allocateAvailableResource(
    scope: Scope
  ): Promise<[string, ResourceState<T>]> {
    for (;;) {
      const r = this.#healthIndex.first()
      if (r !== undefined) {
        const [key, state] = r
        if (this.#isResourceAvailable(state)) {
          const newState = {
            ...state,
            concurrency: state.concurrency + 1,
          }
          this.#resourceMap.set(key, newState)
          return [key, newState]
        }
      }
      log.info("No resource is available. Sleeping...")
      await sleepSeconds(scope, randomLinear(20, 19))
    }
  }

  get consumer(): ResourceConsumer<T> {
    return async <R>(
      scope: Scope,
      consume: (resource: T) => Promise<R>
    ): Promise<R> => {
      ++this.#pendingCount
      try {
        return await this.#processor(async () => {
          // let softRetry = this.#options.softRetryLimit
          // let hardRetry = this.#options.hardRetryLimit
          for (;;) {
            const [key, state] = await this.#allocateAvailableResource(scope)
            try {
              const result = await consume(state.resource)
              const s = abortIfUndefined(this.#resourceMap.get(key))
              this.#resourceMap.set(key, {
                ...s,
                concurrency: s.concurrency - 1,
                healthy:
                  s.healthy === undefined
                    ? 0
                    : Math.max(
                        0,
                        Math.min(
                          s.healthy + 1,
                          this.#options.concurrencyLimits.length - 1
                        )
                      ),
                lastComplete: new Date(),
              })
            } catch (e) {
              const s = abortIfUndefined(this.#resourceMap.get(key))
              const healthy =
                s.healthy === undefined
                  ? -1
                  : Math.max(
                      -2,
                      Math.min(
                        s.healthy + 1,
                        this.#options.concurrencyLimits.length - 1
                      )
                    )
            }
          }
          throw new Error()
        })
      } finally {
        --this.#pendingCount
      }
    }
  }
}
