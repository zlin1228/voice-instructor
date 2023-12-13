// export type Opt<T> = [T] | undefined

// export function opt<T>(
//   value: T
// ): undefined extends T ? Opt<NonNullable<T>> : never {
//   if (value === undefined) {
//     return undefined as undefined extends T ? Opt<NonNullable<T>> : never
//   } else {
//     return [value] as undefined extends T ? Opt<NonNullable<T>> : never
//   }
// }

type OptionalTuple<T> = T extends []
  ? []
  : T extends [infer H, ...infer Rest]
  ? [H | undefined, ...OptionalTuple<Rest>]
  : never

export function maybeUndefined<R, Args extends unknown[]>(
  fn: (this: unknown, ...args: Args) => R
): (...args: OptionalTuple<Args>) => R | undefined {
  return (...args: OptionalTuple<Args>): R | undefined => {
    if ((args as undefined[]).includes(undefined)) return undefined
    return (fn as (this: unknown, ...args: OptionalTuple<Args>) => R)(...args)
  }
}

export function undefinedIfDefault<T>(x: T, d: T): T | undefined {
  return x === d ? undefined : x
}

export function undefinedIfFalsy<T>(x: T): T | undefined {
  return x ? x : undefined
}

export function defaultIfUndefined<T>(x: T | undefined, d: T): T {
  return x === undefined ? d : x
}

export function concatStringsOrUndefined(
  ...values: (string | undefined)[]
): string | undefined {
  if (values.includes(undefined)) return undefined
  return values.join("")
}

export function makeOptionalField<K extends string, T>(
  key: K,
  value: T | undefined
):
  | {
      [k in K]: T
    }
  | undefined {
  if (value === undefined) {
    return undefined
  }
  return {
    [key]: value,
  } as {
    [k in K]: T
  }
}
