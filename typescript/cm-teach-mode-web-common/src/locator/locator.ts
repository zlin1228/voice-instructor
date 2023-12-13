import { CookType, objectType } from "base-core/lib/types.js"
import { referenceLocatorType } from "./reference-locator.js"
import { selectorLocatorType } from "./selector-locator.js"

// Represents a way to locate an element on a web page.
export const locatorType = objectType([
  // Only one of the below fields can be non-undefined.
  { name: "referenceLocator", type: referenceLocatorType, optional: true },
  { name: "selectorLocator", type: selectorLocatorType, optional: true },
])

export type Locator = CookType<typeof locatorType>
