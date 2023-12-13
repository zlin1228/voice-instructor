import {
  objectType,
  CookType,
  arrayType,
  stringType,
  emptyObjectType,
  timestampType,
  doubleType,
} from "base-core/lib/types.js"
import { spotType, npcPlanTaskType } from "./state.js"

// NPC 操作：出生
export const npcOperationBirthType = objectType([
  { name: "spot", type: spotType },
])

export type NpcOperationBirth = CookType<typeof npcOperationBirthType>

// NPC 操作：移动
export const npcOperationMoveType = objectType([
  { name: "spot", type: spotType },
])

export type NpcOperationMove = CookType<typeof npcOperationMoveType>

// NPC 操作：更新计划
export const npcOperationPlanType = objectType([
  { name: "planTasks", type: arrayType(npcPlanTaskType) },
])

export type NpcOperationPlan = CookType<typeof npcOperationPlanType>

// NPC 操作：发起群聊
export const npcOperationGroupStartType = objectType([
  { name: "npcId", type: stringType }, // 要邀请进入群聊的另一个 NPC 的 ID
])

export type NpcOperationGroupStart = CookType<typeof npcOperationGroupStartType>

// NPC 操作：加入群聊
export const npcOperationGroupJoinType = objectType([
  { name: "groupId", type: stringType },
])

export type NpcOperationGroupJoin = CookType<typeof npcOperationGroupJoinType>

// NPC 操作：离开群聊
export const npcOperationGroupLeaveType = objectType([
  { name: "groupId", type: stringType },
])

export type NpcOperationGroupLeave = CookType<typeof npcOperationGroupLeaveType>

// NPC 操作：群聊发言
export const npcOperationGroupPostType = objectType([
  { name: "groupId", type: stringType },
  { name: "content", type: stringType },
])

export type NpcOperationGroupPost = CookType<typeof npcOperationGroupPostType>

// NPC 操作
export const npcOperationType = objectType([
  {
    name: "birth",
    type: npcOperationBirthType,
    optional: true,
  },
  {
    name: "move",
    type: npcOperationMoveType,
    optional: true,
  },
  {
    name: "plan",
    type: npcOperationPlanType,
    optional: true,
  },
  {
    name: "groupStart",
    type: npcOperationGroupStartType,
    optional: true,
  },
  {
    name: "groupJoin",
    type: npcOperationGroupJoinType,
    optional: true,
  },
  {
    name: "groupLeave",
    type: npcOperationGroupLeaveType,
    optional: true,
  },
  {
    name: "groupPost",
    type: npcOperationGroupPostType,
    optional: true,
  },
])

export type NpcOperation = CookType<typeof npcOperationType>

export const worldOperationStartType = objectType([
  { name: "timeRate", type: doubleType },
  { name: "stopTime", type: timestampType, optional: true },
])

export type WorldOperationStart = CookType<typeof worldOperationStartType>

// 世界操作
export const worldOperationType = objectType([
  {
    name: "npcOperations",
    type: arrayType(
      objectType([
        { name: "npcId", type: stringType },
        { name: "npcOperation", type: npcOperationType },
      ])
    ),
    optional: true,
  },
  { name: "startWorld", type: worldOperationStartType, optional: true },
  { name: "stopWorld", type: emptyObjectType, optional: true },
])

export type WorldOperation = CookType<typeof worldOperationType>
