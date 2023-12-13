import { stringRemovePrefix } from "./string"

export function resolveUrl(from: string, to: string) {
  if (to.startsWith("data:")) return to
  const resolvedUrl = new URL(to, new URL(from, "resolve://"))
  if (resolvedUrl.protocol === "resolve:") {
    // `from` is a relative URL.
    const { pathname, search, hash } = resolvedUrl
    return pathname + search + hash
  }
  return resolvedUrl.toString()
}

export function httpToWebSocketUrl(httpUrl: string): string {
  const s1 = stringRemovePrefix(httpUrl, "http://")
  if (s1 !== undefined) {
    return `ws://${s1}`
  }
  const s2 = stringRemovePrefix(httpUrl, "https://")
  if (s2 !== undefined) {
    return `wss://${s2}`
  }
  return httpUrl
}
