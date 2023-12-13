import { CookType, objectType, stringType } from "base-core/lib/types.js"

// Playwright Page events:
// https://playwright.dev/docs/api/class-page#events

export const pageEventNavigateType = objectType([
  { name: "url", type: stringType },
])

export type PageEventNavigate = CookType<typeof pageEventNavigateType>

export const pageEventType = objectType([
  { name: "navigate", type: pageEventNavigateType, optional: true },
])

export type PageEvent = CookType<typeof pageEventType>
