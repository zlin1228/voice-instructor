import {
  CookType,
  arrayType,
  doubleType,
  int32Type,
  objectType,
  stringType,
} from "base-core/lib/types.js"
import { treeListPathType, treeUniPathType } from "./tree-path.js"

export const treeStepClickType = objectType([
  { name: "uniPath", type: treeUniPathType },
])

export type TreeStepClick = CookType<typeof treeStepClickType>

export const treeStepFillType = objectType([
  { name: "uniPath", type: treeUniPathType },
  { name: "value", type: stringType },
])

export type TreeStepFill = CookType<typeof treeStepFillType>

export const treeStepPressType = objectType([
  { name: "uniPath", type: treeUniPathType },
  { name: "key", type: stringType },
])

export type TreeStepPress = CookType<typeof treeStepPressType>

export const treeStepScrollType = objectType([
  { name: "uniPath", type: treeUniPathType },
  { name: "positionX", type: doubleType },
  { name: "positionY", type: doubleType },
])

export type TreeStepScroll = CookType<typeof treeStepScrollType>

export const treeStepExtractType = objectType([
  { name: "name", type: stringType },
  { name: "uniPath", type: treeUniPathType },
])

export type TreeStepExtract = CookType<typeof treeStepExtractType>

export const treeStepType = objectType([
  // At most one of the following fields can present.
  { name: "click", type: treeStepClickType, optional: true },
  { name: "fill", type: treeStepFillType, optional: true },
  { name: "press", type: treeStepPressType, optional: true },
  { name: "scroll", type: treeStepScrollType, optional: true },
  { name: "extract", type: treeStepExtractType, optional: true },
])

export type TreeStep = CookType<typeof treeStepType>

export const treeBlockSequenceType = objectType([
  { name: "steps", type: arrayType(treeStepType) },
])

export type TreeBlockSequence = CookType<typeof treeBlockSequenceType>

export const treeBlockListType = objectType([
  { name: "name", type: stringType },
  { name: "itemNodePath", type: treeListPathType },
  { name: "textNodePath", type: treeUniPathType },
  { name: "blockId", type: int32Type },
])

export type TreeBlockList = CookType<typeof treeBlockListType>

export const treeBlockType = objectType([
  // At most one of the following fields can present.
  { name: "sequence", type: treeBlockSequenceType, optional: true },
  { name: "listSelectOne", type: treeBlockListType, optional: true },
  { name: "listSelectAll", type: treeBlockListType, optional: true },
])

export type TreeBlock = CookType<typeof treeBlockType>

export const treeProcedureType = objectType([
  { name: "blocks", type: arrayType(treeBlockType) },
])

export type TreeProcedure = CookType<typeof treeProcedureType>
