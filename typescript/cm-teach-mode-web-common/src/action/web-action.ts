import { CookType, objectType } from "base-core/lib/types.js"

import { domActionType } from "./dom-action.js"
import { pageActionType } from "./page-action.js"

// Represents an action which can be performed on a web page.
export const webActionType = objectType([
  // At most one of the following fields is not undefined
  { name: "domAction", type: domActionType, optional: true },
  { name: "pageAction", type: pageActionType, optional: true },
])

export type WebAction = CookType<typeof webActionType>
