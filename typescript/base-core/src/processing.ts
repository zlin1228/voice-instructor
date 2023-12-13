import { Queue } from "./algo/queue.js"
import { arrayRepeat, arraySequence, arrayZip2, byKey } from "./array.js"
import { abort, abortIfUndefined, asInstanceOrAbort } from "./debug.js"
import { log } from "./logging.js"
import { catchErrorAsync, OneOf } from "./one-of.js"
import {
  buildAttachmentForCancellation,
  checkAndGetCancelToken,
  launchBackgroundScope,
  Scope,
  sleepSeconds,
} from "./scope.js"
import { buildPromise, flyingPromise, swallowException } from "./utils.js"

export type BatchProcessorHandler<T, R = void> =
  | ((values: T[]) => Promise<readonly R[] | (R extends void ? void : never)>)
  | undefined

export class BatchProcessor<T, R = undefined> {
  #scope: Scope
  #batchSize: number
  #delaySeconds: number
  #cancelDelay: ((err: Error) => void) | undefined
  #handler: BatchProcessorHandler<T, R>
  #tasks: {
    value: T
    resolve: (result: R) => void
    reject: (err: Error) => void
  }[] = []

  constructor(scope: Scope, batchSize: number, delaySeconds: number) {
    this.#scope = scope
    this.#batchSize = batchSize
    this.#delaySeconds = delaySeconds
  }

  async flush(): Promise<void> {
    if (this.#cancelDelay) {
      this.#cancelDelay(new Error("Canceled"))
      this.#cancelDelay = undefined
    }
    const currentTasks = this.#tasks
    if (currentTasks.length === 0) return
    this.#tasks = []
    try {
      const result = await abortIfUndefined(this.#handler)(
        currentTasks.map(byKey("value"))
      )
      for (const [task, r] of abortIfUndefined(
        arrayZip2(
          currentTasks,
          result === undefined || result === null
            ? arrayRepeat(undefined, currentTasks.length)
            : result
        )
      )) {
        task.resolve(r as R)
      }
    } catch (e) {
      for (const task of currentTasks) {
        task.reject(asInstanceOrAbort(Error, e))
      }
    }
  }

  async process(value: T, fn: BatchProcessorHandler<T, R>): Promise<R> {
    this.#handler = fn
    const { promise, resolve, reject } = buildPromise<R>()
    this.#tasks.push({
      value,
      resolve,
      reject,
    })
    if (this.#tasks.length >= this.#batchSize) {
      await this.flush()
    } else if (!this.#cancelDelay) {
      const { cancel, attachment } = buildAttachmentForCancellation(true)
      this.#cancelDelay = cancel
      await Scope.with(this.#scope, [attachment], async (scope) => {
        await swallowException(async () => {
          await sleepSeconds(scope, this.#delaySeconds)
          if (this.#cancelDelay !== cancel) return
          log.info("Flush due to timeout")
          await this.flush()
        })
      })
    }
    return await promise
  }
}

export type IteratorItem<T> = OneOf<{
  value: T
  done: Error | undefined
}>

export class IteratorProducer<T> {
  readonly #iterator: AsyncIterator<T>
  #pending: Queue<() => void> | undefined
  #doneItem: IteratorItem<T> | undefined

  constructor(iterator: AsyncIterator<T>) {
    this.#iterator = iterator
  }

  async pull(): Promise<IteratorItem<T>> {
    if (this.#pending !== undefined) {
      const { promise, resolve } = buildPromise()
      this.#pending.pushBack(resolve)
      await promise
    }
    if (this.#doneItem !== undefined) {
      if (this.#pending !== undefined) {
        while (this.#pending.size() !== 0) {
          this.#pending.popFront()?.()
        }
        this.#pending = undefined
      }
      return this.#doneItem
    }
    if (this.#pending === undefined) {
      this.#pending = new Queue()
    }
    const result = await catchErrorAsync(
      Error,
      async () => await this.#iterator.next()
    )
    if (this.#pending.size() === 0) {
      this.#pending = undefined
    } else {
      this.#pending.popFront()?.()
    }
    if (result.kind === "value") {
      if (result.value.done !== true) {
        return { kind: "value", value: result.value.value }
      } else {
        this.#doneItem = {
          kind: "done",
          value: undefined,
        }
      }
    } else {
      this.#doneItem = {
        kind: "done",
        value: result.value,
      }
      await this.#iterator.return?.()
    }
    return this.#doneItem
  }
}

export function buildAsyncGenerator<T>(
  fn: (push: (value: T) => Promise<void>) => Promise<void>
): AsyncGenerator<T> {
  // TODO: correctly handle when the generator is closed early
  const stateHolder: {
    state: OneOf<{
      waiting: { promise: Promise<void>; resolve: () => void }
      queue: Queue<{
        value: T
        resolve: () => void
        reject: (err: Error) => void
      }>
      done: Error | undefined
    }>
  } = {
    state: {
      kind: "waiting",
      value: buildPromise(),
    },
  }
  const push = async (value: T) => {
    if (stateHolder.state.kind === "done") {
      throw abort("Cannot push after the function left")
    }
    const { promise, resolve, reject } = buildPromise()
    if (stateHolder.state.kind === "waiting") {
      stateHolder.state.value.resolve()
      stateHolder.state = {
        kind: "queue",
        value: new Queue(),
      }
    }
    stateHolder.state.value.pushBack({
      value,
      resolve,
      reject,
    })
    await promise
  }
  const { promise, resolve } = buildPromise()
  flyingPromise(async () => {
    const valueOrError = await catchErrorAsync(
      Error,
      async () => await fn(push)
    )
    if (stateHolder.state.kind !== "waiting") {
      throw abort(
        "buildAsyncIterator: Cannot leave the function body before all pending pushings finish"
      )
    }
    stateHolder.state.value.resolve()
    stateHolder.state = {
      kind: "done",
      value: valueOrError.kind === "error" ? valueOrError.value : undefined,
    }
    resolve()
  })
  return (async function* () {
    try {
      for (;;) {
        while (stateHolder.state.kind === "waiting") {
          await stateHolder.state.value.promise
        }
        if (stateHolder.state.kind === "done") {
          if (stateHolder.state.value !== undefined) {
            throw stateHolder.state.value
          }
          return
        }
        const item = stateHolder.state.value.popFront()
        if (item === undefined) {
          throw abort()
        }
        if (stateHolder.state.value.size() === 0) {
          stateHolder.state = {
            kind: "waiting",
            value: buildPromise(),
          }
        }
        let settled = false
        try {
          yield item.value
          item.resolve()
          settled = true
        } catch (e) {
          item.reject(new Error("Failed to yield value", { cause: e }))
          settled = true
        } finally {
          if (!settled) {
            item.reject(new Error("AsyncGenerator aborted"))
          }
        }
      }
    } finally {
      await promise
    }
  })()
}

export function transformProcess<In, Out>(
  scope: Scope,
  iterator: AsyncIterator<In>,
  transform: (scope: Scope, value: In) => Promise<Out>,
  concurrency = 1
): AsyncGenerator<Out> {
  return buildAsyncGenerator(async (push) => {
    const { cancel, attachment } = buildAttachmentForCancellation(true)
    const producer = new IteratorProducer<In>(iterator)
    const promises = arraySequence(concurrency).map(async (wid) => {
      try {
        for (;;) {
          checkAndGetCancelToken(scope)
          const item = await producer.pull()
          if (item.kind === "done") {
            if (item.value !== undefined) {
              throw item.value
            }
            return
          }
          const out = await Scope.with(scope, [attachment], async (scope) => {
            return await transform(scope, item.value)
          })
          await push(out)
        }
      } catch (e) {
        cancel(asInstanceOrAbort(Error, e))
        throw e
      }
    })
    const result = await Promise.allSettled(promises)
    log.info("Finished transforming all items")
    for (const r of result) {
      if (r.status === "rejected") {
        log.info(
          "At least one of the items failed. Re-throwing its exception now."
        )
        throw r.reason
      }
    }
  })
}

function numberToText(x: number): string {
  if (x < 1000) {
    return x.toPrecision(3)
  }
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

function durationToText(seconds: number): string {
  const m = Math.ceil(seconds / 60)
  const h = Math.floor(m / 60)
  if (h === 0) {
    return `${m}m`
  }
  return `${h}h${m - h * 60}m`
}

export function logThroughput(
  scope: Scope,
  counterGetter: () => number,
  periodSeconds = 5
) {
  launchBackgroundScope(scope, async (scope) => {
    const startCounter = counterGetter()
    let lastCounter = 0
    const startTimestamp = new Date()
    let lastTimestamp = startTimestamp
    for (;;) {
      await sleepSeconds(
        scope,
        lastTimestamp.getTime() / 1000 + periodSeconds - Date.now() / 1000
      )
      const timestamp = new Date()
      const counter = counterGetter()
      const rt =
        ((counter - lastCounter) /
          Math.max(timestamp.getTime() - lastTimestamp.getTime(), 1)) *
        1000
      lastCounter = counter
      lastTimestamp = timestamp
      const avg =
        ((counter - startCounter) /
          Math.max(timestamp.getTime() - startTimestamp.getTime(), 1)) *
        1000
      log.info(
        `Processed ${numberToText(counter)} items. Throughput: ${numberToText(
          rt / 1000
        )}Ki s⁻¹ = ${((rt * 3600) / 1000000).toPrecision(
          3
        )}Mi h⁻¹ | ${numberToText(avg / 1000)}Ki s⁻¹ = ${(
          (avg * 3600) /
          1000000
        ).toPrecision(3)}Mi h⁻¹`
      )
    }
  })
}

export async function iteratorDrainAndLog(
  scope: Scope,
  iterable: AsyncIterable<void>,
  periodSeconds = 5
): Promise<void> {
  await Scope.with(scope, [], async (scope) => {
    let counter = 0
    logThroughput(scope, () => counter, periodSeconds)
    for await (const _ of iterable) {
      ++counter
    }
    log.info(`Done - Processed ${counter} items`)
  })
}

export async function iteratorToArrayAndLog<T>(
  scope: Scope,
  iterable: AsyncIterable<T>,
  periodSeconds = 5
): Promise<T[]> {
  const result: T[] = []
  await Scope.with(scope, [], async (scope) => {
    let counter = 0
    logThroughput(scope, () => counter, periodSeconds)
    for await (const value of iterable) {
      ++counter
      result.push(value)
    }
    log.info(`Done - Processed ${counter} items`)
  })
  return result
}

export type Scannable<T> =
  | Iterable<T>
  | Iterator<T>
  | AsyncIterable<T>
  | AsyncIterator<T>

export class Scanner<T> implements AsyncIterable<T> {
  #asyncIterable: AsyncIterable<T>
  #countEstimator: () => number | undefined

  constructor(
    asyncIterable: AsyncIterable<T>,
    countEstimator: () => number | undefined = () => undefined
  ) {
    this.#asyncIterable = asyncIterable
    this.#countEstimator = countEstimator
  }

  static fromSync<T>(iterable: Iterable<T> | readonly T[]): Scanner<T> {
    return new Scanner(
      (async function* () {
        for (const value of iterable) {
          yield value
        }
      })(),
      () => {
        if ("length" in iterable) {
          return iterable.length
        }
        return undefined
      }
    )
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return this.#asyncIterable[Symbol.asyncIterator]()
  }

  map<Out>(fn: (value: T, index: number) => Out): Scanner<Out> {
    const thiz = this
    return new Scanner(
      (async function* () {
        let index = 0
        for await (const value of thiz) {
          yield fn(value, index++)
        }
      })(),
      this.#countEstimator
    )
  }

  transform<Out>(
    scope: Scope,
    concurrency: number,
    fn: (scope: Scope, value: T, index: number) => Promise<Out>
  ): Scanner<Out> {
    return new Scanner(
      buildAsyncGenerator(async (push) => {
        const { cancel, attachment } = buildAttachmentForCancellation(true)
        const producer = new IteratorProducer<T>(this[Symbol.asyncIterator]())
        let index = 0
        const promises = arraySequence(concurrency).map(async (wid) => {
          try {
            for (;;) {
              checkAndGetCancelToken(scope)
              const item = await producer.pull()
              if (item.kind === "done") {
                if (item.value !== undefined) {
                  throw item.value
                }
                return
              }
              const out = await Scope.with(
                scope,
                [attachment],
                async (scope) => {
                  return await fn(scope, item.value, index++)
                }
              )
              await push(out)
            }
          } catch (e) {
            cancel(asInstanceOrAbort(Error, e))
            throw e
          }
        })
        const result = await Promise.allSettled(promises)
        log.info("Finished transforming all items")
        for (const r of result) {
          if (r.status === "rejected") {
            log.info(`At least one of the items failed. [${String(r.reason)}]`)
            throw r.reason
          }
        }
      }),
      this.#countEstimator
    )
  }

  async toArray(): Promise<T[]> {
    const values: T[] = []
    for await (const value of this) {
      values.push(value)
    }
    return values
  }

  chunk(size: number): Scanner<T[]> {
    const thiz = this
    return new Scanner(
      (async function* () {
        let batch: T[] = []
        for await (const value of thiz) {
          batch.push(value)
          if (batch.length >= size) {
            yield batch
            batch = []
          }
        }
        if (batch.length !== 0) {
          yield batch
        }
      })(),
      () => {
        const count = this.#countEstimator()
        if (count === undefined) return undefined
        return Math.ceil(count / size)
      }
    )
  }

  filter(fn: (value: T) => boolean): Scanner<T> {
    const thiz = this
    let total = 0
    let pass = 0
    return new Scanner(
      (async function* () {
        for await (const value of thiz) {
          ++total
          if (fn(value)) {
            ++pass
            yield value
          }
        }
      })(),
      () => {
        const count = this.#countEstimator()
        if (count === undefined) return undefined
        if (total === 0) return undefined
        return Math.ceil((count / total) * pass)
      }
    )
  }

  filterNullable(): Scanner<NonNullable<T>> {
    return this.filter((x) => x !== undefined && x !== null) as Scanner<
      NonNullable<T>
    >
  }

  logStats(scope: Scope, periodSeconds = 5): Scanner<T> {
    const thiz = this
    return new Scanner(
      buildAsyncGenerator(async (push) => {
        await Scope.with(scope, [], async (scope) => {
          let counter = 0
          let step = 0
          const startTimestamp = new Date()
          launchBackgroundScope(scope, async (scope) => {
            let lastCounter = 0
            let lastTimestamp = startTimestamp
            let rollingAvg: number | undefined = undefined
            for (;;) {
              await sleepSeconds(
                scope,
                lastTimestamp.getTime() / 1000 +
                  periodSeconds -
                  Date.now() / 1000
              )
              const timestamp = new Date()
              const rt =
                ((counter - lastCounter) /
                  Math.max(timestamp.getTime() - lastTimestamp.getTime(), 1)) *
                1000
              lastCounter = counter
              lastTimestamp = timestamp
              const avg =
                (counter /
                  Math.max(timestamp.getTime() - startTimestamp.getTime(), 1)) *
                1000
              ++step
              const weight = step <= 11 ? 0.5 : Math.pow(step - 10, -0.5)
              rollingAvg =
                rollingAvg === undefined
                  ? avg
                  : rollingAvg * (1 - weight) + rt * weight
              const total = thiz.#countEstimator()
              const remainSeconds =
                total === undefined || rollingAvg === 0 || total < counter
                  ? undefined
                  : (total - counter) / rollingAvg
              const remainTimeText =
                remainSeconds === undefined
                  ? ""
                  : ` [${durationToText(remainSeconds)}]`
              log.info(
                `${numberToText(counter)}${
                  total === undefined || total === 0
                    ? ""
                    : ` / ${numberToText(total)} = ${(
                        (counter / total) *
                        100
                      ).toFixed(0)}%`
                }${remainTimeText} | ${numberToText(rt / 1000)}Ki s⁻¹ = ${(
                  (rt * 3600) /
                  1000000
                ).toPrecision(3)}Mi h⁻¹ | ${numberToText(
                  rollingAvg / 1000
                )}Ki s⁻¹ = ${((rollingAvg * 3600) / 1000000).toPrecision(
                  3
                )}Mi h⁻¹`
              )
            }
          })
          for await (const value of thiz) {
            await push(value)
            ++counter
          }
          const totalSeconds = (Date.now() - startTimestamp.getTime()) / 1000
          log.info(
            `Done - Processed ${counter} items. Total Time: ${durationToText(
              totalSeconds
            )}`
          )
        })
      })
    )
  }

  setEstimatedCount(count: number): Scanner<T> {
    return new Scanner(this, () => count)
  }

  async drain(): Promise<void> {
    for await (const _ of this) {
      // do nothing
    }
  }
}
