import { abortIfUndefined } from "./debug.js"
import { IntegerRange, IsPermutationListOfUnion } from "./meta.js"

export type VectorArray<T, N extends number> = readonly T[] & {
  readonly length: N
}

export type VectorImpl<
  T,
  N extends number,
  R extends readonly T[] = []
> = R["length"] extends N ? R : VectorImpl<T, N, readonly [T, ...R]>

export type Vector<T, N extends number> = VectorImpl<T, N> & VectorArray<T, N>

export function vectorGenerate<T, N extends number>(
  n: N,
  fn: (index: IntegerRange<N>) => T
): Vector<T, N> {
  const result = []
  for (let i = 0; i < n; ++i) {
    result.push(fn(i as IntegerRange<N>))
  }
  return result as Vector<T, N>
}

export function vectorMap<R, T, N extends number>(
  vector: VectorArray<T, N>,
  fn: (x: T) => R
): Vector<R, N> {
  return (vector as readonly T[]).map((x) => fn(x)) as Vector<R, N>
}

export function vectorMap2<R, T0, T1, N extends number>(
  vector0: VectorArray<T0, N>,
  vector1: VectorArray<T1, N>,
  fn: (x0: T0, x1: T1) => R
): Vector<R, N> {
  return (vector0 as readonly T0[]).map((x, i) =>
    fn(x, (vector1 as readonly T1[])[i] as T1)
  ) as Vector<R, N>
}

export function vectorNew<T, N extends number>(n: N, value: T): Vector<T, N> {
  return Array<T>(n).fill(value) as Vector<T, N>
}

export function vectorAdd<N extends number>(
  vector0: VectorArray<number, N>,
  vector1: VectorArray<number, N>
): Vector<number, N> {
  return vectorMap2(vector0, vector1, (x0: number, x1: number) => x0 + x1)
}

export function vectorSub<N extends number>(
  vector0: VectorArray<number, N>,
  vector1: VectorArray<number, N>
): Vector<number, N> {
  return vectorMap2(vector0, vector1, (x0: number, x1: number) => x0 - x1)
}

export function vectorMultiply<N extends number>(
  vector0: VectorArray<number, N>,
  vector1: VectorArray<number, N>
): Vector<number, N> {
  return vectorMap2(vector0, vector1, (x0: number, x1: number) => x0 * x1)
}

export function vectorScale<N extends number>(
  vector: VectorArray<number, N>,
  s: number
): VectorArray<number, N> {
  return vectorMap(vector, (x) => x * s)
}

export type XY = Vector<number, 2>

export function vectorFindFirst<T, N extends number>(
  values: VectorArray<T, N>,
  fn: (value: T) => boolean
): [IntegerRange<N>, T] | undefined {
  const idx = values.findIndex(fn)
  if (idx === -1) return undefined
  return [idx as IntegerRange<N>, values[idx] as T]
}

// export function unionToIndex<U, N extends number, A extends VectorArray<U, N>>(
//   value: U,
//   list: A
// ): IsPermutationListOfUnion<U, A> extends true ? IntegerRange<N> : unknown {
//   return abortIfUndefined(vectorFindFirst(list, (x) => x === value))[0]
// }

export function unionToIndex<U, A extends VectorArray<U, number>>(
  value: U,
  list: A & { readonly length: A["length"] }
): IsPermutationListOfUnion<U, A> extends true
  ? IntegerRange<A["length"]>
  : unknown {
  return abortIfUndefined(vectorFindFirst(list, (x) => x === value))[0]
}

// function f(a: "a" | "b") {
//   const b: readonly ["a", "b"] = ["a", "b"]
//   const c = unionToIndex(a, ["a", "b"] as const)
// }
