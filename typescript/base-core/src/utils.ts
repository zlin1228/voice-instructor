import { abortIfThrow } from "./debug.js"

export function dispatchUnion<T extends string | number, R>(
  value: T,
  dispatcher: {
    [K in T]: (value: K) => R
  }
): R {
  return dispatcher[value](value)
}

export function dispatchUnionWithType<T extends string | number>(
  value: T
): <R>(dispatcher: {
  [K in T]: (value: K) => R
}) => R {
  return (dispatcher) => dispatcher[value](value)
}

export function dispatchHeterogeneous<
  U extends string,
  R extends { [K in U]: unknown },
  V extends U
>(value: V, dispatcher: { [K in U]: () => R[K] }): R[V] {
  return dispatcher[value]()
}

export function isNotUndefined<T>(x: T | undefined): x is T {
  return x !== undefined
}

export type Constructor<T> = new (...args: any[]) => T

export function isInstanceOf<
  T, // This verifies that the type being check by the returned function makes sense
  C extends T
>(c: Constructor<C>): (x: T) => x is C {
  return (x): x is C => x instanceof c
}

export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value)
}

export function forceSetProperty(
  obj: object,
  name: string | number | symbol,
  value: unknown
) {
  const objAsAny = obj as any
  objAsAny[name] = value
}

export function forceGetProperty(
  obj: object,
  name: string | number | symbol
): unknown {
  return (obj as any)[name]
}

export function forceCallMethod(
  obj: object,
  name: string | number | symbol,
  ...args: unknown[]
): unknown {
  return (forceGetProperty(obj, name) as (...args: unknown[]) => unknown).call(
    obj,
    ...args
  )
}

export async function swallowException<T>(
  fn: () => Promise<T>,
  swallow: (error: unknown) => boolean = (err) => err instanceof Error
): Promise<T | undefined> {
  try {
    return await fn()
  } catch (error) {
    if (swallow(error)) {
      return undefined
    }
    throw error
  }
}

// This function executes an async function and returns immediately.
// The async function shouldn't throw any exception.
// It's useful for starting an async function in a sync function.
export function flyingPromise(fn: () => Promise<void>): void {
  void abortIfThrow(fn)
}

export function buildPromise<T = void>(): {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (err: Error) => void
} {
  let resolve: (value: T) => void = () => {
    throw new Error("Invalid execution flow")
  }
  let reject: (err: Error) => void = () => {
    throw new Error("Invalid execution flow")
  }
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

export function callSequentially<
  Fn extends (this: unknown, ...args: Parameters<Fn>) => void
>(
  ...fns: (Fn | undefined)[]
): (this: unknown, ...args: Parameters<Fn>) => void {
  return (...args: Parameters<Fn>) => {
    for (const fn of fns) {
      fn?.(...args)
    }
  }
}

export function bind<
  T,
  K extends keyof {
    [KK in keyof T as T[KK] extends (this: T, ...args: any[]) => unknown
      ? KK
      : never]: T[KK]
  }
>(thiz: T, key: K) {
  return (
    ...args: T[K] extends (this: T, ...args: infer Args) => unknown
      ? Args
      : never
  ): T[K] extends (this: T, ...args: any[]) => infer R ? R : never => {
    return (
      thiz[key] as unknown as (
        this: T,
        ...args: T[K] extends (this: T, ...args: infer Args) => unknown
          ? Args
          : never
      ) => T[K] extends (this: T, ...args: any[]) => infer R ? R : never
    )(...args)
  }
}

export function bindConstructor<Ctor extends new (...args: never[]) => unknown>(
  ctor: Ctor
): (...args: ConstructorParameters<Ctor>) => InstanceType<Ctor> {
  return (...args) => new ctor(...args) as InstanceType<Ctor>
}

export function randomLinear(center: number, deviation: number): number {
  return center - deviation + Math.random() * deviation * 2
}
