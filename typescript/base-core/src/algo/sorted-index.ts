export {}

// import BTree from 'sorted-btree'
// import { Comparator } from '../array'

// import { abortIfUndefined } from "../debug"
// import { CollectionIndex } from "./index-collection"

// export class SortedIndex<K, V, T> implements CollectionIndex<K, V> {
//   #btree = new BTree<T, Set<K>>()
//   #extractor: (value: V) => T
//   #comparator: Comparator<T>

//   constructor(extractor: (value: V) => T) {
//     this.#extractor = extractor
//   }

//   add(key: K, value: V): void {
//     const t = this.#extractor(value)
//     let ts = this.#map.get(t)
//     if (ts === undefined) {
//       ts = new Set()
//       this.#map.set(t, ts)
//     }
//     ts.add(key)
//   }

//   remove(key: K, value: V): void {
//     const t = this.#extractor(value)
//     const ts = abortIfUndefined(this.#map.get(t))
//     ts.delete(key)
//     if (ts.size === 0) {
//       this.#map.delete(t)
//     }
//   }

//   update(key: K, oldValue: V, newValue: V): void {
//     const oldT = this.#extractor(oldValue)
//     const newT = this.#extractor(newValue)
//     if (oldT === newT) return
//     const oldTs = abortIfUndefined(this.#map.get(oldT))
//     oldTs.delete(key)
//     if (oldTs.size === 0) {
//       this.#map.delete(oldT)
//     }
//     let newTs = this.#map.get(newT)
//     if (newTs === undefined) {
//       newTs = new Set()
//       this.#map.set(newT, newTs)
//     }
//     newTs.add(key)
//   }

//   keysByIndex(x: T): Set<K> {
//     return this.#map.get(x) ?? new Set()
//   }
// }
