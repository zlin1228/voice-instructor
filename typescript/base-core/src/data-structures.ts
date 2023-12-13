import { arraySequence } from "./array.js"
import { abortIfUndefined } from "./debug.js"

export function stringHasher(text: string): number {
  let hash = 0
  if (text.length === 0) return hash
  for (let i = 0; i < text.length; i++) {
    const chr = text.charCodeAt(i)
    hash = (hash << 5) - hash + chr
    hash |= 0 // Convert to 32bit integer
  }
  return hash
}

export class LargeSet<T> {
  readonly #hasher: (value: T) => number
  readonly #sets: Set<T>[] = arraySequence(133).map(() => new Set())

  constructor(hasher: (value: T) => number) {
    this.#hasher = hasher
  }

  add(value: T): void {
    const set = abortIfUndefined(
      this.#sets[Math.abs(this.#hasher(value)) % this.#sets.length]
    )
    set.add(value)
  }

  has(value: T): boolean {
    const set = abortIfUndefined(
      this.#sets[Math.abs(this.#hasher(value)) % this.#sets.length]
    )
    return set.has(value)
  }

  get size(): number {
    let sum = 0
    for (const set of this.#sets) {
      sum += set.size
    }
    return sum
  }
}

export class LargeMap<K, V> {
  readonly #hasher: (value: K) => number
  readonly #maps: Map<K, V>[] = arraySequence(133).map(() => new Map<K, V>())

  constructor(hasher: (value: K) => number) {
    this.#hasher = hasher
  }

  set(key: K, value: V): void {
    const map = abortIfUndefined(
      this.#maps[Math.abs(this.#hasher(key)) % this.#maps.length]
    )
    map.set(key, value)
  }

  has(key: K): boolean {
    const map = abortIfUndefined(
      this.#maps[Math.abs(this.#hasher(key)) % this.#maps.length]
    )
    return map.has(key)
  }

  get(key: K): V | undefined {
    const map = abortIfUndefined(
      this.#maps[Math.abs(this.#hasher(key)) % this.#maps.length]
    )
    return map.get(key)
  }

  delete(key: K): boolean {
    const map = abortIfUndefined(
      this.#maps[Math.abs(this.#hasher(key)) % this.#maps.length]
    )
    return map.delete(key)
  }

  get size(): number {
    let sum = 0
    for (const map of this.#maps) {
      sum += map.size
    }
    return sum
  }
}
