import { objectType, stringType, CookType } from "base-core/lib/types.js"
import { worldEventType } from "../types/event.js"

// 玩家通过 /playerControl 建立 WebSocket 连接时，URL query 的类型。
export const playerControlQueryType = objectType([
  { name: "worldId", type: stringType },
])

export type PlayerControlQuery = CookType<typeof playerControlQueryType>

// 玩家希望和某个不在群聊中的 NPC 对话。
// 这个消息会建立一个群聊，并让玩家和 NPC 加入该群聊。
export const playerOperationGroupStartType = objectType([
  { name: "npcId", type: stringType },
])

export type PlayerOperationGroupStart = CookType<
  typeof playerOperationGroupStartType
>

// 玩家希望加入已存在的群聊。
export const playerOperationGroupJoinType = objectType([
  { name: "groupId", type: stringType },
])

export type PlayerOperationGroupJoin = CookType<
  typeof playerOperationGroupJoinType
>

// 玩家希望离开群聊。
export const playerOperationGroupLeaveType = objectType([
  { name: "groupId", type: stringType },
])

export type PlayerOperationGroupLeave = CookType<
  typeof playerOperationGroupLeaveType
>

// 玩家希望在群聊中发言。
// 发言会被所有群聊中的 NPC 和玩家收到。
export const playerOperationGroupPostType = objectType([
  { name: "groupId", type: stringType },
  { name: "content", type: stringType },
])

export type PlayerOperationGroupPost = CookType<
  typeof playerOperationGroupPostType
>

export const playerOperationType = objectType([
  { name: "playerId", type: stringType },
  { name: "type", type: stringType },
  {
    name: "groupStart",
    type: playerOperationGroupStartType,
    optional: true,
  },
  { name: "groupJoin", type: playerOperationGroupJoinType, optional: true },
  {
    name: "groupLeave",
    type: playerOperationGroupLeaveType,
    optional: true,
  },
  { name: "groupPost", type: playerOperationGroupPostType, optional: true },
])

export type PlayerOperation = CookType<typeof playerOperationType>

// WebSocket /playerControl 通讯时，客户端向服务器发送的消息类型。
export const playerControlClientType = objectType([
  { name: "operation", type: playerOperationType, optional: true },
])

export type PlayerControlClient = CookType<typeof playerControlClientType>

// WebSocket /playerControl 通讯时，服务器向客户端发送的消息类型。
export const playerControlServerType = objectType([
  { name: "worldEvent", type: worldEventType, optional: true },
])

export type PlayerControlServer = CookType<typeof playerControlServerType>
