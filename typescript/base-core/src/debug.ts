import { Constructor, forceGetProperty } from "./utils.js"

export interface StackFrame {
  fileName: string
  lineNumber?: number | undefined
  columnNumber?: number | undefined
  functionName?: string | undefined
}

export interface DebugProvider {
  abort: (why: unknown) => Error
  captureStackTrace: (frameDepth: number, limit: number) => StackFrame[]
}

export class DefaultDebugProvider implements DebugProvider {
  abort(why: unknown): Error {
    console.error("Abort!", why)
    // eslint-disable-next-line no-debugger
    debugger
    throw new Error(`Abort - ${String(why)}`)
  }
  captureStackTrace(frameDepth: number, limit: number): StackFrame[] {
    return []
  }
  toString() {
    return "base-core"
  }
}

let globalDebugProvider = new DefaultDebugProvider()

export function setDebugProvider(debugProvider: DebugProvider) {
  console.log(`Set debug provider to [${String(debugProvider)}]`)
  globalDebugProvider = debugProvider
}

export function abort(why: unknown = "(unknown)"): Error {
  throw globalDebugProvider.abort(why)
}

export function captureStackTrace(
  frameDepth: number,
  limit: number
): StackFrame[] {
  return globalDebugProvider.captureStackTrace(frameDepth + 1, limit)
}

export function abortIfUndefined<T>(
  value: T | undefined
): undefined extends T ? unknown : T {
  if (value === undefined) {
    throw abort("Value is undefined unexpectedly")
  }
  return value
}

export function abortIfNull<T>(value: T | null): null extends T ? unknown : T {
  if (value === null) {
    throw abort("Value is null unexpectedly")
  }
  return value
}

export function abortIfNullish<T>(
  value: T | undefined | null
): undefined | null extends T ? unknown : T {
  if (value === undefined || value === null) {
    throw abort("Value is nullish unexpectedly")
  }
  return value
}

export async function abortIfThrow<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    throw abort(["Unexpected exception", fn.toString(), error])
  }
}

export function abortIfNotEqual<T>(v0: T, v1: T): T {
  if (v0 !== v1) {
    throw abort(
      `Expect values are equal to each other: [${String(v0)}] vs. [${String(
        v1
      )}]`
    )
  }
  return v0
}

export function asStringOrAbort(value: unknown): string {
  if (typeof value !== "string") {
    throw abort(`The value should be a string: ${String(value)}`)
  }
  return value
}

export function asInstanceOrAbort<T>(ctor: Constructor<T>, value: unknown): T {
  if (!(value instanceof ctor)) {
    throw abort(`The value should be an instance of: ${String(ctor)}`)
  }
  return value
}

export function forcedTimeout<T>(
  promise: Promise<T>,
  seconds: number
): Promise<T> {
  return new Promise((resolve, reject) => {
    let expired = false
    const timeoutId = setTimeout(() => {
      expired = true
      console.log("Forced Timeout!!")
      reject(new Error("Function timeout"))
    }, seconds * 1000)
    try {
      promise
        .then((value) => {
          if (expired) return
          clearTimeout(timeoutId)
          resolve(value)
        })
        .catch((err) => {
          if (expired) return
          clearTimeout(timeoutId)
          reject(err)
        })
    } catch (e) {
      reject(e)
      clearTimeout(timeoutId)
    }
  })
}
