import { CookType, objectType, stringType } from "base-core/lib/types.js"

export const pageActionNavigateType = objectType([
  { name: "url", type: stringType },
])

export type PageActionNavigate = CookType<typeof pageActionNavigateType>

export const pageActionType = objectType([
  { name: "navigate", type: pageActionNavigateType, optional: true },
])

export type PageAction = CookType<typeof pageActionType>
