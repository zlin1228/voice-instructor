import { StringType, Type } from "base-core/lib/types.js"
import { CommonClosure, commonNormalizer } from "base-core/lib/types-common.js"

export async function getConfigByKey<T>(
  key: string,
  type: Type<CommonClosure, T>
): Promise<T | undefined> {
  const value = process.env[`EDEN_CFG_${key}`]
  if (value === undefined) {
    return undefined
  }
  if (type.symbol === StringType.symbol) {
    return value as unknown as T
  }
  return commonNormalizer(type, JSON.parse(value))
}
