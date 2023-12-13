import {
  objectType,
  arrayType,
  CookType,
  int32Type,
  stringType,
} from "base-core/lib/types.js"
import { worldTimeType } from "./common.js"
import { placeType } from "./state.js"

// NPC 的常规每日日程。
// Routine 是固定的，描述每天 24 小时内 NPC 通常的活动。
export const npcRoutineTaskType = objectType([
  { name: "hour", type: int32Type },
  { name: "minute", type: int32Type },
  { name: "what", type: stringType },
  { name: "place", type: placeType },
] as const)

export type NpcRoutineTask = CookType<typeof npcRoutineTaskType>

// NPC 的临时任务。
// AdhocTask 是根据当前的事件动态生成的任务。AdhocTask 是 NPC 要完成的任务，不能被跳过。
export const npcAdhocTaskType = objectType([
  { name: "time", type: worldTimeType },
  { name: "what", type: stringType },
  { name: "why", type: stringType },
  { name: "place", type: placeType },
] as const)

export type NpcAdhocTask = CookType<typeof npcAdhocTaskType>

// NPC 运行时
export const npcRuntimeType = objectType([
  {
    name: "routineTasks",
    type: arrayType(npcRoutineTaskType),
  },
  {
    name: "adhocTasks",
    type: arrayType(npcAdhocTaskType),
  },
] as const)

export type NpcRuntime = CookType<typeof npcRuntimeType>

// 世界运行时
export const worldRuntimeType = objectType([
  {
    name: "npcs",
    type: arrayType(
      objectType([
        { name: "npcId", type: stringType },
        { name: "npcRuntime", type: npcRuntimeType },
      ] as const)
    ),
  },
] as const)

export type WorldRuntime = CookType<typeof worldRuntimeType>
