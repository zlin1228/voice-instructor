import {
  CookType,
  arrayType,
  booleanType,
  objectType,
} from "base-core/lib/types.js"
import { treeNodeLocationType } from "./tree.js"

export const treeInteractionModeType = objectType([
  { name: "selecting", type: booleanType },
  { name: "highlight", type: arrayType(treeNodeLocationType), optional: true },
])

export type TreeInteractionMode = CookType<typeof treeInteractionModeType>
