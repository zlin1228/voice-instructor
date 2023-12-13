import { CookServiceHttpSchema } from "base-core/lib/http-schema.js"
import {
  CookType,
  ObjectType,
  doubleType,
  binaryType,
  emptyObjectType,
  int32Type,
  objectType,
  stringType,
  timestampType,
  booleanType,
  arrayType,
  mapType,
  nullableType,
} from "base-core/lib/types.js"
import {
  WorldTime,
  dateToWorldTime,
  withIdType,
  worldTimeToDate,
  worldTimeType,
} from "./common.js"

//////////////////////////////////////////////////////////////////////////////////////////

// 房间
export const roomType = objectType([
  { name: "name", type: stringType }, // 房间名称
  { name: "coordinate", type: stringType, optional: true }, // 房间坐标
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
  { name: "coordinate", type: stringType, optional: true }, // 房间坐标
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
  { name: "description", type: stringType }, //人物简介
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
  { name: "actorPath", type: stringType, optional: true }, // 角色模型路径
  { name: "voiceId", type: stringType, optional: true }, // 角色语音路径
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
  { name: "emotion", type: stringType },
  { name: "action", type: stringType },
  { name: "viewedTwissers", type: arrayType(stringType) },
] as const)

export type NpcState = CookType<typeof npcStateType>

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
  { name: "emotion", type: stringType },
  { name: "action", type: stringType },
])

export type NpcOperationGroupPost = CookType<typeof npcOperationGroupPostType>

// NPC 操作：世界App发言
export const npcOperationTwisserPostType = objectType([
  { name: "twisserId", type: stringType },
  { name: "content", type: stringType },
])

export type NpcOperationTwisserPost = CookType<
  typeof npcOperationTwisserPostType
>

// NPC 操作：世界App留言
export const npcOperationTwisserCommentType = objectType([
  { name: "twisserId", type: stringType },
  { name: "content", type: stringType },
])

export type NpcOperationTwisserComment = CookType<
  typeof npcOperationTwisserCommentType
>

// NPC 操作：世界App点赞
export const npcOperationTwisserLikeType = objectType([
  { name: "twisserId", type: stringType },
])

export type NpcOperationTwisserLike = CookType<
  typeof npcOperationTwisserLikeType
>

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
  {
    name: "twisserPost",
    type: npcOperationTwisserPostType,
    optional: true,
  },
  {
    name: "twisserComment",
    type: npcOperationTwisserCommentType,
    optional: true,
  },
  {
    name: "twisserLike",
    type: npcOperationTwisserLikeType,
    optional: true,
  },
])

export type NpcOperation = CookType<typeof npcOperationType>

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

export const twisserCommentType = objectType([
  { name: "twisserId", type: stringType },
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

export type twisserComment = CookType<typeof twisserCommentType>

export const twisserLikeType = objectType([
  { name: "twisserId", type: stringType },
  {
    name: "owner",
    type: objectType([
      { name: "npcId", type: stringType, optional: true },
      { name: "playerId", type: stringType, optional: true },
    ]),
  },
])

export type twisserLike = CookType<typeof twisserLikeType>

export const twisserType = objectType([
  { name: "twisserId", type: stringType },
  { name: "time", type: worldTimeType },
  {
    name: "author",
    type: objectType([
      { name: "npcId", type: stringType, optional: true },
      { name: "playerId", type: stringType, optional: true },
    ]),
  },
  { name: "content", type: stringType },
  { name: "likes", type: arrayType(twisserLikeType) },
  { name: "comments", type: arrayType(twisserCommentType) },
])

export type twisser = CookType<typeof twisserType>

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
  {
    name: "twissers",
    type: arrayType(twisserType),
  },
] as const)

export type WorldState = CookType<typeof worldStateType>

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

export const worldType = objectType([
  { name: "worldSetting", type: worldSettingType },
  { name: "worldState", type: worldStateType },
  { name: "worldRuntime", type: worldRuntimeType },
] as const)

export type World = CookType<typeof worldType>

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
  },
])

export type WorldOperation = CookType<typeof worldOperationType>

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
  { name: "emotion", type: stringType },
  { name: "action", type: stringType },
])

export type GroupEventPost = CookType<typeof groupEventPostType>

export const groupEventType = objectType([
  { name: "groupId", type: stringType },
  { name: "eventName", type: stringType },
  { name: "join", type: groupEventJoinType, optional: true },
  { name: "post", type: groupEventPostType, optional: true },
])

export type GroupEvent = CookType<typeof groupEventType>

export const worldEventTwisserPostType = objectType([
  { name: "time", type: worldTimeType },
  { name: "npcId", type: stringType, optional: true },
  { name: "playerId", type: stringType, optional: true },
  { name: "content", type: stringType },
])

export type WorldEventTwisserPost = CookType<typeof worldEventTwisserPostType>

export const worldEventTwisserCommentType = objectType([
  { name: "time", type: worldTimeType },
  { name: "npcId", type: stringType, optional: true },
  { name: "playerId", type: stringType, optional: true },
  { name: "content", type: stringType },
])

export type worldEventTwisserComment = CookType<
  typeof worldEventTwisserCommentType
>

export const worldEventTwisserLikeType = objectType([
  { name: "time", type: worldTimeType },
  { name: "npcId", type: stringType, optional: true },
  { name: "playerId", type: stringType, optional: true },
  { name: "twisserId", type: stringType },
])

export type WorldEventTwisserLike = CookType<typeof worldEventTwisserLikeType>

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
  {
    name: "worldEventTwisserPost",
    type: worldEventTwisserPostType,
    optional: true,
  },
  {
    name: "worldEventTwisserComment",
    type: worldEventTwisserCommentType,
    optional: true,
  },
  {
    name: "worldEventTwisserLike",
    type: worldEventTwisserLikeType,
    optional: true,
  },
  { name: "npcEvent", type: npcEventType, optional: true },
  { name: "groupEvent", type: groupEventType, optional: true },
])

export type WorldEvent = CookType<typeof worldEventType>

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

export const resetWorldRequestType = objectType([
  { name: "worldId", type: stringType },
])

export type ResetWorldRequest = CookType<typeof resetWorldRequestType>

export const stopWorldRequestType = objectType([
  { name: "worldId", type: stringType },
] as const)

export type StopWorldRequest = CookType<typeof stopWorldRequestType>

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
      name: "resetWorld",
      request: {
        kind: "json",
        value: resetWorldRequestType,
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

export const playerOperationLikePostType = objectType([
  { name: "twisserId", type: stringType },
  { name: "like", type: booleanType },
])

export type PlayerOperationLikePost = CookType<
  typeof playerOperationLikePostType
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
  { name: "likePost", type: playerOperationLikePostType, optional: true },
])

export type PlayerOperation = CookType<typeof playerOperationType>

export const gameOperationNpcLocationType = objectType([
  { name: "npcId", type: stringType },
  { name: "spot", type: spotType },
])

export type GameOperationNpcLocation = CookType<
  typeof gameOperationNpcLocationType
>

export const gameOperationType = objectType([
  {
    name: "gameOperationNpcLocation",
    type: gameOperationNpcLocationType,
    optional: true,
  },
])

export type GameOperation = CookType<typeof gameOperationType>

// WebSocket /playerControl 通讯时，客户端向服务器发送的消息类型。
export const playerControlClientType = objectType([
  { name: "operation", type: playerOperationType, optional: true },
  { name: "gameOperation", type: gameOperationType, optional: true },
])

export type PlayerControlClient = CookType<typeof playerControlClientType>

// WebSocket /playerControl 通讯时，服务器向客户端发送的消息类型。
export const playerControlServerType = objectType([
  { name: "worldEvent", type: worldEventType, optional: true },
])

export type PlayerControlServer = CookType<typeof playerControlServerType>

//////////////////////////////////////////////////////////////////////////////////////////

export function samePlace(place1: Place, place2: Place): boolean {
  return (
    place1.house?.houseId === place2.house?.houseId &&
    place1.house?.roomId === place2.house?.roomId &&
    place1.building?.buildingId === place2.building?.buildingId &&
    place1.building?.facilityId === place2.building?.facilityId
  )
}

export function sameSpot(spot1: Spot, spot2: Spot): boolean {
  return samePlace(spot1.place, spot2.place) && spot1.groupId === spot2.groupId
}

export function findNpcStateFromWorldState(
  worldState: WorldState,
  npcId: string
): NpcState | undefined {
  const { npcs } = worldState
  for (const npc of npcs) {
    if (npc.npcId === npcId) {
      return npc.npcState
    }
  }
  return undefined
}

export function findNpcRuntimeFromWorldRuntime(
  worldRuntime: WorldRuntime,
  npcId: string
): NpcRuntime | undefined {
  const { npcs } = worldRuntime
  for (const npc of npcs) {
    if (npc.npcId === npcId) {
      return npc.npcRuntime
    }
  }
  return undefined
}

export function realTimeToWorldTime(
  worldState: WorldState,
  realTime: Date
): WorldTime {
  const { activeState } = worldState
  if (activeState === null) {
    throw new Error("World is not active")
  }
  return dateToWorldTime(
    new Date(
      worldTimeToDate(worldState.referenceWorldTime).getTime() +
        (realTime.getTime() - activeState.realTime.getTime()) *
          activeState.timeRate
    )
  )
}

export function worldTimeToRealTime(
  worldRuntime: WorldState,
  worldTime: WorldTime
): Date {
  const { activeState } = worldRuntime
  if (activeState === null) {
    throw new Error("World is not active")
  }
  return new Date(
    activeState.realTime.getTime() +
      (worldTimeToDate(worldTime).getTime() -
        worldTimeToDate(worldRuntime.referenceWorldTime).getTime()) /
        activeState.timeRate
  )
}
