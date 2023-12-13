import { abortIfUndefined } from "../debug"

export interface CollectionIndex<K, V> {
  add(key: K, value: V): void
  remove(key: K, value: V): void
  update(key: K, oldValue: V, newValue: V): void
}

export class IndexableMap<K, V> {
  readonly #map = new Map<K, V>()
  readonly #indices: CollectionIndex<K, V>[]

  constructor(indices: CollectionIndex<K, V>[]) {
    this.#indices = indices
  }

  set(key: K, value: V): void {
    const has = this.#map.has(key)
    if (has) {
      const old = this.#map.get(key) as V
      for (const hook of this.#indices) {
        hook.update(key, old, value)
      }
    } else {
      for (const hook of this.#indices) {
        hook.add(key, value)
      }
    }
    this.#map.set(key, value)
  }

  get(key: K): V | undefined {
    return this.#map.get(key)
  }

  delete(key: K): boolean {
    const has = this.#map.has(key)
    if (!has) return false
    const value = this.#map.get(key) as V
    for (const hook of this.#indices) {
      hook.remove(key, value)
    }
    return this.#map.delete(key)
  }

  has(key: K): boolean {
    return this.#map.has(key)
  }

  keys() {
    return this.#map.keys()
  }

  values() {
    return this.#map.values()
  }

  entries() {
    return this.#map.entries()
  }

  get size(): number {
    return this.#map.size
  }
}
