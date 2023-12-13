// https://stackoverflow.com/questions/49579094/typescript-conditional-types-filter-out-readonly-properties-pick-only-requir
// There is no readonly detection here because of https://github.com/Microsoft/TypeScript/issues/13347.

// https://www.zhenghao.io/posts/ts-never
// https://dev.to/matechs/encoding-of-hkts-in-typescript-5c3

export type Extends<A, B> = [A] extends [B] ? true : false
export type StrictExtends<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? false
    : true
  : false
export type SameType<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : false
  : false

export interface TypeMapper<I = unknown, O = unknown> {
  input: (p: I) => void
  output: O
}

namespace _test0 {
  type A = "a"
  type B = "b"
  type C = "c"
  type AB = "a" | "b"
  type AC = "a" | "c"
  interface S {
    a: (p: AB) => AB
    b: (p: AC) => AC
  }
  type S1 = S[keyof S]
  // eslint-disable-next-line no-inner-declarations
  function f(s1: S1) {
    const s1a = s1("a")
  }
}

namespace _test1 {
  type A = "a"
  type B = "b"
  type AB = "a" | "b"
  const _z1: StrictExtends<TypeMapper<AB, AB>, TypeMapper<A, AB>> = true
  const _z2: StrictExtends<TypeMapper<AB, A>, TypeMapper<AB, AB>> = true
  const _z3: StrictExtends<TypeMapper<unknown, AB>, TypeMapper<AB, AB>> = true
  const _z4: StrictExtends<TypeMapper<unknown, AB>, TypeMapper<AB>> = true

  // eslint-disable-next-line no-inner-declarations
  function _f1<X, Y extends X>() {
    // const _z1 : Y extends X ? true : false = true
  }
}

export type CallTypeMapper<
  IBase,
  OBase,
  TM extends TypeMapper<IBase, OBase>,
  I extends IBase
> = (TM & {
  input: (p: I) => void
})["output"] // &
// OBase

export type TypeMapperInput<T extends (p: any) => void> = Parameters<T>[0]

export interface KeyTrait<S, K extends keyof S> {
  key: K
  value: S[K]
  optional: {
    [KK in keyof S]: never
  } extends { [KK in K]: never }
    ? false
    : true
}

export interface GenericKeyTrait<V = unknown> {
  readonly key: string | number | symbol
  readonly value: V
  readonly optional: boolean
}

export type KeyTransformOutput<T extends GenericKeyTrait> = (
  | (T["optional"] extends true ? { kind: "absent" } : never)
  | { kind: "present"; value: T["value"] }
) & { key: T["key"] }

export function structEntries<T extends Record<string, unknown>>(
  struct: T
): [keyof T, T[keyof T]][] {
  return Object.entries(struct) as [keyof T, T[keyof T]][]
}

export function structEntries2<T extends Record<string, unknown>>(
  struct: T
): {
  [K in keyof T]: [K, T[K]]
}[keyof T][] {
  return Object.entries(struct) as [keyof T, T[keyof T]][]
}

export function structKeys<T extends Record<string, unknown>>(
  struct: T
): (keyof T)[] {
  return Object.keys(struct) as unknown as (keyof T)[]
}

export type TransformStructValueType<
  V,
  T extends { [K in keyof T]: V },
  TM extends TypeMapper<V>
> = {
  -readonly [K in keyof T]-?: CallTypeMapper<V, unknown, TM, T[K]>
}

export type TransformStructFields<
  V,
  T extends { [K in keyof T]: V },
  TM extends TypeMapper<GenericKeyTrait<V>, GenericKeyTrait>
> = {
  -readonly [K in keyof T as CallTypeMapper<
    GenericKeyTrait<V>,
    GenericKeyTrait,
    TM,
    KeyTrait<T, K>
  >["optional"] extends true
    ? never
    : CallTypeMapper<
        GenericKeyTrait<V>,
        GenericKeyTrait,
        TM,
        KeyTrait<T, K>
      >["key"]]-?: CallTypeMapper<
    GenericKeyTrait<V>,
    GenericKeyTrait,
    TM,
    KeyTrait<T, K>
  >["value"]
} & {
  -readonly [K in keyof T as CallTypeMapper<
    GenericKeyTrait<V>,
    GenericKeyTrait,
    TM,
    KeyTrait<T, K>
  >["optional"] extends true
    ? CallTypeMapper<
        GenericKeyTrait<V>,
        GenericKeyTrait,
        TM,
        KeyTrait<T, K>
      >["key"]
    : never]?: CallTypeMapper<
    GenericKeyTrait<V>,
    GenericKeyTrait,
    TM,
    KeyTrait<T, K>
  >["value"]
}

export function transformStructFields<
  V,
  T extends { [K in keyof T]: V },
  TM extends TypeMapper<GenericKeyTrait<V>, GenericKeyTrait>
>(
  value: T,
  optionalFn: <K extends keyof T>(
    key: K,
    value: T[K]
  ) => CallTypeMapper<
    GenericKeyTrait<V>,
    GenericKeyTrait,
    TM,
    KeyTrait<T, K>
  >["optional"],
  keyFn: <K extends keyof T>(
    key: K,
    value: T[K]
  ) => CallTypeMapper<
    GenericKeyTrait<V>,
    GenericKeyTrait,
    TM,
    KeyTrait<T, K>
  >["key"],
  requiredValueFn: <K extends keyof T>(
    key: K,
    value: T[K]
  ) => CallTypeMapper<
    GenericKeyTrait<V>,
    GenericKeyTrait,
    TM,
    KeyTrait<T, K>
  >["value"],
  optionalValueFn: <K extends keyof T>(
    key: K,
    value: T[K]
  ) =>
    | {
        kind: "present"
        value: CallTypeMapper<
          GenericKeyTrait<V>,
          GenericKeyTrait,
          TM,
          KeyTrait<T, K>
        >["value"]
      }
    | { kind: "absent" }
): TransformStructFields<V, T, TM> {
  return Object.fromEntries(
    structEntries(value)
      .map(([key, value]) => {
        const optional = optionalFn(key, value)
        return {
          key: keyFn(key, value),
          value: optional
            ? optionalValueFn(key, value)
            : { kind: "present", value: requiredValueFn(key, value) },
        }
      })
      .filter(
        (x): x is { key: string; value: { kind: "present"; value: unknown } } =>
          x.value.kind === "present"
      )
      .map((x) => [x.key, x.value.value])
  ) as TransformStructFields<V, T, TM>
}

export function zipStructFields<
  U extends string | number | symbol,
  S1 extends { [K in U]: unknown },
  S2 extends { [K in U]: unknown }
>(
  keys: U[],
  s1: S1,
  s2: S2
): {
  [K in U]: [S1[K], S2[K]]
} {
  return Object.fromEntries(keys.map((key) => [key, [s1[key], s2[key]]])) as {
    [K in U]: [S1[K], S2[K]]
  }
}

export type PrefixStructKeysType<T, P extends string> = {
  readonly [K in keyof T as K extends string ? `${P}${K}` : never]: T[K]
}

export function prefixStructKeys<
  T extends Record<string, unknown>,
  P extends string
>(value: T, prefix: P): PrefixStructKeysType<T, P> {
  return Object.fromEntries(
    structEntries(value).map(([key, value]) => [
      `${prefix}${key.toString()}`,
      value,
    ])
  ) as PrefixStructKeysType<T, P>
}

export type KeyOfArray<T extends readonly unknown[]> = Exclude<
  keyof T,
  keyof []
>

export type ArrayKeysType<T extends readonly unknown[]> = Omit<T, keyof []>

export type FilterStructKeyBySuperType<S, F> = {
  [K in keyof S as F extends S[K] ? K : never]: S[K]
}

export type FilterStructKeyBySubType<S, F> = {
  [K in keyof S as S[K] extends F ? K : never]: S[K]
}

export type IntegerRange<T extends number> = number extends T
  ? number
  : _IntegerSequence<T, []>

type _IntegerSequence<
  T extends number,
  R extends unknown[]
> = R["length"] extends T ? R[number] : _IntegerSequence<T, [R["length"], ...R]>

export type IsUnion<T> = T[] extends (T extends unknown ? T[] : never)
  ? false
  : true

export type IsPermutationListOfUnion<
  U,
  A extends readonly unknown[]
> = A extends readonly []
  ? [U] extends [never]
    ? true
    : false
  : A extends readonly [infer K, ...infer Rest]
  ? K[] extends (K extends U ? K[] : never)
    ? IsPermutationListOfUnion<Exclude<U, K>, Rest>
    : never
  : never

// export type IsPermutationList<
//   U extends string,
//   A extends unknown[]
// > = U extends never ? "a" : "b"

// type C = IsPermutationListOfUnion<"row" | "column" | "row-reverse" | "column-reverse", readonly ["row"]>

export function getObjectPropertyOrNever<T, K extends string>(
  obj: T,
  key: K
): K extends keyof T ? T[K] : never {
  return obj[key as unknown as keyof T] as K extends keyof T ? T[K] : never
}

export function typedIfEqual<X, Y, A, B>(
  x: X,
  y: Y,
  a: A,
  b: B
): X & Y extends never ? B : B | A {
  return ((x as unknown) === y ? a : b) as X & Y extends never ? B : B | A
}

export type MaybeOptional<Opt extends boolean, T> = Opt & true extends never
  ? T
  : T | undefined

export function makeMaybeOptional<Opt extends boolean, X, T>(
  opt: Opt,
  buildOptionalValue: () => T | undefined,
  buildValue: () => T
): MaybeOptional<Opt, T> {
  if (opt === true) {
    return buildOptionalValue() as MaybeOptional<Opt, T>
  }
  return buildValue()
}
