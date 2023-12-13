export function throwException(exception: Error): never {
  throw exception
}

export function throwError(message: string, cause?: Error): never {
  throw new Error(message, cause === undefined ? undefined : { cause })
}
