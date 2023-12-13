import {
  CookType,
  arrayType,
  int32Type,
  objectType,
  stringType,
} from "base-core/lib/types.js"
import { withIdType, worldTimeType } from "./common.js"

// 房间
export const roomType = objectType([
  { name: "name", type: stringType }, // 房间名称
] as const)

export type Room = CookType<typeof roomType>

// 住宅
export const houseType = objectType([
  { name: "name", type: stringType }, // 住宅名称
  { name: "description", type: stringType }, // 住宅描述
  { name: "rooms", type: arrayType(withIdType(roomType)) }, // 房间
] as const)

export type House = CookType<typeof houseType>

// 设施
export const facilityType = objectType([
  { name: "name", type: stringType }, // 设施名称
  { name: "description", type: stringType }, // 设施简介
] as const)

export type Facility = CookType<typeof facilityType>

// 建筑
export const buildingType = objectType([
  { name: "name", type: stringType }, // 建筑名称
  { name: "description", type: stringType }, // 建筑描述
  { name: "facilities", type: arrayType(withIdType(facilityType)) }, // 设施
] as const)

export type Building = CookType<typeof buildingType>

// NPC
export const npcSettingType = objectType([
  { name: "name", type: stringType }, // 姓名
  { name: "gender", type: stringType }, // 性别, valid values: "M" | "F"
  { name: "age", type: int32Type }, // 年龄
  { name: "occupation", type: stringType }, // 职业
  { name: "personality", type: stringType }, // 性格
  { name: "specialty", type: stringType }, // 特长
  { name: "hobby", type: stringType }, // 爱好
  { name: "shortTermGoal", type: stringType }, // 短期目标
  { name: "longTermGoal", type: stringType }, // 长期目标
  { name: "residenceHouseId", type: stringType }, // 居住地住宅
  { name: "residenceRoomId", type: stringType }, // 居住地房间
  { name: "workBuildingId", type: stringType }, // 工作地建筑
  { name: "workFacilityId", type: stringType }, // 工作地设施
] as const)

export type NpcSetting = CookType<typeof npcSettingType>

// NPC 关系
export const npcRelationType = objectType([
  { name: "npc1Id", type: stringType }, // 第一个 NPC
  { name: "npc2Id", type: stringType }, // 第二个 NPC
  { name: "relation", type: stringType }, // 第一个 NPC 和第二个 NPC 的关系
] as const)

export type NpcRelation = CookType<typeof npcRelationType>

// 玩家
export const playerSettingType = objectType([
  { name: "name", type: stringType }, // 玩家名字
] as const)

export type PlayerSetting = CookType<typeof playerSettingType>

// 世界设定
export const worldSettingType = objectType([
  { name: "name", type: stringType }, // 世界名称
  { name: "description", type: stringType }, // 世界观设定
  { name: "houses", type: arrayType(withIdType(houseType)) }, // 住宅
  { name: "buildings", type: arrayType(withIdType(buildingType)) }, // 建筑
  { name: "npcs", type: arrayType(withIdType(npcSettingType)) }, // NPC
  { name: "npcRelations", type: arrayType(withIdType(npcRelationType)) }, // NPC 关系
  { name: "startTime", type: worldTimeType }, // 世界开始时间
  { name: "players", type: arrayType(withIdType(playerSettingType)) }, // 玩家
] as const)

export type WorldSetting = CookType<typeof worldSettingType>
