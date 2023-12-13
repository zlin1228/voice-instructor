import { abort } from "../debug"

interface QueueBlock<T> {
  values: (T | undefined)[]
  next: QueueBlock<T> | undefined
}

export class Queue<T> {
  #blockSize = 10000
  #headBlock: QueueBlock<T> = {
    values: [],
    next: undefined,
  }
  #tailBlock: QueueBlock<T> = this.#headBlock
  #headPosition = 0
  #size = 0

  pushBack(value: T) {
    if (this.#tailBlock.values.length >= this.#blockSize) {
      const block = {
        values: [],
        next: undefined,
      }
      this.#tailBlock.next = block
      this.#tailBlock = block
    }
    this.#tailBlock.values.push(value)
    ++this.#size
  }

  popFront(): T | undefined {
    if (this.#headPosition < this.#headBlock.values.length) {
      const value = this.#headBlock.values[this.#headPosition]
      this.#headBlock.values[this.#headPosition] = undefined
      ++this.#headPosition
      --this.#size
      return value as T
    } else {
      const block = this.#headBlock.next
      if (block === undefined) {
        return undefined
      }
      const value = block.values[0] as T
      this.#headBlock = block
      this.#headPosition = 1
      --this.#size
      return value
    }
  }

  size(): number {
    return this.#size
  }
}
