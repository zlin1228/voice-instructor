import { Vector } from "./vector.js"

export function arrayConcat<T>(arrays: readonly (readonly T[])[]): T[] {
  const result: T[] = []
  for (const arr of arrays) {
    // Do not use spread operator here because it may cause the following error:
    // RangeError: Maximum call stack size exceeded
    for (const value of arr) result.push(value)
  }
  return result
}

export function arrayRemoveDuplicate<T>(values: readonly T[]): T[] {
  return [...new Set(values)]
}

export function byKey<T, K extends keyof T>(key: K): (x: T) => T[K] {
  return (x: T) => x[key]
}

export function byKeyIs<T, K extends keyof T>(
  key: K,
  value: T[K]
): (x: T) => boolean {
  return (x: T) => x[key] === value
}

export function arrayFindFirst<T>(
  values: readonly T[],
  fn: (value: T) => boolean
): [number, T] | undefined {
  const idx = values.findIndex(fn)
  if (idx === -1) return undefined
  return [idx, values[idx] as T]
}

export function arrayFindFirstIndex<T>(
  values: readonly T[],
  value: T
): number | undefined {
  const idx = values.findIndex((x) => x === value)
  return idx === -1 ? undefined : idx
}

export function arraySliceVector<T, N extends number>(
  values: readonly T[],
  n: N,
  start = 0
): Vector<T, N> | undefined {
  if (start < 0 || start + n > values.length) return undefined
  return values.slice(start, start + n) as Vector<T, N>
}

export function arrayToVector<T, N extends number>(
  values: readonly T[],
  n: N
): Vector<T, N> | undefined {
  if (values.length !== n) return undefined
  return values.slice() as Vector<T, N>
}

export function arrayIsVector<T, N extends number>(
  values: readonly T[],
  n: N
): values is Vector<T, N> {
  return values.length === n
}

export function arrayLastOrUndefined<T>(values: readonly T[]): T | undefined {
  if (values.length === 0) return undefined
  return values[values.length - 1]
}

export function arrayRandomOne<T>(value: readonly T[]): T | undefined {
  if (value.length === 0) return undefined
  return value[Math.floor(Math.random() * value.length)]
}

export function arrayMin<T, R>(
  values: readonly T[],
  extractor: (value: T) => R,
  comparator: Comparator<R>
): [number, T, R] | undefined {
  const result = arraySliceVector(values, 1)
  if (result === undefined) return undefined
  let topIdx = 0
  let topValue = result[0]
  let topPickValue = extractor(topValue)
  for (let i = 1; i < values.length; ++i) {
    const value = values[i] as T
    const pickValue = extractor(value)
    if (comparator(pickValue, topPickValue) === -1) {
      topIdx = i
      topValue = value
      topPickValue = pickValue
    }
  }
  return [topIdx, topValue, topPickValue]
}

export function arrayMax<T, R>(
  values: readonly T[],
  extractor: (value: T) => R,
  comparator: Comparator<R>
): [number, T, R] | undefined {
  const result = arraySliceVector(values, 1)
  if (result === undefined) return undefined
  let topIdx = 0
  let topValue = result[0]
  let topPickValue = extractor(topValue)
  for (let i = 1; i < values.length; ++i) {
    const value = values[i] as T
    const pickValue = extractor(value)
    if (comparator(topPickValue, pickValue) === -1) {
      topIdx = i
      topValue = value
      topPickValue = pickValue
    }
  }
  return [topIdx, topValue, topPickValue]
}

export function arrayClassify<T, R extends string>(
  values: readonly T[],
  extractor: (value: T) => R
): {
  [K in R]?: readonly T[]
} {
  const result: Record<string, T[]> = {}
  for (const value of values) {
    const key = extractor(value)
    let items = result[key]
    if (items === undefined) {
      items = []
      result[key] = items
    }
    items.push(value)
  }
  return result as { [K in R]?: readonly T[] }
}

export function arrayGet<T>(
  values: readonly T[],
  index: number
): [T] | undefined {
  if (index >= values.length || index < 0) return undefined
  return [values[index] as T]
}

export function arraySequence(length: number): number[] {
  return [...Array(length).keys()]
}

export function arrayZip2<T0, T1>(
  a0: readonly T0[],
  a1: readonly T1[]
): readonly [T0, T1][] | undefined {
  if (a0.length !== a1.length) {
    return undefined
  }
  const result: [T0, T1][] = []
  for (let i = 0; i < a0.length; ++i) {
    result.push([a0[i] as T0, a1[i] as T1])
  }
  return result
}

export function arrayCount<T>(
  values: readonly T[],
  fn: (value: T) => boolean
): number {
  let result = 0
  for (const value of values) {
    if (fn(value)) result += 1
  }
  return result
}

export type Comparator<T> = (a: T, b: T) => -1 | 0 | 1

export function arraySort<T>(
  values: readonly T[],
  ...comparators: Comparator<T>[]
): T[] {
  return [...values].sort((a, b) => {
    for (const comparator of comparators) {
      const v = comparator(a, b)
      if (v < 0) return -1
      if (v > 0) return 1
    }
    return 0
  })
}

export function comparatorExtract<T>(
  fn: (value: T) => number | string | Date
): Comparator<T> {
  return (a, b) => {
    const va = fn(a)
    const vb = fn(b)
    if (va < vb) return -1
    if (va > vb) return 1
    return 0
  }
}

export function comparatorChain<T>(
  ...comparators: Comparator<T>[]
): Comparator<T> {
  return (a, b) => {
    for (const comparator of comparators) {
      const result = comparator(a, b)
      if (result !== 0) return result
    }
    return 0
  }
}

export function comparatorReverse<T>(comparator: Comparator<T>): Comparator<T> {
  return (a, b): -1 | 0 | 1 => {
    return -comparator(a, b) as -1 | 0 | 1
  }
}

export function arrayShuffle<T>(values: readonly T[]): T[] {
  const arr = [...values]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j] as T, arr[i] as T]
  }
  return arr
}

export function arraySplitToChunks<T>(
  values: readonly T[],
  chunkSize: number
): (readonly T[])[] {
  const chunks: (readonly T[])[] = []
  for (let i = 0; i < values.length; i += chunkSize) {
    const first = i
    const last = Math.min(i + chunkSize, values.length)
    chunks.push(values.slice(first, last))
  }
  return chunks
}

export async function* asyncIterableSplitToChunks<T>(
  iterable: AsyncIterable<T>,
  chunkSize: number
) {
  let items: T[] = []
  for await (const item of iterable) {
    items.push(item)
    if (items.length >= chunkSize) {
      yield items
      items = []
    }
  }
  if (items.length !== 0) {
    yield items
  }
}

export function keyIsNotUndefined<T extends {}, K extends keyof T>(
  key: K
): (obj: T) =>
  | (T & {
      [KK in K]-?: Exclude<T[KK], undefined>
    })
  | undefined {
  return (obj) =>
    obj[key] === undefined
      ? undefined
      : (obj as T & {
          [KK in K]-?: Exclude<T[KK], undefined>
        })
}

export function arrayRepeat<T>(value: T, count: number): T[] {
  return Array<T>(count).fill(value)
}

export async function arrayMapSequentially<T, R>(
  values: readonly T[],
  fn: (value: T) => Promise<R>
): Promise<R[]> {
  const result: R[] = []
  for (const value of values) {
    result.push(await fn(value))
  }
  return result
}
