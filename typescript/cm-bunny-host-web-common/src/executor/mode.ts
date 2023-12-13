import { CookType, booleanType, objectType } from "base-core/lib/types.js"
import { treeNodeLocationType } from "cm-bunny-host-common/lib/tree/tree"

export const executorModeType = objectType([
  { name: "selecting", type: booleanType },
  { name: "highlight", type: treeNodeLocationType, optional: true },
])

export type ExecutorMode = CookType<typeof executorModeType>
