import {
  CookType,
  int32Type,
  objectType,
  stringType,
} from "base-core/lib/types.js"

// Locator for locating an element by a CSS selector.
export const selectorLocatorType = objectType([
  { name: "selector", type: stringType },
])

export type SelectorLocator = CookType<typeof selectorLocatorType>
