import { Comparator } from "../array"
import { abortIfUndefined } from "../debug"
import { CollectionIndex } from "./index-collection"

// Reference: https://stackoverflow.com/questions/42919469/efficient-way-to-implement-priority-queue-in-javascript

const top = 0
const parent = (i: number) => ((i + 1) >>> 1) - 1
const left = (i: number) => (i << 1) + 1
const right = (i: number) => (i + 1) << 1

export class PriorityIndex<K, V> implements CollectionIndex<K, V> {
  readonly #map = new Map<K, number>()
  readonly #heap: [K, V][] = []
  readonly #comparator: Comparator<V>

  constructor(comparator: Comparator<V>) {
    this.#comparator = comparator
  }

  first(): [K, V] | undefined {
    return this.#heap[top]
  }

  #swap(i: number, j: number): void {
    const x = abortIfUndefined(this.#heap[i])
    const y = abortIfUndefined(this.#heap[j])
    this.#heap[i] = y
    this.#heap[j] = x
    this.#map.set(x[0], j)
    this.#map.set(y[0], i)
  }

  #lesser(i: number, j: number): boolean {
    return (
      this.#comparator(
        abortIfUndefined(this.#heap[i])[1],
        abortIfUndefined(this.#heap[j])[1]
      ) < 0
    )
  }

  #siftUp(node: number) {
    while (node > top && this.#lesser(node, parent(node))) {
      this.#swap(node, parent(node))
      node = parent(node)
    }
  }

  #siftDown(node: number) {
    for (;;) {
      const leftEligible =
        left(node) < this.#heap.length && this.#lesser(left(node), node)
      const rightEligible =
        right(node) < this.#heap.length && this.#lesser(right(node), node)
      if (!leftEligible && !rightEligible) return
      const child =
        leftEligible && rightEligible
          ? this.#lesser(right(node), left(node))
            ? right(node)
            : left(node)
          : leftEligible
          ? left(node)
          : right(node)
      this.#swap(node, child)
      node = child
    }
  }

  add(key: K, value: V): void {
    this.#heap.push([key, value])
    this.#map.set(key, this.#heap.length - 1)
    this.#siftUp(this.#heap.length - 1)
  }

  remove(key: K, value: V): void {
    const node = abortIfUndefined(this.#map.get(key))
    if (node === top) return
    this.#swap(node, this.#heap.length - 1)
    this.#heap.pop()
    this.#map.delete(key)
    if (this.#lesser(node, parent(node))) {
      this.#siftUp(node)
    } else {
      this.#siftDown(node)
    }
  }

  update(key: K, oldValue: V, newValue: V): void {
    if (this.#comparator(oldValue, newValue) === 0) return
    const node = abortIfUndefined(this.#map.get(key))
    abortIfUndefined(this.#heap[node])[1] = newValue
    if (node !== top && this.#lesser(node, parent(node))) {
      this.#siftUp(node)
    } else {
      this.#siftDown(node)
    }
  }
}
