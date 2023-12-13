import { Constructor } from "./utils.js"

export type OneOf<T extends Record<string, unknown>> = {
  [K in keyof T]: {
    readonly kind: K
    readonly value: T[K]
  }
}[keyof T]

export interface GenericOneOf {
  readonly kind: string
  readonly value: unknown
}

export type OneOfSub<
  T extends GenericOneOf,
  Kind extends T["kind"]
> = T extends {
  readonly kind: infer K extends Kind
  readonly value: infer V
}
  ? { readonly kind: K; readonly value: V }
  : never

export type OneOfValue<T extends GenericOneOf> = T extends {
  readonly kind: unknown
  readonly value: infer V
}
  ? V
  : never

export type OneOfKind<T extends GenericOneOf> = T extends {
  readonly kind: infer K
  readonly value: unknown
}
  ? K
  : never

export type OneOfSubValue<
  T extends GenericOneOf,
  Kind extends T["kind"]
> = OneOfValue<OneOfSub<T, Kind>>

export function dispatchOneOf<T extends GenericOneOf, R>(
  x: T,
  dispatcher: {
    [K in T["kind"]]: (value: OneOfSubValue<T, K>, kind: K) => R
  }
): R {
  const kind: T["kind"] = x.kind
  // The type constrait of the parameters doesn't seem right...
  return dispatcher[kind](x.value as OneOfSubValue<T, T["kind"]>, kind)
}

export async function dispatchOneOfAsync<T extends GenericOneOf, R>(
  x: T,
  dispatcher: {
    [K in T["kind"]]: (
      value: OneOfSubValue<T, K>,
      kv: OneOfSub<T, K>
    ) => Promise<R>
  }
): Promise<R> {
  const kind: T["kind"] = x.kind
  // The type constrait of the parameters doesn't seem right...
  return await dispatcher[kind](
    x.value as OneOfSubValue<T, T["kind"]>,
    x as unknown as OneOfSub<T, T["kind"]>
  )
}

export function translateOneOf<
  OneOfT extends GenericOneOf,
  TT extends OneOfT,
  R extends { [K in OneOfT["kind"]]: unknown }
>(
  x: TT,
  dispatcher: {
    [K in OneOfT["kind"]]: (value: OneOfSubValue<TT, K>, kind: K) => R[K]
  }
): R[TT["kind"]] {
  const kind: TT["kind"] = x.kind
  return dispatcher[kind](x.value as OneOfSubValue<OneOfT, TT["kind"]>, kind)
}

export function mapOneOf<
  OneOfT extends GenericOneOf,
  R extends GenericOneOf & { kind: OneOfT["kind"] }
>(): <TT extends OneOfT>(
  x: TT,
  dispatcher: {
    [K in OneOfT["kind"]]: (
      value: OneOfSubValue<TT, K>,
      kind: K
    ) => OneOfSubValue<R, K>
  }
) => OneOfSubValue<R, TT["kind"]> {
  return <TT extends OneOfT>(
    x: TT,
    dispatcher: {
      [K in OneOfT["kind"]]: (
        value: OneOfSubValue<TT, K>,
        kind: K
      ) => OneOfSubValue<R, K>
    }
  ): OneOfSubValue<R, TT["kind"]> => {
    const kind: TT["kind"] = x.kind
    return {
      kind,
      value: dispatcher[kind](x.value as OneOfSubValue<TT, TT["kind"]>, kind),
    } as OneOfSubValue<R, TT["kind"]>
  }
}

export function mapOneOfAsync<
  OneOfT extends GenericOneOf,
  R extends GenericOneOf & { kind: OneOfT["kind"] }
>(): <TT extends OneOfT>(
  x: TT,
  dispatcher: {
    [K in OneOfT["kind"]]: (
      value: OneOfSubValue<TT, K>,
      kind: K
    ) => Promise<OneOfSubValue<R, K>>
  }
) => Promise<OneOfSub<R, OneOfKind<TT>>> {
  return async <TT extends OneOfT>(
    x: TT,
    dispatcher: {
      [K in OneOfT["kind"]]: (
        value: OneOfSubValue<TT, K>,
        kind: K
      ) => Promise<OneOfSubValue<R, K>>
    }
  ): Promise<OneOfSub<R, OneOfKind<TT>>> => {
    const kind: TT["kind"] = x.kind
    return {
      kind,
      value: await dispatcher[kind](
        x.value as OneOfSubValue<OneOfT, TT["kind"]>,
        kind
      ),
    } as OneOfSub<R, OneOfKind<TT>>
  }
}

export function isOneOfKind<T extends GenericOneOf, K extends T["kind"]>(
  x: T,
  kind: K
): x is T & { readonly kind: K } {
  return x.kind === kind
}

export function oneOfAsKind<T extends GenericOneOf, K extends T["kind"]>(
  x: T,
  kind: K
): OneOfSubValue<T, K> | undefined {
  if (x.kind === kind) {
    return x.value as OneOfSubValue<T, K>
  }
  return undefined
}

export type ValueOrError<T, ErrorType = Error> = OneOf<{
  value: T
  error: ErrorType
}>

export function catchErrorSync<ErrorType, T>(
  errorType: Constructor<ErrorType>,
  fn: () => T
): ValueOrError<T, ErrorType> {
  try {
    return { kind: "value", value: fn() }
  } catch (error) {
    if (error instanceof errorType) {
      return { kind: "error", value: error }
    }
    throw error
  }
}

export async function catchErrorAsync<ErrorType, T>(
  errorType: Constructor<ErrorType>,
  fn: () => Promise<T>
): Promise<ValueOrError<T, ErrorType>> {
  try {
    return { kind: "value", value: await fn() }
  } catch (error) {
    if (error instanceof errorType) {
      return { kind: "error", value: error }
    }
    throw error
  }
}

export function asValueOrThrow<T, ErrorType>(v: ValueOrError<T, ErrorType>): T {
  if (v.kind === "error") throw v.value
  return v.value
}

export type OneOfPromiseBuilder<OneOfSpec> = {
  [K in keyof OneOfSpec]-?: () => Promise<OneOfSpec[K]>
}

export function buildOneOfValueAsync<OneOfSpec>(
  builder: OneOfPromiseBuilder<OneOfSpec>
): <K extends keyof OneOfSpec>(kind: K) => Promise<OneOfSpec[K]> {
  return async <K extends keyof OneOfSpec>(kind: K): Promise<OneOfSpec[K]> => {
    return await builder[kind]()
  }
}

// export function zipOneOf<
//   OneOfType extends GenericOneOf,
//   S extends { [K in OneOfType["kind"]]: unknown }
// >(): <T extends OneOfType, R>(
//   x: T,
//   u: S[T["kind"]],
//   dispatcher: {
//     [K in OneOfType["kind"]]: (value: OneOfKindValue<T, K>, u: S[K]) => R
//   }
// ) => R {
//   return <T extends OneOfType, R>(
//     x: T,
//     u: S[T["kind"]],
//     dispatcher: {
//       [K in OneOfType["kind"]]: (value: OneOfKindValue<T, K>, u: S[K]) => R
//     }
//   ): R => {
//     const kind: T["kind"] = x.kind
//     const value: T["value"] = x.value
//     return dispatcher[kind](value as OneOfKindValue<T, T["kind"]>, u)
//   }
// }
