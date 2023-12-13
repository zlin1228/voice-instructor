import { CookType, objectType, stringType } from "base-core/lib/types.js"
import { treeStepType } from "cm-bunny-host-common/lib/tree/tree-procedure.js"
import { domEventType } from "cm-bunny-host-web-common/lib/event/dom-event.js"

export const recordedStateType = objectType([
  { name: "url", type: stringType },
  { name: "html", type: stringType },
])

export type RecordedState = CookType<typeof recordedStateType>

export const recordedDomEventType = objectType([
  { name: "domEvent", type: domEventType },
  { name: "state", type: recordedStateType },
])

export type RecordedDomEvent = CookType<typeof recordedDomEventType>

export const recordedTreeStepType = objectType([
  { name: "treeStep", type: treeStepType },
  { name: "state", type: recordedStateType },
  { name: "eventNodeId", type: stringType, optional: true },
])

export type RecordedTreeStep = CookType<typeof recordedTreeStepType>
