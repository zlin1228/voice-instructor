import {
  CookType,
  doubleType,
  int32Type,
  objectType,
  stringType,
} from "base-core/lib/types.js"
import { treeNodeLocationType } from "./tree.js"

export const treeOperationClickType = objectType([
  { name: "nodeLocation", type: treeNodeLocationType },
  { name: "positionRatioX", type: doubleType, optional: true },
  { name: "positionRatioY", type: doubleType, optional: true },
])

export type TreeOperationClick = CookType<typeof treeOperationClickType>

export const treeOperationHoverType = objectType([
  { name: "nodeLocation", type: treeNodeLocationType },
])

export type TreeOperationHover = CookType<typeof treeOperationHoverType>

export const treeOperationFillType = objectType([
  { name: "nodeLocation", type: treeNodeLocationType },
  { name: "value", type: stringType },
])

export type TreeOperationFill = CookType<typeof treeOperationFillType>

export const treeOperationPressType = objectType([
  { name: "nodeLocation", type: treeNodeLocationType },
  { name: "key", type: stringType },
])

export type TreeOperationPress = CookType<typeof treeOperationPressType>

export const treeOperationScrollType = objectType([
  { name: "nodeLocation", type: treeNodeLocationType },
  { name: "positionX", type: doubleType },
  { name: "positionY", type: doubleType },
])

export type TreeOperationScroll = CookType<typeof treeOperationScrollType>

export const treeOperationType = objectType([
  // At most one of the following fields can present.
  { name: "click", type: treeOperationClickType, optional: true },
  { name: "hover", type: treeOperationHoverType, optional: true },
  { name: "fill", type: treeOperationFillType, optional: true },
  { name: "press", type: treeOperationPressType, optional: true },
  { name: "scroll", type: treeOperationScrollType, optional: true },
])

export type TreeOperation = CookType<typeof treeOperationType>
