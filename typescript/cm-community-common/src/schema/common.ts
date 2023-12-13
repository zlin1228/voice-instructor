import { CommonClosure } from "base-core/lib/types-common.js"
import {
  objectType,
  int32Type,
  CookType,
  stringType,
  Type,
  ObjectType,
  ObjectSpec,
} from "base-core/lib/types.js"
import { stringRandomSimpleName } from "base-core/lib/string.js"

export function withIdType<Spec extends ObjectSpec<CommonClosure>>(
  type: ObjectType<CommonClosure, Spec>
) {
  return objectType([{ name: "_id", type: stringType }, ...type.spec] as const)
}

export type WithId<T> = T & { _id: string }

export function buildRandomId(): string {
  return stringRandomSimpleName(8).toUpperCase()
}

export const worldTimeType = objectType([
  { name: "year", type: int32Type },
  { name: "month", type: int32Type },
  { name: "date", type: int32Type },
  { name: "hour", type: int32Type },
  { name: "minute", type: int32Type },
] as const)

export type WorldTime = CookType<typeof worldTimeType>

export function worldTimeToDate(time: WorldTime): Date {
  return new Date(time.year, time.month - 1, time.date, time.hour, time.minute)
}

export function dateToWorldTime(date: Date): WorldTime {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    date: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
  }
}

export function worldTimeToString(worldTime: WorldTime): string {
  return `${worldTime.year}-${worldTime.month
    .toFixed()
    .padStart(2, "0")}-${worldTime.date
    .toFixed()
    .padStart(2, "0")} ${worldTime.hour
    .toFixed()
    .padStart(2, "0")}:${worldTime.minute.toFixed().padStart(2, "0")}`
}

export function minWorldTime(time0: WorldTime, time1: WorldTime): WorldTime {
  return worldTimeToDate(time0) < worldTimeToDate(time1) ? time0 : time1
}

export function worldTimeToTimestamp(time: WorldTime): number {
  return worldTimeToDate(time).getTime()
}

export const annotationType = objectType([
  { name: "name", type: stringType },
  { name: "value", type: stringType },
] as const)

export type Annotation = CookType<typeof annotationType>
