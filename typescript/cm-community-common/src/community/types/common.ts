import { CommonClosure } from "base-core/lib/types-common.js"
import {
  objectType,
  int32Type,
  CookType,
  stringType,
  ObjectType,
  ObjectSpec,
} from "base-core/lib/types.js"

export function withIdType<Spec extends ObjectSpec<CommonClosure>>(
  type: ObjectType<CommonClosure, Spec>
) {
  return objectType([{ name: "_id", type: stringType }, ...type.spec] as const)
}

export type WithId<T> = T & { _id: string }

export const worldTimeType = objectType([
  { name: "year", type: int32Type },
  { name: "month", type: int32Type },
  { name: "date", type: int32Type },
  { name: "hour", type: int32Type },
  { name: "minute", type: int32Type },
] as const)

export type WorldTime = CookType<typeof worldTimeType>

export const annotationType = objectType([
  { name: "name", type: stringType },
  { name: "value", type: stringType },
] as const)

export type Annotation = CookType<typeof annotationType>
