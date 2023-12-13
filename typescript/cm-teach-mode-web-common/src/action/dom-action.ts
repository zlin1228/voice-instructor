import {
  CookType,
  doubleType,
  int32Type,
  objectType,
  stringType,
} from "base-core/lib/types.js"
import { locatorType } from "../locator/locator.js"

export const domActionMouseClickType = objectType([
  { name: "elementLocator", type: locatorType },
])

export type DomActionMouseClick = CookType<typeof domActionMouseClickType>

export const domActionFillType = objectType([
  { name: "elementLocator", type: locatorType },
  { name: "value", type: stringType },
])

export type DomActionFill = CookType<typeof domActionFillType>

export const domActionPressType = objectType([
  { name: "elementLocator", type: locatorType },

  // https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key
  { name: "key", type: stringType },
])

export type DomActionPress = CookType<typeof domActionPressType>

export const domActionType = objectType([
  // At most one of the following fields is not undefined
  { name: "mouseClick", type: domActionMouseClickType, optional: true },
  { name: "fill", type: domActionFillType, optional: true },
  { name: "press", type: domActionPressType, optional: true },
])

export type DomAction = CookType<typeof domActionType>
