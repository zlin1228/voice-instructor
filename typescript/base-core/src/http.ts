export interface HttpHeader {
  name: string
  value: string
}

export function findHttpHeader(
  headers: readonly HttpHeader[],
  name: string
): string | undefined {
  return headers.find((header) => header.name === name)?.value
}

export function httpHeadersToFetchHeaders(
  headers: readonly HttpHeader[]
): Headers {
  return new Headers(headers.map(({ name, value }) => [name, value]))
}

export interface URLParam {
  name: string
  value: string
}

export function buildUrlSearch(params: URLParam[]): string {
  const p = new URLSearchParams()
  for (const { name, value } of params) {
    p.append(name, value)
  }
  return p.toString()
}
