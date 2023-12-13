import {
  objectType,
  stringType,
  CookType,
  int32Type,
  arrayType,
  doubleType,
  timestampType,
  nullableType,
} from "base-core/lib/types.js"
import { worldTimeType } from "./common"

// 地点（住宅里的房间，或者建筑里的设施）
export const placeType = objectType([
  {
    name: "house",
    type: objectType([
      { name: "houseId", type: stringType },
      { name: "roomId", type: stringType },
    ] as const),
    optional: true,
  },
  {
    name: "building",
    type: objectType([
      { name: "buildingId", type: stringType },
      { name: "facilityId", type: stringType },
    ] as const),
    optional: true,
  },
])

export type Place = CookType<typeof placeType>

// 聊天点（地点+聊天室）
export const spotType = objectType([
  { name: "place", type: placeType },
  { name: "groupId", type: stringType },
])

export type Spot = CookType<typeof spotType>

// NPC 的行动计划。
// PlanTask 描述了 NPC 要做的事情，取决于 Routine、AdhocTask、NPC 所处环境等。
export const npcPlanTaskType = objectType([
  { name: "time", type: worldTimeType },
  { name: "what", type: stringType },
  { name: "place", type: placeType },
] as const)

export type NpcPlanTask = CookType<typeof npcPlanTaskType>

// NPC 目前的位置状态。可能是静止的，也可能是在移动。
export const npcLocationType = objectType([
  {
    name: "moving",
    type: objectType([
      { name: "spot", type: spotType },
      { name: "timeToArrival", type: worldTimeType, optional: true },
    ]),
    optional: true,
  },
  {
    name: "staying",
    type: spotType,
    optional: true,
  },
] as const)

export type NpcLocation = CookType<typeof npcLocationType>

// NPC 状态
export const npcStateType = objectType([
  { name: "location", type: npcLocationType },
  {
    name: "planTasks",
    type: arrayType(npcPlanTaskType),
  },
] as const)

export type NpcState = CookType<typeof npcStateType>

export const worldActiveStateType = objectType([
  { name: "timeRate", type: doubleType }, // 世界时间流逝相对真实时间的倍率
  { name: "realTime", type: timestampType }, // 世界启动时的真实时间
  { name: "stopTime", type: timestampType, optional: true }, // 世界自动停止时的真实时间
] as const)

export type WorldActiveState = CookType<typeof worldActiveStateType>

export const groupMessageType = objectType([
  { name: "time", type: worldTimeType },
  {
    name: "author",
    type: objectType([
      { name: "npcId", type: stringType, optional: true },
      { name: "playerId", type: stringType, optional: true },
    ]),
  },
  { name: "content", type: stringType },
])

export type GroupMessage = CookType<typeof groupMessageType>

export const groupType = objectType([
  {
    name: "messages",
    type: arrayType(groupMessageType),
  },
])

export type Group = CookType<typeof groupType>

export const playerStateType = objectType([
  // 玩家当前所在的群聊
  {
    name: "groupId",
    type: stringType,
    optional: true,
  },
])

export type PlayerState = CookType<typeof playerStateType>

// 世界状态
export const worldStateType = objectType([
  { name: "referenceWorldTime", type: worldTimeType }, // 当前或下次启动时的世界时间
  { name: "activeState", type: nullableType(worldActiveStateType) },
  {
    name: "npcs",
    type: arrayType(
      objectType([
        { name: "npcId", type: stringType },
        { name: "npcState", type: npcStateType },
      ] as const)
    ),
  },
  {
    name: "groups",
    type: arrayType(
      objectType([
        { name: "groupId", type: stringType },
        { name: "group", type: groupType },
      ])
    ),
  },
  {
    name: "players",
    type: arrayType(
      objectType([
        { name: "playerId", type: stringType },
        { name: "playerState", type: playerStateType },
      ])
    ),
  },
] as const)

export type WorldState = CookType<typeof worldStateType>
