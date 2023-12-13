import {
  CookType,
  int32Type,
  objectType,
  stringType,
} from "base-core/lib/types.js"

import { treeType } from "cm-bunny-host-common/lib/tree/tree.js"

// DOM events:
// https://developer.mozilla.org/en-US/docs/Web/API/Event

// elementIdAttribute must be consistent with the one in the below file:
// typescript/cm-teach-mode-web-service/src/recorder/scripts.ts
export const domElementIdAttribute = "__bunny_id"

export function extractElementIdFromDom(
  element: HTMLElement
): number | undefined {
  const elementIdString = element.getAttribute(domElementIdAttribute)
  if (!elementIdString) {
    return undefined
  }
  return Number(elementIdString)
}

export const domEventMouseType = objectType([
  // https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent
])

export type DomEventMouse = CookType<typeof domEventMouseType>

export const domEventKeyboardType = objectType([
  // https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent
  { name: "key", type: stringType },
])

export type DomEventKeyboard = CookType<typeof domEventKeyboardType>

export const domEventType = objectType([
  { name: "tree", type: treeType },
  { name: "nodeId", type: stringType },
  { name: "eventType", type: stringType },

  // Exists only if the event object is a KeyboardEvent.
  { name: "keyboardEvent", type: domEventKeyboardType, optional: true },

  // Exists only if the event object is a MouseEvent.
  { name: "mouseEvent", type: domEventMouseType, optional: true },

  // Exists only if the target node has a value property of string type.
  { name: "value", type: stringType, optional: true },
])

export type DomEvent = CookType<typeof domEventType>
