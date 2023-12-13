import { arraySliceVector } from "./array.js"
import { InputChannel, makeChannel, OutputChannel } from "./concurrency.js"
import { abort, abortIfThrow, abortIfUndefined } from "./debug.js"
import { log } from "./logging.js"
import {
  OneOf,
  dispatchOneOf,
  ValueOrError,
  catchErrorAsync,
  asValueOrThrow,
} from "./one-of.js"
import { buildPromise, flyingPromise } from "./utils.js"

export type ScopeAttachment = [symbol, (scope: Scope) => Promise<unknown>]

let nextScopeId = 0

export class Scope {
  readonly #scopeId = nextScopeId++
  readonly #parent: Scope | undefined
  readonly #children = new Set<Scope>()
  readonly #attachments = new Map<symbol, unknown>()
  readonly #onLeaveListeners: (() => Promise<void>)[] = []
  readonly #body: Function
  #left = false

  private constructor(parent: Scope | undefined, body: Function) {
    this.#parent = parent
    this.#body = body
  }

  getAttachment(key: symbol): unknown {
    if (this.#attachments.has(key)) {
      return this.#attachments.get(key)
    }
    if (this.#parent !== undefined) {
      return this.#parent.getAttachment(key)
    }
    return undefined
  }

  static async with<T>(
    parent: Scope | undefined,
    attachments: Iterable<ScopeAttachment>,
    func: (scope: Scope) => Promise<T>
  ): Promise<T> {
    if (parent) {
      parent.abortIfLeft()
    }
    const scope = new Scope(parent, func)
    if (parent) {
      parent.#children.add(scope)
    }
    try {
      for (const [key, attachment] of attachments) {
        const value = await attachment(scope)
        scope.#attachments.set(key, value)
      }
      return await func(scope)
    } catch (e) {
      log.debug(`Leaving scope with exception: ${String(e)}`)
      throw e
    } finally {
      while (scope.#onLeaveListeners.length > 0) {
        const listener = abortIfUndefined(scope.#onLeaveListeners.pop())
        await abortIfThrow(listener)
      }
      if (scope.#children.size !== 0) {
        log.info("Parent scope:")
        console.log(scope.#body.toString())
        for (const child of scope.#children) {
          log.info("Child scope:")
          console.log(child.#body.toString())
        }
        throw abort("Cannot leave the scope before all children finish")
      }
      scope.#left = true
      if (parent) {
        parent.#children.delete(scope)
      }
    }
  }

  private abortIfLeft(): void {
    if (this.#left) {
      abort("Cannot call any methods after leaving the scope")
    }
  }

  get parent(): Scope | undefined {
    return this.#parent
  }

  onLeave(listener: () => Promise<void>): void {
    this.abortIfLeft()
    this.#onLeaveListeners.push(listener)
  }

  toString(): string {
    return `Scope[${this.#scopeId}]`
  }
}

export type PendingValue<T> = OneOf<{
  pending: undefined // This is not a promise because it would allow user to attach a listener whose lifecycle exceeds the scope
  ready: T
}>

export interface Signal<T> {
  get(this: Signal<T>): PendingValue<T>
  onceReady(this: Signal<T>, scope: Scope, listener: (value: T) => void): void
  waitUntilReady(this: Signal<T>, scope: Scope): Promise<T>
}

export class SignalController<T> implements Signal<T> {
  #state: PendingValue<T> = { kind: "pending", value: undefined }
  #listeners = new Map<symbol, (value: T) => void>()

  emit(value: T): void {
    if (this.#state.kind !== "pending") {
      throw abort("Cannot call Signal.emit() more than once")
    }
    this.#state = { kind: "ready", value }
    for (const listener of [...this.#listeners.values()].reverse()) {
      listener(value)
    }
  }

  get(): PendingValue<T> {
    return this.#state
  }

  onceReady(scope: Scope, listener: (value: T) => void): void {
    dispatchOneOf(this.#state, {
      pending: () => {
        const key = Symbol()
        this.#listeners.set(key, listener)
        scope.onLeave(async () => {
          this.#listeners.delete(key)
        })
      },
      ready: (value) => {
        listener(value)
      },
    })
  }

  waitUntilReady(scope: Scope): Promise<T> {
    const cancelToken = checkAndGetCancelToken(scope)
    return new Promise<T>((resolve, reject) => {
      dispatchOneOf(this.#state, {
        pending: () => {
          const key = Symbol()
          this.#listeners.set(key, (value) => {
            resolve(value)
          })
          cancelToken.onCancel(async (error) => {
            this.#listeners.delete(key)
            reject(error)
          })
        },
        ready: (value) => {
          resolve(value)
        },
      })
    })
  }
}

export interface Broadcast<T> {
  listen(this: Broadcast<T>, scope: Scope, listener: (value: T) => void): void
}

export class BroadcastController<T> implements Broadcast<T> {
  #listeners = new Map<symbol, (value: T) => void>()

  emit(value: T): void {
    for (const listener of [...this.#listeners.values()].reverse()) {
      listener(value)
    }
  }

  listen(scope: Scope, listener: (value: T) => void): void {
    const key = Symbol()
    this.#listeners.set(key, listener)
    scope.onLeave(async () => {
      this.#listeners.delete(key)
    })
  }
}

export function mapBroadcast<T, R>(
  broadcast: Broadcast<T>,
  fn: (value: T) => R | undefined
): Broadcast<NonNullable<R>> {
  return {
    listen(scope, listener) {
      broadcast.listen(scope, (value) => {
        const r = fn(value)
        if (r === undefined || r === null) return
        listener(r)
      })
    },
  }
}

export class CanceledError extends Error {
  constructor() {
    super("Canceled")
  }
}

// Why not AbortController?
// Because AbortError is not available in NodeJS.
export interface CancelToken {
  get cancelReason(): Error | undefined
  onCancel(fn: (reason: Error) => Promise<void>): void
}

const cancelSignalAttachmentKey = Symbol("CancelSignal")

function getCancelSignalAttachment(
  scope: Scope | undefined
): Signal<Error> | undefined {
  return scope?.getAttachment(cancelSignalAttachmentKey) as
    | Signal<Error>
    | undefined
}

const noopCancelToken: CancelToken = {
  get cancelReason() {
    return undefined
  },
  onCancel(fn: (reason: Error) => Promise<void>) {
    // do nothing
  },
}

export function buildAttachmentForCancellation(inherit: boolean): {
  cancel: (reason: Error) => void
  attachment: ScopeAttachment
} {
  const ctrl = new SignalController<Error>()
  return {
    cancel: (reason: Error) => {
      if (ctrl.get().kind === "pending") {
        ctrl.emit(reason)
      }
    },
    attachment: [
      cancelSignalAttachmentKey,
      async (scope) => {
        if (inherit) {
          getCancelSignalAttachment(scope)?.onceReady(scope, (reason) => {
            if (ctrl.get().kind === "pending") {
              ctrl.emit(reason)
            }
          })
        }
        return ctrl
      },
    ],
  }
}

export async function runCancellableScope<T>(
  scope: Scope,
  body: (scope: Scope, cancel: (reason: Error) => void) => Promise<T>
): Promise<T | undefined> {
  const { cancel, attachment } = buildAttachmentForCancellation(true)
  const reasonHolder: { current: Error | undefined } = { current: undefined }
  const bodyCancel = (reason: Error) => {
    if (reasonHolder.current !== undefined) return
    reasonHolder.current = reason
    cancel(reason)
  }
  return await Scope.with(scope, [attachment], async (scope) => {
    try {
      return await body(scope, bodyCancel)
    } catch (e) {
      if (e === reasonHolder.current) {
        return undefined
      }
      throw e
    }
  })
}

export async function sleepSeconds(
  scope: Scope,
  seconds: number
): Promise<void> {
  if (seconds < 0) return
  await Scope.with(scope, [], async (scope) => {
    const cancelToken = checkAndGetCancelToken(scope)
    await new Promise<void>((resolve, reject) => {
      const cancelReason = cancelToken.cancelReason
      if (cancelReason) {
        reject(cancelReason)
        return
      }
      const timeoutId = setTimeout(resolve, seconds * 1000)
      cancelToken.onCancel(async (reason) => {
        clearTimeout(timeoutId)
        reject(reason)
      })
    })
  })
}

export async function sleepUntil(scope: Scope, time: Date): Promise<void> {
  const currentTime = new Date()
  const seconds = (time.getTime() - currentTime.getTime()) / 1000
  await sleepSeconds(scope, seconds)
}

export async function sleepUntilCancel(scope: Scope): Promise<Error> {
  const cancelToken = checkAndGetCancelToken(scope)
  const { promise, resolve } = buildPromise<Error>()
  cancelToken.onCancel(async (error) => resolve(error))
  return await promise
}

export class TimeoutError extends CanceledError {}

export function buildAttachmentForTimeout(seconds: number): ScopeAttachment {
  const { cancel, attachment } = buildAttachmentForCancellation(true)
  return [
    attachment[0],
    async (scope) => {
      const timeoutId = setTimeout(() => {
        cancel(new TimeoutError())
      }, seconds * 1000)
      scope.onLeave(async () => {
        clearTimeout(timeoutId)
      })
      return attachment[1](scope)
    },
  ]
}

export function checkAndGetCancelToken(scope: Scope | undefined): CancelToken {
  const ctrl = getCancelSignalAttachment(scope)
  if (ctrl === undefined) return noopCancelToken
  return dispatchOneOf(ctrl.get(), {
    pending: () => {
      const cancelToken: CancelToken = {
        get cancelReason(): Error | undefined {
          return ctrl.get().value
        },
        onCancel(fn: (reason: Error) => Promise<void>): void {
          if (scope === undefined) {
            throw abort("Invalid state")
          }
          let p: Promise<void> | undefined = undefined
          scope.onLeave(async () => {
            await p
          })
          ctrl.onceReady(scope, (reason) => {
            const { promise, resolve } = buildPromise()
            p = promise
            flyingPromise(async () => {
              await fn(reason)
              resolve()
            })
          })
        },
      }
      return cancelToken
    },
    ready: (value) => {
      throw value
    },
  })
}

export function cancelTokenToAbortSignal(
  cancelToken: CancelToken
): AbortSignal {
  const abortController = new AbortController()
  cancelToken.onCancel(async () => {
    abortController.abort()
  })
  return abortController.signal
}

export function checkAndGetAbortSignal(scope: Scope): AbortSignal {
  const cancelToken = checkAndGetCancelToken(scope)
  return cancelTokenToAbortSignal(cancelToken)
}

export function forceAbandonWhenCancel<T>(
  scope: Scope,
  fn: () => Promise<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    try {
      const cancelToken = checkAndGetCancelToken(scope)
      cancelToken.onCancel(async (reason) => {
        reject(reason)
      })
      fn()
        .then((value) => {
          if (cancelToken.cancelReason !== undefined) return
          resolve(value)
        })
        .catch((err) => {
          if (cancelToken.cancelReason !== undefined) return
          reject(err)
        })
    } catch (e) {
      reject(e)
    }
  })
}

export class ResourcePool<Key, T> {
  readonly #map = new Map<
    Key,
    {
      signal: Signal<ValueOrError<T>>
      cancel: (reason: Error) => void
      refCount: number
    }
  >()
  readonly #scope: Scope
  readonly #resourceAllocator: (
    key: Key,
    scope: Scope
  ) => Promise<{ resource: T; cleanup: () => Promise<void> }>

  constructor(
    scope: Scope,
    resourceAllocator: (
      key: Key,
      scope: Scope
    ) => Promise<{ resource: T; cleanup: () => Promise<void> }>
  ) {
    this.#scope = scope
    this.#resourceAllocator = resourceAllocator
  }

  private retrieveOrAllocate(key: Key): {
    signal: Signal<ValueOrError<T>>
    cancel: (reason: Error) => void
  } {
    const signal = new SignalController<ValueOrError<T>>()
    const { cancel, attachment } = buildAttachmentForCancellation(true)
    flyingPromise(async () => {
      await Scope.with(this.#scope, [attachment], async (scope) => {
        const result = await catchErrorAsync(
          Error,
          async () => await this.#resourceAllocator(key, scope)
        )
        if (result.kind === "value") {
          this.#scope.onLeave(async () => await result.value.cleanup())
        }
        signal.emit(
          dispatchOneOf(result, {
            value: (value) => ({ kind: "value", value: value.resource }),
            error: (error) => ({ kind: "error", value: error }),
          })
        )
      })
    })
    return { signal, cancel }
  }

  async fetchResource(
    this: ResourcePool<Key, T>,
    scope: Scope,
    key: Key
  ): Promise<T> {
    return await Scope.with(scope, [], async (scope: Scope) => {
      const cancelToken = checkAndGetCancelToken(scope)
      let entry = this.#map.get(key)
      if (entry === undefined) {
        const { signal, cancel } = this.retrieveOrAllocate(key)
        entry = {
          signal,
          cancel,
          refCount: 0,
        }
      }
      const newEntry = entry
      ++newEntry.refCount
      scope.onLeave(async () => {
        --newEntry.refCount
        if (
          newEntry.refCount === 0 &&
          newEntry.signal.get().kind === "pending"
        ) {
          newEntry.cancel(new Error("No longer needed"))
          this.#map.delete(key)
        }
      })
      return await new Promise<T>((resolve, reject) => {
        cancelToken.onCancel(async (error) => {
          reject(error)
        })
        newEntry.signal.onceReady(scope, (valueOrError) => {
          dispatchOneOf(valueOrError, {
            value: resolve,
            error: reject,
          })
        })
      })
    })
  }
}

export function launchBackgroundScope(
  scope: Scope,
  fn: (scope: Scope) => Promise<void>
) {
  const { cancel, attachment } = buildAttachmentForCancellation(false)
  const err = new Error("Foreground scope is leaving")
  const promise = Scope.with(scope, [attachment], fn).catch((e) => {
    if (e === err) return
    console.log(fn.toString())
    console.log(e)
    throw abort("Cannot throw from background scope")
  })
  scope.onLeave(async () => {
    cancel(err)
    try {
      await promise
    } catch (e) {
      if (e === err) return
    }
  })
}

export async function runParallelScopes<R>(
  scope: Scope,
  tasks: ((scope: Scope) => Promise<R>)[]
): Promise<R[]> {
  const promises = tasks.map(async (task) => {
    return await abortIfThrow(async () => await Scope.with(scope, [], task))
  })
  return await Promise.all(promises)
}

export function makeThrottledTaskProcessor<T, R>(
  scope: Scope,
  handler: (task: T) => Promise<R>,
  workerCount: number
): (task: T) => Promise<R> {
  const outputChPromise = buildPromise<
    OutputChannel<{
      task: T
      resolve: (value: ValueOrError<R>) => void
    }>
  >()
  const scopePromise = buildPromise()
  const inputCh = makeChannel<{
    task: T
    resolve: (value: ValueOrError<R>) => void
  }>(scope, async (outputCh) => {
    outputChPromise.resolve(outputCh)
    await scopePromise.promise
  })
  for (let i = 0; i < workerCount; ++i) {
    flyingPromise(async () => {
      for (;;) {
        const { value, done } = await inputCh.pull()
        if (done) return
        const result = await catchErrorAsync(Error, async () =>
          handler(value.task)
        )
        value.resolve(result)
      }
    })
  }
  scope.onLeave(async () => scopePromise.resolve())
  return async (task: T): Promise<R> => {
    const outputCh = await outputChPromise.promise
    const taskPromise = buildPromise<ValueOrError<R>>()
    await outputCh.push({ task, resolve: taskPromise.resolve })
    return asValueOrThrow(await taskPromise.promise)
  }
}

export function makeThrottledAsyncProcessor(
  scope: Scope,
  workerCount: number
): <R>(task: () => Promise<R>) => Promise<R> {
  const processor = makeThrottledTaskProcessor(
    scope,
    async (task: () => Promise<void>) => await task(),
    workerCount
  )
  return async <R>(task: () => Promise<R>): Promise<R> => {
    let result: ValueOrError<R> | undefined
    await processor(async () => {
      result = await catchErrorAsync(Error, async () => await task())
    })
    return asValueOrThrow<R, Error>(abortIfUndefined(result))
  }
}

export class HandlingQueue<T> {
  #queue: readonly T[] = []
  #handler: (scope: Scope, value: T) => Promise<void>
  #promiseController = buildPromise()

  constructor(
    scope: Scope,
    handler: (scope: Scope, value: T) => Promise<void>
  ) {
    this.#handler = handler
    launchBackgroundScope(scope, async (scope) => {
      await this.#runHandling(scope)
    })
  }

  currentQueue(): readonly T[] {
    return this.#queue
  }

  updateQueue(queue: readonly T[]): void {
    this.#queue = queue
    this.#promiseController.resolve()
    this.#promiseController = buildPromise()
  }

  pushBack(value: T): void {
    this.updateQueue([...this.#queue, value])
  }

  pushFront(value: T): void {
    this.updateQueue([value, ...this.#queue])
  }

  async #runHandling(scope: Scope): Promise<void> {
    const cancelToken = checkAndGetCancelToken(scope)
    cancelToken.onCancel(async () => {
      this.#promiseController.resolve()
    })
    while (cancelToken.cancelReason === undefined) {
      const headVec = arraySliceVector(this.#queue, 1, 0)
      if (headVec !== undefined) {
        this.#queue = this.#queue.slice(1)
        const value = headVec[0]
        await this.#handler(scope, value)
      } else {
        await this.#promiseController.promise
      }
    }
  }
}
