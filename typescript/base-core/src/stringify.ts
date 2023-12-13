import { Entity } from "./entity.js"

export interface StringifyOption {
  scenario: string
}

export type Stringifier = (value: unknown, option: StringifyOption) => string

function renderText(text: string): string {
  if (text.length >= 200) {
    return `(text-length=${text.length})[${JSON.stringify(
      text.substring(0, 200)
    )}]`
  }
  return JSON.stringify(text)
}

export class StringifierRegistry {
  #entities = new Map<string, Stringifier>()
  #instanceTypes: { ctor: new () => unknown; stringifier: Stringifier }[] = []

  registerEntity<T>(
    entity: Entity<T>,
    stringifier: (value: T, option: StringifyOption) => string
  ) {
    this.#entities.set(entity.kind, stringifier as unknown as Stringifier)
  }

  registerInstanceType<T extends object>(
    ctor: new () => T,
    stringifier: (value: T, option: StringifyOption) => string
  ) {
    this.#instanceTypes.unshift({
      ctor,
      stringifier: stringifier as Stringifier,
    })
  }

  stringify(kind: string, value: unknown, option: StringifyOption): string {
    const stringifier = this.#entities.get(kind)
    if (stringifier !== undefined) {
      return stringifier(value, option)
    }
    if (typeof value === "string") {
      return renderText(value)
    } else if (typeof value === "number") {
      return value.toString()
    } else if (typeof value === "bigint") {
      return value.toString()
    } else if (typeof value === "boolean") {
      return value ? "true" : "false"
    } else if (typeof value === "symbol") {
      return value.toString()
    } else if (typeof value === "undefined") {
      return "undefined"
    } else if (typeof value === "object") {
      if (value === null) return "null"
      for (const instanceType of this.#instanceTypes) {
        if (value instanceof instanceType.ctor) {
          return instanceType.stringifier(value, option)
        }
      }
      return JSON.stringify(value)
    } else {
      return String(value)
    }
  }
}

export const stringifierRegistry = new StringifierRegistry()

stringifierRegistry.registerInstanceType(Error, (value, option) => {
  return `Error(${value.name}, ${value.message})`
})

// stringifierRegistry.registerInstanceType(ReadableStream, (value, option) => {
//   return "ReadableStream()"
// })

// stringifierRegistry.registerInstanceType(stream.Readable, (value, option) => {
//   return "stream.Readable()"
// })
