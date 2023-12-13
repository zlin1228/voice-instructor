import {
  CookType,
  arrayType,
  int32Type,
  objectType,
  stringType,
  timestampType,
} from "base-core/lib/types.js"
import { worldSettingType } from "./setting.js"
import { worldStateType } from "./state.js"
import { worldRuntimeType } from "./runtime.js"
import { worldEventType } from "./event.js"
import { worldOperationType } from "./operation.js"

export const communitySnapshotType = objectType([
  { name: "worldId", type: stringType },
  { name: "worldRevision", type: int32Type },
  { name: "worldSetting", type: worldSettingType },
  { name: "worldState", type: worldStateType },
  { name: "worldRuntime", type: worldRuntimeType },
])

export type CommunitySnapshot = CookType<typeof communitySnapshotType>

export const communityActionType = objectType([
  { name: "worldId", type: stringType },
  { name: "worldRevision", type: int32Type },
  { name: "worldSetting", type: worldSettingType, optional: true },
  { name: "worldEvents", type: arrayType(worldEventType), optional: true },
  { name: "worldRuntime", type: worldRuntimeType, optional: true },
])

export type CommunityAction = CookType<typeof communityActionType>

export const communityOperationType = objectType([
  { name: "time", type: timestampType },
  { name: "worldId", type: stringType },
  { name: "worldRevision", type: int32Type },
  { name: "worldOperation", type: worldOperationType },
])

export type CommunityOperation = CookType<typeof communityOperationType>
