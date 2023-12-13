import { CookServiceHttpSchema } from "base-core/lib/http-schema.js"
import {
  objectType,
  stringType,
  CookType,
  doubleType,
  emptyObjectType,
  arrayType,
} from "base-core/lib/types.js"

import { worldSettingType } from "../types/setting.js"
import { worldStateType } from "../types/state.js"
import { withIdType } from "../types/common.js"

export const updateWorldSettingRequestType = objectType([
  { name: "worldId", type: stringType },
  { name: "worldSetting", type: worldSettingType },
] as const)

export type UpdateWorldSettingRequest = CookType<
  typeof updateWorldSettingRequestType
>

export const deleteWorldRequestType = objectType([
  { name: "worldId", type: stringType },
] as const)

export type DeleteWorldRequest = CookType<typeof deleteWorldRequestType>

export const startWorldRequestType = objectType([
  { name: "worldId", type: stringType },
  { name: "timeRate", type: doubleType },
  { name: "activeDurationSeconds", type: doubleType, optional: true },
] as const)

export type StartWorldRequest = CookType<typeof startWorldRequestType>

export const stopWorldRequestType = objectType([
  { name: "worldId", type: stringType },
] as const)

export type StopWorldRequest = CookType<typeof stopWorldRequestType>

export const worldType = objectType([
  { name: "worldSetting", type: worldSettingType },
  { name: "worldState", type: worldStateType },
] as const)

export type World = CookType<typeof worldType>

// 游戏世界管理 API
export const lightspeedHttpServiceSchema = [
  {
    kind: "get",
    value: {
      name: "listWorlds",
      query: emptyObjectType,
      response: {
        kind: "json",
        value: arrayType(withIdType(worldType)),
      },
    },
  },
  {
    kind: "post",
    value: {
      name: "createWorld",
      request: {
        kind: "json",
        value: worldSettingType,
      },
      response: {
        kind: "json",
        value: withIdType(worldType),
      },
    },
  },
  {
    kind: "post",
    value: {
      name: "updateWorldSetting",
      request: {
        kind: "json",
        value: updateWorldSettingRequestType,
      },
      response: {
        kind: "json",
        value: emptyObjectType,
      },
    },
  },
  {
    kind: "post",
    value: {
      name: "deleteWorld",
      request: {
        kind: "json",
        value: deleteWorldRequestType,
      },
      response: {
        kind: "json",
        value: emptyObjectType,
      },
    },
  },
  {
    kind: "post",
    value: {
      name: "startWorld",
      request: {
        kind: "json",
        value: startWorldRequestType,
      },
      response: {
        kind: "json",
        value: emptyObjectType,
      },
    },
  },
  {
    kind: "post",
    value: {
      name: "stopWorld",
      request: {
        kind: "json",
        value: stopWorldRequestType,
      },
      response: {
        kind: "json",
        value: emptyObjectType,
      },
    },
  },
] as const

export type LightspeedHttpService = CookServiceHttpSchema<
  typeof lightspeedHttpServiceSchema
>
