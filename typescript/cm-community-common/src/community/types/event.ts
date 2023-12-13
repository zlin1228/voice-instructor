import {
  objectType,
  CookType,
  arrayType,
  stringType,
  doubleType,
  timestampType,
  emptyObjectType,
} from "base-core/lib/types.js"
import { worldTimeType } from "./common.js"
import { spotType, npcPlanTaskType } from "./state.js"

// NPC 出生
export const npcEventBornType = objectType([
  // NPC 出生地
  { name: "spot", type: spotType },
])

export type NpcEventBorn = CookType<typeof npcEventBornType>

// NPC 计划更新
export const npcEventPlanType = objectType([
  // NPC 出生地
  { name: "planTasks", type: arrayType(npcPlanTaskType) },
])

export type NpcEventPlan = CookType<typeof npcEventPlanType>

// NPC 进入移动状态
export const npcEventMoveType = objectType([
  { name: "fromSpot", type: spotType },
  { name: "toSpot", type: spotType },
])

export type NpcEventMove = CookType<typeof npcEventMoveType>

// NPC 进入静止状态
export const npcEventStayType = objectType([{ name: "spot", type: spotType }])

export type NpcEventStay = CookType<typeof npcEventStayType>

export const npcEventType = objectType([
  { name: "npcId", type: stringType },
  { name: "eventName", type: stringType },
  { name: "born", type: npcEventBornType, optional: true },
  { name: "plan", type: npcEventPlanType, optional: true },
  { name: "move", type: npcEventMoveType, optional: true },
  { name: "stay", type: npcEventStayType, optional: true },
])

export type NpcEvent = CookType<typeof npcEventType>

export const groupEventJoinType = objectType([
  { name: "playerId", type: stringType, optional: true },
])

export type GroupEventJoin = CookType<typeof groupEventJoinType>

export const groupEventPostType = objectType([
  { name: "time", type: worldTimeType },
  { name: "npcId", type: stringType, optional: true },
  { name: "playerId", type: stringType, optional: true },
  { name: "content", type: stringType },
])

export type GroupEventPost = CookType<typeof groupEventPostType>

export const groupEventType = objectType([
  { name: "groupId", type: stringType },
  { name: "eventName", type: stringType },
  { name: "join", type: groupEventJoinType, optional: true },
  { name: "post", type: groupEventPostType, optional: true },
])

export type GroupEvent = CookType<typeof groupEventType>

// 世界启动
export const worldEventStartType = objectType([
  { name: "timeRate", type: doubleType },
  { name: "stopTime", type: timestampType, optional: true },
])

export type WorldEventStart = CookType<typeof worldEventStartType>

// 消息
export const worldEventType = objectType([
  { name: "worldId", type: stringType },
  { name: "realTime", type: timestampType },
  { name: "worldTime", type: worldTimeType },
  { name: "eventName", type: stringType },
  { name: "worldEventStart", type: worldEventStartType, optional: true },
  { name: "worldEventStop", type: emptyObjectType, optional: true },
  { name: "npcEvent", type: npcEventType, optional: true },
  { name: "groupEvent", type: groupEventType, optional: true },
])

export type WorldEvent = CookType<typeof worldEventType>
