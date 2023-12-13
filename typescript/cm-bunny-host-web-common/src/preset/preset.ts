import {
  CookType,
  arrayType,
  booleanType,
  doubleType,
  objectType,
  stringType,
} from "base-core/lib/types.js"
import {
  treeNodeLocationType,
  treeType,
} from "cm-bunny-host-common/lib/tree/tree.js"

export const listLocationType = objectType([
  { name: "firstSubjectLocation", type: treeNodeLocationType },
  { name: "secondSubjectLocation", type: treeNodeLocationType },
])

export type ListLocation = CookType<typeof listLocationType>

export const listOneLocationType = objectType([
  { name: "listLocation", type: listLocationType },
  { name: "targetLocation", type: treeNodeLocationType },
  { name: "argumentName", type: stringType },
])

export type ListOneLocation = CookType<typeof listOneLocationType>

export const listAllLocationType = objectType([
  { name: "listLocation", type: listLocationType },
  { name: "targetLocation", type: treeNodeLocationType },
])

export type ListAllLocation = CookType<typeof listAllLocationType>

export const operationLocationType = objectType([
  { name: "staticLocation", type: treeNodeLocationType, optional: true },
  { name: "listOneLocation", type: listOneLocationType, optional: true },
  { name: "listAllLocation", type: listAllLocationType, optional: true },
])

export type OperationLocation = CookType<typeof operationLocationType>

export const presetStepClickType = objectType([
  { name: "operationLocation", type: operationLocationType },
])

export type PresetStepClick = CookType<typeof presetStepClickType>

export const presetStepFillType = objectType([
  { name: "operationLocation", type: operationLocationType },
  { name: "staticText", type: stringType, optional: true },
  { name: "argumentName", type: stringType, optional: true },
  { name: "pressEnter", type: booleanType },
])

export type PresetStepFill = CookType<typeof presetStepFillType>

export const presetStepReportType = objectType([
  { name: "operationLocation", type: operationLocationType },
  { name: "name", type: stringType },
])

export type PresetStepReport = CookType<typeof presetStepReportType>

export const presetStepRichComponentType = objectType([
  { name: "operationLocation", type: operationLocationType },
  { name: "type", type: stringType },
])

export type PresetStepRichComponent = CookType<typeof presetStepRichComponentType>

export const presetStepHoverType = objectType([
  { name: "operationLocation", type: operationLocationType },
])

export type PresetStepHover = CookType<typeof presetStepHoverType>


export const presetStepScrollType = objectType([
  { name: "operationLocation", type: operationLocationType },
])

export type PresetStepScroll = CookType<typeof presetStepScrollType>

export const presetStepPressType = objectType([
  { name: "operationLocation", type: operationLocationType },
  // https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values
  { name: "keyName", type: stringType },
])

export type PresetStepPress = CookType<typeof presetStepPressType>

export const presetStepConfigurationType = objectType([
  { name: "operationLocation", type: operationLocationType },
])

export type PresetStepConfiguration = CookType<typeof presetStepConfigurationType>

export const presetStepSliderType = objectType([
  { name: "operationLocation", type: operationLocationType },
  // 0 is the leftmost position, 1 is the rightmost position.
  { name: "positionRatioValue", type: doubleType },
])

export type PresetStepSlider = CookType<typeof presetStepSliderType>


export const presetStepType = objectType([
  { name: "explain", type: stringType },
  { name: "tree", type: treeType },

  // At most one of the following two fields can be present.
  { name: "click", type: presetStepClickType, optional: true },
  { name: "fill", type: presetStepFillType, optional: true },
  { name: "report", type: presetStepReportType, optional: true },
  { name: "richComponent", type: presetStepRichComponentType, optional: true },
  { name: "hover", type: presetStepHoverType, optional: true },
  { name: "scroll", type: presetStepScrollType, optional: true },
  { name: "press", type: presetStepPressType, optional: true },
  { name: "configuration", type: presetStepConfigurationType, optional: true },
  { name: "slider", type: presetStepSliderType, optional: true },
])

export type PresetStep = CookType<typeof presetStepType>

export const presetRecordType = objectType([
  { name: "authStateJson", type: stringType, optional: true },
  { name: "mainSteps", type: arrayType(presetStepType) },
  { name: "cleanupSteps", type: arrayType(presetStepType) },
])

export type PresetRecord = CookType<typeof presetRecordType>
