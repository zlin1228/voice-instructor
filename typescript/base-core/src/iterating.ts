export function iterateFirst<T>(iterable: Iterable<T>): T | undefined {
  for (const value of iterable) {
    return value
  }
  return undefined
}
