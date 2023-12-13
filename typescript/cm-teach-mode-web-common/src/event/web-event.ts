import { CookType, objectType } from "base-core/lib/types.js"
import { pageEventType } from "./page-event.js"
import { domEventType } from "./dom-event.js"

// Represents an event which can be captured from a web page.
export const webEventType = objectType([
  // At most one of the following fields is not undefined
  { name: "pageEvent", type: pageEventType, optional: true },
  { name: "domEvent", type: domEventType, optional: true },
])

export type WebEvent = CookType<typeof webEventType>
