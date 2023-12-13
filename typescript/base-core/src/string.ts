import { maybeUndefined } from "./optional.js"
import { Vector } from "./vector.js"

export function stringRemovePrefix(
  text: string,
  prefix: string
): string | undefined {
  if (!text.startsWith(prefix)) {
    return undefined
  }
  return text.substring(prefix.length)
}

export function stringRemovePostfix(
  text: string,
  postfix: string
): string | undefined {
  if (!text.endsWith(postfix)) {
    return undefined
  }
  return text.substring(0, text.length - postfix.length)
}

export function stringCutFirst(
  text: string,
  separator: string
): Vector<string, 2> | undefined {
  const idx = text.indexOf(separator)
  if (idx === -1) return undefined
  return [text.substring(0, idx), text.substring(idx + separator.length)]
}

export function stringCutLast(
  text: string,
  separator: string
): Vector<string, 2> | undefined {
  const idx = text.lastIndexOf(separator)
  if (idx === -1) return undefined
  return [text.substring(0, idx), text.substring(idx + separator.length)]
}

export function stringCutOptionalFirst(
  text: string,
  separator: string
): [string | undefined, string] {
  const idx = text.indexOf(separator)
  if (idx === -1) return [undefined, text]
  return [text.substring(0, idx), text.substring(idx + separator.length)]
}

export function stringCutOptionalLast(
  text: string,
  separator: string
): [string, string | undefined] {
  const idx = text.lastIndexOf(separator)
  if (idx === -1) return [text, undefined]
  return [text.substring(0, idx), text.substring(idx + separator.length)]
}

export function stringGetFirst(text: string, separator: string): string {
  const idx = text.indexOf(separator)
  if (idx === -1) return text
  return text.substring(0, idx)
}

export function stringGetLast(text: string, separator: string): string {
  const idx = text.lastIndexOf(separator)
  if (idx === -1) return text
  return text.substring(idx + separator.length)
}

export function stringToInt(text: string): number | undefined {
  if (/^[-+]?(\d+)$/.test(text)) {
    return Number(text)
  } else {
    return undefined
  }
}

export function stringToNumber(text: string): number | undefined {
  const v = Number(text)
  if (isNaN(v)) return undefined
  return v
}

export function stringToIntForChinese(text: string): number | undefined {
  return maybeUndefined(Math.round)(stringToNumberForChinese(text))
}

export function stringToNumberForChinese(text: string): number | undefined {
  const v1 = stringRemovePostfix(text, "亿") ?? stringRemovePostfix(text, "亿+")
  if (v1 !== undefined) {
    const v = stringToNumber(v1)
    if (v === undefined) return undefined
    return v * 100000000
  }
  const v2 = stringRemovePostfix(text, "万") ?? stringRemovePostfix(text, "万+")
  if (v2 !== undefined) {
    const v = stringToNumber(v2)
    if (v === undefined) return undefined
    return v * 10000
  }
  return stringToNumber(text)
}

export function stringSplitToVector<N extends number>(
  text: string,
  separator: string,
  n: N
): Vector<string, N> | undefined {
  const values = text.split(separator)
  if (values.length !== n) {
    return undefined
  }
  return values as Vector<string, N>
}

export function stringToJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch (e) {
    console.log("Failed to parse JSON text")
    console.log(e)
    console.log(text)
    throw e
  }
}

export function stringExtractByBound(
  text: string,
  prefix: string,
  postfix: string
): string[] {
  let pos = 0
  const result: string[] = []
  for (;;) {
    const p0 = text.indexOf(prefix, pos)
    if (p0 === -1) {
      break
    }
    const p1 = text.indexOf(postfix, p0 + prefix.length)
    if (p1 === -1) {
      break
    }
    result.push(text.substring(p0 + prefix.length, p1))
    pos = p1 + postfix.length
  }
  return result
}

export function stringPadInt(value: number, length: number): string {
  return value.toString().padStart(length, "0")
}

export function stringDate(date: Date): string {
  return `${date.getFullYear()}-${(date.getMonth() + 1)
    .toString()
    .padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")} ${date
    .getHours()
    .toString()
    .padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}:${date
    .getSeconds()
    .toString()
    .padStart(2, "0")}`
}

export function stringRandomFilename(): string {
  let result = ""
  const characters = "abcdefghijklmnopqrstuvwxyz0123456789"
  for (let i = 0; i < 6; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length))
  }
  return result
}

export function stringRandomFilenameWithTimestamp(): string {
  const date = new Date()
  const timestampStr = `${date.getUTCFullYear() % 100}${stringPadInt(
    date.getUTCMonth() + 1,
    2
  )}${stringPadInt(date.getUTCDate(), 2)}-${stringPadInt(
    date.getUTCHours(),
    2
  )}${stringPadInt(date.getUTCMinutes(), 2)}${stringPadInt(
    date.getUTCSeconds(),
    2
  )}`
  return `${timestampStr}-${stringRandomFilename()}`
}

export function stringRandomSimpleName(len: number): string {
  let result = ""
  const characters = "abcdefghijklmnopqrstuvwxyz0123456789"
  for (let i = 0; i < len; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length))
  }
  return result
}

export function stringHash(text: string): number {
  return text.split("").reduce(function (a, b) {
    a = (a << 5) - a + b.charCodeAt(0)
    return a & a
  }, 0)
}
