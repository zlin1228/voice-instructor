import { CookType, int32Type, objectType } from "base-core/lib/types.js"
import { domSnapshotType } from "../event/dom-event.js"

// Locator for locating an element by a reference DOM and a reference element.
export const referenceLocatorType = objectType([
  { name: "domSnapshot", type: domSnapshotType },
  { name: "targetElementId", type: int32Type },
])

export type ReferenceLocator = CookType<typeof referenceLocatorType>
