import { abort, abortIfThrow } from "./debug.js"
import { Scope, sleepSeconds } from "./scope.js"
import { flyingPromise, buildPromise } from "./utils.js"

export class RateLimiter {
  constructor(private waitSeconds: number, private lastTimestamp = 0) {}

  async delay(scope: Scope): Promise<void> {
    for (;;) {
      const now = Date.now()
      if (now - this.lastTimestamp >= this.waitSeconds * 1000) {
        this.lastTimestamp = now
        break
      }
      await sleepSeconds(
        scope,
        this.waitSeconds - (now - this.lastTimestamp) / 1000
      )
    }
  }
}

export async function* iterableToAsync<T>(
  iterable: Iterable<T>
): AsyncGenerator<T> {
  for (const value of iterable) {
    yield value
  }
}

export async function asyncIterableToArray<T>(
  iterable: AsyncIterable<T>
): Promise<T[]> {
  const result: T[] = []
  for await (const value of iterable) {
    result.push(value)
  }
  return result
}

export interface OutputChannel<T> {
  push(value: T): Promise<void>
  tryPush(value: T): boolean
}

export interface InputChannel<T> {
  pull(): Promise<{ value: T; done: false } | { value: undefined; done: true }>
  tryPull():
    | { value: T; done: false; ok: true }
    | { value: undefined; done: true; ok: true }
    | { value: undefined; done: false; ok: false }
}

export function makeChannel<T>(
  scope: Scope,
  fn: (channel: OutputChannel<T>) => Promise<void>
): InputChannel<T> {
  interface PushingState {
    type: "pushing"
    pushing: { promise: Promise<void>; resolve: () => void }
    value: T
  }
  interface PullingState {
    type: "pulling"
    pulling: {
      promise: Promise<
        { value: T; done: false } | { value: undefined; done: true }
      >
      resolve: (
        result: { value: T; done: false } | { value: undefined; done: true }
      ) => void
    }
  }
  interface IdleState {
    type: "idle"
  }
  interface ClosedState {
    type: "closed"
  }
  let state: PushingState | PullingState | IdleState | ClosedState = {
    type: "idle",
  }
  scope.onLeave(async () => {
    if (state.type !== "closed") {
      abort("Channel is not drained")
    }
  })
  flyingPromise(async () => {
    await abortIfThrow(async () => {
      await fn({
        tryPush(value: T): boolean {
          if (state.type === "closed") {
            throw abort("Cannot push to closed channel")
          }
          if (state.type === "pulling") {
            state.pulling.resolve({ value, done: false })
            state = { type: "idle" }
            return true
          }
          return false
        },
        async push(value: T): Promise<void> {
          // Pushing => Pushing
          while (state.type === "pushing") {
            await state.pushing.promise
          }
          // Closed => <error>
          if (state.type === "closed") {
            throw abort("Cannot push to closed channel")
          }
          // Pulling => Idle
          if (state.type === "pulling") {
            state.pulling.resolve({ value, done: false })
            state = { type: "idle" }
            return
          }
          // Idle => Pushing
          state = {
            type: "pushing",
            pushing: buildPromise(),
            value,
          }
          await state.pushing.promise
        },
      })
      if (state.type === "pushing") {
        abort("Cannot close a channel when it is being pushed")
      }
      if (state.type === "closed") {
        abort("Cannot close a channel more than once")
      }
      if (state.type === "pulling") {
        state.pulling.resolve({ value: undefined, done: true })
      }
      state = { type: "closed" }
    })
  })
  return {
    tryPull():
      | { value: T; done: false; ok: true }
      | { value: undefined; done: true; ok: true }
      | { value: undefined; done: false; ok: false } {
      // Pushing => Idle
      if (state.type === "pushing") {
        const value = state.value
        state.pushing.resolve()
        state = { type: "idle" }
        return { value, done: false, ok: true }
      }
      // Closed => Closed
      if (state.type === "closed") {
        return { value: undefined, done: true, ok: true }
      }
      return { value: undefined, done: false, ok: false }
    },

    async pull(): Promise<
      { value: T; done: false } | { value: undefined; done: true }
    > {
      // Pulling => Pulling
      while (state.type === "pulling") {
        await state.pulling.promise
      }
      // Pushing => Idle
      if (state.type === "pushing") {
        const value = state.value
        state.pushing.resolve()
        state = { type: "idle" }
        return { value, done: false }
      }
      // Closed => Closed
      if (state.type === "closed") {
        return { value: undefined, done: true }
      }
      // Idle => Pulling
      state = {
        type: "pulling",
        pulling: buildPromise(),
      }
      return state.pulling.promise
    },
  }
}

export async function drainChannel<T>(channel: InputChannel<T>): Promise<void> {
  while (!(await channel.pull()).done) {
    // do nothing
  }
}

export function asyncIterableToChannel<T>(
  scope: Scope,
  iterable: AsyncIterable<T>
): InputChannel<T> {
  return makeChannel<T>(scope, async (channel) => {
    for await (const value of iterable) {
      await channel.push(value)
    }
  })
}

export async function* channelToAsyncIterable<T>(
  channel: InputChannel<T>
): AsyncGenerator<T> {
  for (;;) {
    const { value, done } = await channel.pull()
    if (done) {
      break
    }
    yield value
  }
}

export function transformChannel<In, Out>(
  scope: Scope,
  inputChannel: InputChannel<In>,
  transform: (value: In) => Promise<Out>,
  concurrency = 1
): InputChannel<Out> {
  return makeChannel<Out>(scope, async (outputChannel: OutputChannel<Out>) => {
    const worker = async () => {
      for (;;) {
        const { value, done } = await inputChannel.pull()
        if (done) {
          break
        }
        const r = await abortIfThrow(async () => await transform(value))
        await outputChannel.push(r)
      }
    }
    const promises: Promise<void>[] = []
    for (let i = 0; i < concurrency; ++i) {
      promises.push(worker())
    }
    await Promise.all(promises)
  })
}

export async function transformArray<In, Out>(
  values: readonly In[],
  transform: (value: In) => Promise<Out>,
  concurrency = 1
): Promise<Out[]> {
  return await Scope.with(undefined, [], async (scope) => {
    const result: Out[] = new Array<Out>(values.length)
    const inputChannel = asyncIterableToChannel(
      scope,
      iterableToAsync(values.entries())
    )
    const outputChannel = transformChannel(
      scope,
      inputChannel,
      async ([index, value]) => {
        result[index] = await transform(value)
      },
      concurrency
    )
    await drainChannel(outputChannel)
    return result
  })
}

export function transformAsyncIterable<In, Out>(
  scope: Scope,
  inputIterable: AsyncIterable<In>,
  transform: (value: In) => Promise<Out>,
  concurrency = 1
): AsyncGenerator<Out> {
  const inputChannel = asyncIterableToChannel(scope, inputIterable)
  const outputChannel = transformChannel(
    scope,
    inputChannel,
    transform,
    concurrency
  )
  return channelToAsyncIterable(outputChannel)
}

export async function* mapAsyncIterable<In, Out>(
  inputIterable: AsyncIterable<In>,
  fn: (value: In) => Out
): AsyncGenerator<Out> {
  for await (const value of inputIterable) {
    yield fn(value)
  }
}

export async function mapArrayAsync<T, R>(
  values: readonly T[],
  fn: (value: T) => Promise<R>
): Promise<R[]> {
  const result: R[] = []
  for (const value of values) {
    result.push(await fn(value))
  }
  return result
}

export function makeAbortController(
  scope: Scope,
  signal: AbortSignal
): AbortController {
  const controller = new AbortController()
  if (signal.aborted) {
    controller.abort()
    return controller
  }
  function onAbort() {
    controller.abort()
    signal.removeEventListener("abort", onAbort)
  }
  signal.addEventListener("abort", onAbort)
  scope.onLeave(async () => {
    signal.removeEventListener("abort", onAbort)
  })
  return controller
}

export async function retryable<R>(
  times: number,
  fn: (retryCount: number) => Promise<R>
): Promise<R> {
  for (let i = 0; ; ++i) {
    try {
      return await fn(i)
    } catch (e) {
      if (i === times) {
        throw e
      }
    }
  }
}
