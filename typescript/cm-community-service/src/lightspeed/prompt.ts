import { throwError } from "base-core/lib/exception.js"
import { Scope } from "base-core/lib/scope.js"
import {
  arrayConcat,
  arraySort,
  byKey,
  byKeyIs,
  comparatorChain,
  comparatorExtract,
} from "base-core/lib/array.js"
import { retryable } from "base-core/lib/concurrency.js"
import {
  objectType,
  int32Type,
  stringType,
  CookType,
  arrayType,
  booleanType,
} from "base-core/lib/types.js"
import {
  WithId,
  WorldTime,
  buildRandomId,
  dateToWorldTime,
  worldTimeToDate,
  worldTimeToString,
  worldTimeType,
} from "cm-community-common/lib/schema/common.js"
import {
  Building,
  Facility,
  House,
  NpcSetting,
  NpcAdhocTask,
  NpcPlanTask,
  NpcRelation,
  NpcRoutineTask,
  Place,
  Room,
  WorldSetting,
  facilityType,
  roomType,
  Spot,
  houseType,
  buildingType,
  npcSettingType,
  findNpcStateFromWorldState,
  WorldState,
  samePlace,
  playerSettingType,
  groupType,
  groupMessageType,
  twisserLikeType,
} from "cm-community-common/lib/schema/lightspeed.js"
import { isNotUndefined } from "base-core/lib/utils.js"
import {
  WorldSettingAccessor,
  addBuildingToWorldSetting,
  addHouseToWorldSetting,
  addNpcRelationToWorldSetting,
  addNpcToWorldSetting,
  listValidChatChoices,
} from "./utils.js"
import { renderTextLines, renderTextList } from "base-nli/lib/llm/utils.js"
import { StructuredLlm } from "base-nli/lib/llm/structured.js"
import { LlmClient } from "base-nli/lib/llm/client.js"
import { log } from "base-core/lib/logging.js"
import { stringHash, stringSplitToVector } from "base-core/lib/string.js"
import { OneOf } from "base-core/lib/one-of.js"

export interface NpcReaction {
  content: string
  action: string
  emotion: string
}

const actionsList = [
  "待机",
  "挥手",
  "点头",
  "摇头",
  "抬手",
  "拍手",
  "祈祷",
  "倒退",
  "鞠躬",
  "赞扬",
  "指责",
  "挥拳",
  "难过",
  "叹气",
  "攻击",
  "受击",
]

const emotionList = [
  "平静",
  "快乐",
  "愤怒",
  "悲伤",
  "惊讶",
  "恐惧",
  "蔑视",
  "厌恶",
  "困惑",
  "挤眼",
  "疑虑",
  "嫌弃",
  "羞涩",
  "痛苦",
  "感激",
  "焦虑",
  "奸诈",
]

const promptsByLanguage = {
  zh: {
    assistantRoleInstructions: () =>
      "你是一位出色的中文编剧。你的作品享誉全球，无人能及。你最亲爱的奶奶希望你帮她编写下一个精彩的中文电影剧本。你的所有回答，无论是故事背景、人物计划、人物对话等，请一定使用中文。",
    generateWorldKeywordBag: () =>
      renderTextLines([
        "你的任务是为制作一份电影剧本中常见的关键词列表。列表中至少包含 20 个互不相同的中文单词。这些中文单词的含义必须有很大差别。",
      ]),
    generateWorldGenreBag: () =>
      renderTextLines([
        "你的任务是为制作一份常见的电影剧本题材列表。列表中至少包含 20 个互不相同的题材。这些题材的含义必须有很大差别。",
      ]),
    generateWorldSetting: () =>
      renderTextLines([
        "你的任务是为电影剧本创建一个精彩且不同寻常的故事背景。你会按下面的步骤完成这个任务：",
        renderTextList([
          "写一段 200 字以上的故事背景介绍",
          "写一个在这个故事背景下，忽然发生的一件超乎寻常的重大事件。这个事件必须影响到故事里所有人的生活，但没有人知道这个事件是怎么发生的。",
          "将上面所有的内容整理好提交给奶奶。",
        ]),
        "注意：",
        renderTextList([
          "这个故事背景必须符合任务细节中的指示（hint）。",
          "你的回答中，`title` 是整个故事的标题，这个标题非常吸引人，并且它至少包含5个汉字，但不超过10个汉字。",
          "你的回答中，`title` 不能包含“谜”、“迷”、“之”、“秘”、“密”、“未”、“的”这个几个字。",
          "你的回答中，`time` 是故事发生的时间。",
          "你的回答中，`location` 是故事发生的地方，它必须不是真实的地名，并且只能包含中文文字。",
          "你的回答中，`environment` 是故事环境的描述，充满感官细节，让读者身临其境。它至少包含 10 句话，至少包含 200 字，必须包含 `location` 中的地名，但它不能提及任何具体的人物，也不能包含省略号。" +
            "故事环境必须提到故事发生的时间、人们的生活环境、社会环境、自然环境等。故事环境必须包含一些不寻常的因素。",
          "你的回答中，`background` 是故事的背景，它至少包含 10 句话，至少包含 200 字，必须包含 `location` 中的地名，但它不能提及任何具体的人物，也不能包含省略号。" +
            "故事背景必须提到故事发生前的事情，它应当解释了故事为什么会发生。",
          "你的回答中，`event` 是故事里刚刚发生的重大事件，它至少包含 5 句话，必须包含 `location` 中的地名，但它不能提及任何具体的人物。它出人意料，并且影响故事中的所有人物。",
          "你的回答中，`environment`、`history`、`event` 只能包含中文文字。",
        ]),
      ]),
    generateHouses: (houseCount: number) =>
      renderTextLines([
        `你的任务是为电影剧本中的故事额外添加至少 ${houseCount} 个重要的公寓，公寓是故事中的人物长期居住的地方。每个公寓包含 1-3 个单元。`,
        "注意：",
        renderTextList([
          `你必须一次性回答所有 ${houseCount} 个公寓。`,
          "你的回答不能包含任务细节里已经有的公寓。",
          "你的回答中，公寓和单元的名字都必须各不相同，并且和故事风格一致。",
          "你的回答中，公寓的名字应当有各自的特色，没有互相重复的文字。",
          "你的回答中，公寓的名字不能和现实中的任何知名地点重名。",
        ]),
      ]),
    generateBuildings: (buildingCount: number) =>
      renderTextLines([
        `你的任务是为电影剧本中的故事额外添加至少 ${buildingCount} 个重要的建筑，每个建筑包含 1-3 个工作地点。`,
        "注意：",
        renderTextList([
          `你必须一次性回答所有 ${buildingCount} 个建筑。`,
          "你的回答不能包含任务细节里已经有的建筑。",
          "你的回答中，建筑和工作地点的名字都必须各不相同，并且和故事风格一致。",
          "你的回答中，建筑的名字应当有各自的特色，没有互相重复的文字。",
          "你的回答中，建筑中的工作地点应当对应不同的职业。",
          "你的回答中，建筑必须是以楼房的形式存在，不能是一个村庄、城市等。",
          "你的回答中，建筑的名字不能和现实中的任何知名建筑重名。",
          "你的回答中，工作地点的名字不能和现实中的任何知名地点重名。",
        ]),
      ]),
    generateNpcs: (npcCount: number) =>
      renderTextLines([
        `你的任务是为电影剧本中的故事额外添加 ${npcCount} 个重要的人物。`,
        "注意：",
        renderTextList([
          `你必须一次性回答所有 ${npcCount} 个人物。`,
          "你回答的人物必须和故事中现有的人物不同。",
          "你的回答中，每个人物都必须居住在故事中的某个单元（unitName）里。",
          "你的回答中，每个人物都必须在故事中的某个工作地点（workplaceName）里工作。",
          "你的回答中，人物的名字都必须各不相同，并且和故事风格一致。",
          "你的回答中，人物的名字必须有至少2个字，但不超过5个字。",
          "你的回答中，人物的名字应当有各自的特色，没有互相重复的文字，并且不是常见的词汇或短语。",
          "你的回答中，人物的短期目标和长期目标必须和故事中的背景、事件、其它人物有关系。",
          "你的回答中，人物的性别（gender）必须是“F”（表示女性）或者“M”（表示男性）。",
          "你的回答中，人物的名字不能和现实中的任何知名人物重名。",
        ]),
      ]),
    generateNpcRelations: () =>
      renderTextLines([
        `你的任务是为电影剧本中的故事添加更多的人物关系。`,
        "注意：",
        renderTextList([
          "你的回答中，人物必须和故事里提到的另外1-3个人物有关系（relations），比如朋友、情侣、夫妻、父子、同事等。关系只能用2-3个字形容。",
          "你的回答中，如果一个人物已经和故事里的另一个人物有关系，那么不要再再次添加这两个人物之间的关系。",
          "你的回答中，人物关系必须合理。比如说，如果两个人是同事关系，那么他们必须具有相同的职业。再比如说，如果两个人是夫妻关系，那么他们必须住在同一个单元。",
        ]),
      ]),
    generateNpcRoutine: (npcName: string) =>
      renderTextLines([
        `你的任务是为电影剧本中的人物（${npcName}）设定每天固定的日程安排，比如睡觉、吃早饭、工作、吃午饭、购物、吃完饭、学习等。`,
        "注意：",
        renderTextList([
          `人物的日常安排必须合理，并且符合人物特质。`,
          "你的回答中，`time`必须表示日程中该项的起始时间。它的格式必须是“HH:mm”，其中HH是0-23之间的两位整数，mm是0-59之间的两位整数。比如，“16:04”表示16点04分。",
          "你的回答中，`what`表示人物在这个日程时间段里要做的事情。",
          "你的回答中，`place`必须包含人物应该前往的地点。这个地点必须是故事中住宅里的某个单元（unitName）或者建筑中的某个地点（workplaceName）。",
        ]),
      ]),
    generateNpcPlan: (npcName: string) =>
      renderTextLines([
        `你的任务是为电影剧本中的人物（${npcName}）设定将来24小时的计划，比如睡觉、吃早饭、工作、吃午饭、购物、吃完饭、学习等。`,
        "注意：",
        renderTextList([
          `人物的计划安排必须合理，并且符合人物特质。`,
          `人物的计划大体上参照人物的日常安排（routine）和原来的计划（currentPlan），但是可以根据当前发生的事情做出一些变化。`,
          `如果人物最近收到消息（messages），那么计划必须和消息内容一致。`,
          `人物在深夜的时候必须在居住地睡觉。`,
          "你的回答中，`date_time`必须表示计划中该项的起始时间。它的格式必须是“YYYY-MM-DD HH:mm”，其中HH是0-23之间的两位整数，mm是0-59之间的两位整数。比如，“2050-11-03 16:04”表示2050年11月3日16点04分。",
          "你的回答中，`what`表示人物计划在这段时间里要做的事情。这个计划不能涉及到故事里出现过的其它人物。",
          "你的回答中，`place`必须包含人物应该前往的地点。这个地点必须是故事中住宅里的某个单元（unitName）或者建筑中的某个地点（workplaceName）。",
          "你的回答中，最后一项计划的时间`date_time`必须比原来的计划（currentPlan）中的最后一项的时间更晚。",
          "你的回答中，至少包含3个计划。",
          "如果当前时间是晚上，你的回答中应当包含第二天的计划。",
        ]),
      ]),
    decideChatChoice: (npcName: string) =>
      renderTextLines([
        `你的任务是为电影剧本中的人物（${npcName}）决定要和谁开始对话。`,
        "注意：",
        renderTextList([
          `人物对话安排必须合理，并且符合人物特质。`,
          "`chatChoices`是正在进行的群聊。其中`groupName`是群聊的名字，`characterNames`是群聊中的人物。",
          "你的回答中，`reason`是你做这个决定的原因。",
          "你的回答中，如果人物不希望和任何人对话，那么`groupName`是空字符串，`characterNames`是空数组。否则，在任务细节中的 `chatChoices` 选择最合适的一个群聊。",
        ]),
      ]),
    decideChatContent: (
      npcName: string,
      recipients: string[],
      emotionList: string[],
      actionsList: string[]
    ) =>
      renderTextLines([
        `你的任务是为电影剧本中的人物（${npcName}）决定下一句话对在场的其他人（${recipients.join(
          "，"
        )}）说什么。`,
        "注意：",
        renderTextList([
          `人物对话安排必须合理，并且符合人物特质。`,
          "你的回答中，`content`应当包含人物在群聊中的下一句话。它不应当重复之前对话中的内容。如果人物不希望说任何话，那么`content`是空字符串。",
          "你的回答中，`content`应当是口语化、非正式、随意的，只能包含一两句话。非必要，一次回答不要超过50个字。话语的风格应当像是朋友之间的聊天，而不是正式的书面语。",
          "你的回答中，`content`应当是针对群聊中最后一次发言的回复。",
          "你的回答中，`content`应当避免重复群聊中类似或者一样的内容。如果没有新的内容，`content`应当是空字符串以表示不再说话。",
          "你的回答中，`content`应当避免重复群内其他人说话的内容。如果没有新的内容，`content`应当是空字符串以表示不再说话。",
          "你的回答中，`content`必须避免回答不是针对自己提问的问题，如果该成员不在群内，可以给予提示。",
          "你的回答中，`content`必须完全是中文。",
          "你的回答中，`content`必须只能包含中文。",
          "你的回答中，`content`不能包含英文。",
          "你的回答中，`reason`是回复的原因。",
          "你的回答中，`emotion`必须是`emotionList`中的，并且符合`content`的最贴切的一个。",
          "你的回答中，`action`必须是`actionList`中的，并且符合`content`的最贴切的一个。",
        ]),
      ]),
    decideTwisserContent: (npcName: string) =>
      renderTextLines([
        `你的任务是为电影剧本中的人物（${npcName}）决定这个人物应该发表什么感想。`,
        "注意：",
        renderTextList([
          `人物对话安排必须合理，并且符合人物特质。`,
          "你的回答中，`content`必须用第一人称。",
          "你的回答中，`content`应当包含人物在工作、生活、聊天、计划中的任何相关的内容和想法。",
          "你的回答中，`content`应当主要在人物执行计划时更新，其次是在非工作时间更新，偶尔在上班摸鱼的时候更新。",
          "你的回答中，`content`应当是口语化、非正式、随意的。非必要，一次回答不要超过200个字。",
          "你的回答中，`content`必须完全是中文。",
          "你的回答中，`content`必须只能包含中文。",
          "你的回答中，`content`不能包含英文。",
          "你的回答中，`reason`是发表这个感想的原因。",
        ]),
      ]),
    decideTwisserCommentContent: (npcName: string, twisserId: string) =>
      renderTextLines([
        `你的任务是为电影剧本中的人物（${npcName}）的发言（${twisserId}）进行回复。`,
        "注意：",
        renderTextList([
          `人物对话安排必须合理，并且符合人物特质。`,
          "你的回答中，`content`应当结合你和人物的关系",
          "你的回答中，`content`必须注意人物的性别",
          "你的回答中，`content`应当结合之前所有的回复",
          "你的回答中，`content`应当主要在人物执行计划时更新，其次是在非工作时间更新，偶尔在上班摸鱼的时候更新。",
          "你的回答中，`content`应当是口语化、非正式、随意的。非必要，一次回答不要超过100个字。",
          "你的回答中，`content`必须完全是中文。",
          "你的回答中，`content`必须只能包含中文。",
          "你的回答中，`content`不能包含英文。",
          "你的回答中，`reason`是发表这个回复的原因。",
        ]),
      ]),
    decideTwisserLike: (npcName: string, twisserId: string) =>
      renderTextLines([
        `你的任务是判断是否喜欢电影剧本中的人物（${npcName}）的发言（${twisserId}）。`,
        "注意：",
        renderTextList([
          "你的回答中，`reason`是喜欢或者不喜欢这个发言的原因。",
          "你的回答中，`like`必须是喜欢或者不喜欢这个发言。",
        ]),
      ]),
  },
}

const housePromptType = objectType([
  { name: "name", type: stringType },
  { name: "description", type: stringType },
  { name: "units", type: arrayType(roomType) },
])

type HousePrompt = CookType<typeof housePromptType>

function buildPromptFromHouse(house: House): HousePrompt {
  return {
    name: house.name,
    description: house.description,
    units: house.rooms.map((room) => ({
      name: room.name,
    })),
  }
}

function buildHouseFromPrompt(house: HousePrompt): WithId<House> {
  return {
    _id: buildRandomId(),
    name: house.name,
    description: house.description,
    rooms: house.units.map((unit) => ({
      _id: buildRandomId(),
      name: unit.name,
    })),
  }
}

const roomListPromptType = arrayType(
  objectType([
    { name: "description", type: stringType },
    {
      name: "units",
      type: arrayType(objectType([{ name: "unitName", type: stringType }])),
    },
  ])
)

type RoomListPrompt = CookType<typeof roomListPromptType>

function buildPromptFromWorldRooms(worldSetting: WorldSetting): RoomListPrompt {
  return worldSetting.houses.map((house) => {
    return {
      description: house.description,
      units: house.rooms.map((room) => {
        return {
          unitName: WorldSettingAccessor.getHouseAndRoomHash(
            house._id,
            room._id
          ),
        }
      }),
    }
  })
}

const buildingPromptType = objectType([
  { name: "name", type: stringType },
  { name: "description", type: stringType },
  { name: "workplaces", type: arrayType(facilityType) },
] as const)

type BuildingPrompt = CookType<typeof buildingPromptType>

function buildPromptFromBuilding(building: Building): BuildingPrompt {
  return {
    name: building.name,
    description: building.description,
    workplaces: building.facilities.map((facility) => ({
      name: facility.name,
      description: facility.description,
    })),
  }
}

function buildBuildingFromPrompt(building: BuildingPrompt): WithId<Building> {
  return {
    _id: buildRandomId(),
    name: building.name,
    description: building.description,
    facilities: building.workplaces.map((facility) => ({
      _id: buildRandomId(),
      name: facility.name,
      description: facility.description,
    })),
  }
}

const facilityListPromptType = arrayType(
  objectType([
    { name: "buildingDescription", type: stringType },
    {
      name: "workplaces",
      type: arrayType(
        objectType([
          { name: "workplaceName", type: stringType },
          { name: "workplaceDescription", type: stringType },
        ])
      ),
    },
  ])
)

type FacilityListPrompt = CookType<typeof facilityListPromptType>

function buildPromptFromWorldFacilities(
  worldSetting: WorldSetting
): FacilityListPrompt {
  return worldSetting.buildings.map((building) => {
    return {
      buildingDescription: building.description,
      workplaces: building.facilities.map((facility) => {
        return {
          workplaceName: WorldSettingAccessor.getBuildingAndFacilityHash(
            building._id,
            facility._id
          ),
          workplaceDescription: facility.description,
        }
      }),
    }
  })
}

const npcPromptType = objectType([
  { name: "name", type: stringType }, // 姓名
  { name: "gender", type: stringType }, // 性别, valid values: "male" | "female"
  { name: "age", type: int32Type }, // 年龄
  { name: "description", type: stringType }, //人物简介
  { name: "occupation", type: stringType }, // 职业
  { name: "personality", type: stringType }, // 性格
  { name: "specialty", type: stringType }, // 特长
  { name: "hobby", type: stringType }, // 爱好
  { name: "shortTermGoal", type: stringType }, // 短期目标
  { name: "longTermGoal", type: stringType }, // 长期目标
  { name: "residence", type: stringType }, // 居住地
  { name: "workplace", type: stringType }, // 工作地
])

type NpcPrompt = CookType<typeof npcPromptType>

export function buildPromptFromNpc(
  worldSetting: WorldSetting,
  npc: NpcSetting
): NpcPrompt {
  const accessor = new WorldSettingAccessor(worldSetting)
  const { house, room } = accessor.getHouseAndRoomById(
    npc.residenceHouseId,
    npc.residenceRoomId
  )
  const { building, facility } = accessor.getBuildingAndFacilityById(
    npc.workBuildingId,
    npc.workFacilityId
  )
  return {
    name: npc.name,
    gender: npc.gender,
    age: npc.age,
    description: npc.description,
    occupation: npc.occupation,
    personality: npc.personality,
    specialty: npc.specialty,
    hobby: npc.hobby,
    shortTermGoal: npc.shortTermGoal,
    longTermGoal: npc.longTermGoal,
    residence: WorldSettingAccessor.getHouseAndRoomHash(house._id, room._id),
    workplace: WorldSettingAccessor.getBuildingAndFacilityHash(
      building._id,
      facility._id
    ),
  }
}

function buildNpcFromPrompt(
  worldSetting: WorldSetting,
  npc: NpcPrompt
): WithId<NpcSetting> {
  const accessor = new WorldSettingAccessor(worldSetting)
  const { house, room } = accessor.getHouseAndRoomByHash(npc.residence)
  const { building, facility } = accessor.getBuildingAndFacilityByHash(
    npc.workplace
  )
  return {
    _id: buildRandomId(),
    name: npc.name,
    gender: npc.gender,
    age: npc.age,
    description: npc.description,
    occupation: npc.occupation,
    personality: npc.personality,
    specialty: npc.specialty,
    hobby: npc.hobby,
    shortTermGoal: npc.shortTermGoal,
    longTermGoal: npc.longTermGoal,
    residenceHouseId: house._id,
    residenceRoomId: room._id,
    workBuildingId: building._id,
    workFacilityId: facility._id,
  }
}

const npcRelationPromptType = objectType([
  { name: "name1", type: stringType },
  { name: "name2", type: stringType },
  { name: "relation", type: stringType },
])

type NpcRelationPrompt = CookType<typeof npcRelationPromptType>

function buildPromptFromNpcRelation(
  worldSetting: WorldSetting,
  npcRelation: NpcRelation
): NpcRelationPrompt {
  const accessor = new WorldSettingAccessor(worldSetting)
  const npc1 = accessor.getNpcById(npcRelation.npc1Id)
  const npc2 = accessor.getNpcById(npcRelation.npc2Id)
  return {
    name1: npc1.name,
    name2: npc2.name,
    relation: npcRelation.relation,
  }
}

function buildNpcRelationFromPrompt(
  worldSetting: WorldSetting,
  npcRelationPrompt: NpcRelationPrompt
): WithId<NpcRelation> {
  const accessor = new WorldSettingAccessor(worldSetting)
  return {
    _id: buildRandomId(),
    npc1Id: accessor.getNpcByName(npcRelationPrompt.name1)._id,
    npc2Id: accessor.getNpcByName(npcRelationPrompt.name2)._id,
    relation: npcRelationPrompt.relation,
  }
}

const npcRoutineTaskPromptType = objectType([
  { name: "time", type: stringType },
  { name: "what", type: stringType },
  { name: "place", type: stringType },
] as const)

type NpcRoutineTaskPrompt = CookType<typeof npcRoutineTaskPromptType>

function hourMinuteToPrompt(hour: number, minute: number): string {
  return `${hour.toFixed().padStart(2, "0")}:${minute
    .toFixed()
    .padStart(2, "0")}`
}

function promptToHourMinute(time: string): {
  hour: number
  minute: number
} {
  if (time.length > 5) {
    time = time.slice(0, 5)
  }
  if (time.length !== 5) {
    throw new Error(`Invalid time: ${time}`)
  }
  if (time[2] !== ":") {
    throw new Error(`Invalid time: ${time}`)
  }
  let hour = Number(time.slice(0, 2))
  const minute = Number(time.slice(3, 5))
  if (isNaN(hour) || isNaN(minute)) {
    throw new Error(`Invalid time: ${time}`)
  }
  if (hour === 24) {
    hour = 0
  }
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error(`Invalid time: ${time}`)
  }
  return { hour, minute }
}

function placeToPrompt(place: Place): string {
  if (place.house !== undefined) {
    return WorldSettingAccessor.getHouseAndRoomHash(
      place.house.houseId,
      place.house.roomId
    )
  } else if (place.building !== undefined) {
    return WorldSettingAccessor.getBuildingAndFacilityHash(
      place.building.buildingId,
      place.building.facilityId
    )
  }
  throw new Error(`Invalid place: ${JSON.stringify(place)}}`)
}

function buildPromptFromNpcRoutineTask(
  npcRoutineTask: NpcRoutineTask
): NpcRoutineTaskPrompt {
  return {
    time: hourMinuteToPrompt(npcRoutineTask.hour, npcRoutineTask.minute),
    what: npcRoutineTask.what,
    place: placeToPrompt(npcRoutineTask.place),
  }
}

export function placeToString(
  worldSetting: WorldSetting,
  place: Place
): string {
  const accessor = new WorldSettingAccessor(worldSetting)
  if (place.house !== undefined) {
    const { house, room } = accessor.getHouseAndRoomById(
      place.house.houseId,
      place.house.roomId
    )
    return `${house.name}${room.name}`
  }
  if (place.building !== undefined) {
    const { building, facility } = accessor.getBuildingAndFacilityById(
      place.building.buildingId,
      place.building.facilityId
    )
    return `${building.name}${facility.name}`
  }

  throw new Error("Invalid place")
}

export function spotToString(worldSetting: WorldSetting, spot: Spot): string {
  return `${placeToString(worldSetting, spot.place)}(${spot.groupId})`
}

export function npcToString(worldSetting: WorldSetting, npcId: string): string {
  const accessor = new WorldSettingAccessor(worldSetting)
  const npc = accessor.getNpcById(npcId)
  return `${npc.name}(${npc._id})`
}

function fixWhat(worldSetting: WorldSetting, what: string): string {
  for (const house of worldSetting.houses) {
    for (const room of house.rooms) {
      what = what.replaceAll(
        WorldSettingAccessor.getHouseAndRoomHash(house._id, room._id),
        `[${house.name}-${room.name}]`
      )
    }
  }
  for (const building of worldSetting.buildings) {
    for (const facility of building.facilities) {
      what = what.replaceAll(
        WorldSettingAccessor.getBuildingAndFacilityHash(
          building._id,
          facility._id
        ),
        `[${building.name}-${facility.name}]`
      )
    }
  }
  return what
}

function buildNpcRoutineTaskFromPrompt(
  worldSetting: WorldSetting,
  npcRoutineTask: NpcRoutineTaskPrompt
): NpcRoutineTask {
  const accessor = new WorldSettingAccessor(worldSetting)
  const { hour, minute } = promptToHourMinute(npcRoutineTask.time)
  const place = accessor.getPlaceByHash(npcRoutineTask.place)
  let what = fixWhat(worldSetting, npcRoutineTask.what)
  return {
    hour,
    minute,
    what,
    place,
  }
}

const npcPlanTaskPromptType = objectType([
  { name: "date_time", type: stringType },
  { name: "what", type: stringType },
  { name: "place", type: stringType },
] as const)

type NpcPlanTaskPrompt = CookType<typeof npcPlanTaskPromptType>

function worldTimeToPrompt(worldTime: WorldTime): string {
  return worldTimeToString(worldTime)
}

function promptToWorldTime(worldTime: string): WorldTime {
  const [YYYYMMDD, HHmm] =
    stringSplitToVector(worldTime, " ", 2) ?? throwError("Invalid worldTime")
  const [YYYY, MM, DD] =
    stringSplitToVector(YYYYMMDD, "-", 3) ?? throwError("Invalid worldTime")
  const [HH, mm] =
    stringSplitToVector(HHmm, ":", 2) ?? throwError("Invalid worldTime")
  const date = new Date(
    Number(YYYY),
    Number(MM) - 1,
    Number(DD),
    Number(HH),
    Number(mm)
  )
  if (isNaN(date.getTime())) {
    throwError("Invalid worldTime")
  }
  return dateToWorldTime(date)
}

function buildNpcPlanTaskFromPrompt(
  worldSetting: WorldSetting,
  npcPlanTask: NpcPlanTaskPrompt
): NpcPlanTask {
  const accessor = new WorldSettingAccessor(worldSetting)
  return {
    time: promptToWorldTime(npcPlanTask.date_time),
    what: fixWhat(worldSetting, npcPlanTask.what),
    place: accessor.getPlaceByHash(npcPlanTask.place),
  }
}

function buildPromptFromNpcPlanTask(
  npcPlanTask: NpcPlanTask
): NpcPlanTaskPrompt {
  return {
    date_time: worldTimeToPrompt(npcPlanTask.time),
    what: npcPlanTask.what,
    place: placeToPrompt(npcPlanTask.place),
  }
}

export class LightspeedPrompt {
  readonly #language: keyof typeof promptsByLanguage
  readonly #structuredLlm: StructuredLlm

  constructor(llmClient: LlmClient, language: keyof typeof promptsByLanguage) {
    this.#language = language
    this.#structuredLlm = new StructuredLlm(
      llmClient,
      language,
      promptsByLanguage[this.#language].assistantRoleInstructions()
    )
  }

  async generateWorldKeywordBag(scope: Scope, hint: string): Promise<string[]> {
    const callable = this.#structuredLlm.buildCallable(
      objectType([{ name: "hint", type: stringType }]),
      objectType([{ name: "keywords", type: arrayType(stringType) }]),
      promptsByLanguage[this.#language].generateWorldKeywordBag(),
      0.5
    )
    return [...new Set((await callable(scope, { hint })).keywords)]
  }

  async generateWorldGenreBag(scope: Scope, hint: string): Promise<string[]> {
    const callable = this.#structuredLlm.buildCallable(
      objectType([{ name: "hint", type: stringType }]),
      objectType([{ name: "genres", type: arrayType(stringType) }]),
      promptsByLanguage[this.#language].generateWorldGenreBag(),
      0.5
    )
    return [...new Set((await callable(scope, { hint })).genres)]
  }

  async generateWorldSetting(
    scope: Scope,
    hint: string
  ): Promise<WorldSetting> {
    const callable = this.#structuredLlm.buildCallable(
      objectType([{ name: "hint", type: stringType }] as const),
      objectType([
        { name: "title", type: stringType },
        { name: "time", type: worldTimeType },
        { name: "location", type: stringType },
        { name: "environment", type: stringType },
        { name: "background", type: stringType },
        { name: "event", type: stringType },
      ]),
      promptsByLanguage[this.#language].generateWorldSetting(),
      1.0
    )
    const response = await callable(scope, { hint })
    return {
      name: response.location + "-" + response.title,
      description:
        response.environment +
        "\n" +
        response.background +
        "\n" +
        response.event,
      houses: [],
      buildings: [],
      npcs: [],
      npcRelations: [],
      startTime: response.time,
      players: [],
    }
  }

  async generateHouses(
    scope: Scope,
    hint: string,
    worldSetting: WorldSetting,
    houseCount: number
  ): Promise<WithId<House>[]> {
    const callable = this.#structuredLlm.buildCallable(
      objectType([
        {
          name: "hint",
          type: stringType,
        },
        {
          name: "description",
          type: stringType,
        },
        {
          name: "apartments",
          type: arrayType(housePromptType),
        },
      ] as const),
      objectType([
        { name: "apartments", type: arrayType(housePromptType) },
      ] as const),
      promptsByLanguage[this.#language].generateHouses(houseCount),
      0.2
    )
    const result: WithId<House>[] = []
    while (result.length < houseCount) {
      await retryable(3, async () => {
        const response = await callable(scope, {
          hint,
          description: worldSetting.description,
          apartments: worldSetting.houses.map((house) =>
            buildPromptFromHouse(house)
          ),
        })
        const houses = response.apartments.map((apartment) =>
          buildHouseFromPrompt(apartment)
        )
        const validHouses: WithId<House>[] = []
        for (const house of houses) {
          try {
            worldSetting = addHouseToWorldSetting(worldSetting, house)
            validHouses.push(house)
          } catch (e) {
            log.info(`Ignore invalid house due to: ${String(e)}`)
          }
        }
        if (validHouses.length === 0) {
          throw new Error("No valid house generated")
        }
        result.push(...validHouses)
      })
    }
    return result
  }

  async generateBuildings(
    scope: Scope,
    hint: string,
    worldSetting: WorldSetting,
    buildingCount: number
  ): Promise<WithId<Building>[]> {
    const callable = this.#structuredLlm.buildCallable(
      objectType([
        {
          name: "hint",
          type: stringType,
        },
        {
          name: "description",
          type: stringType,
        },
        {
          name: "buildings",
          type: arrayType(buildingPromptType),
        },
      ] as const),
      objectType([
        { name: "buildings", type: arrayType(buildingPromptType) },
      ] as const),
      promptsByLanguage[this.#language].generateBuildings(buildingCount),
      0.2
    )
    const result: WithId<Building>[] = []
    while (result.length < buildingCount) {
      await retryable(3, async () => {
        const response = await callable(scope, {
          hint,
          description: worldSetting.description,
          buildings: worldSetting.buildings.map((building) =>
            buildPromptFromBuilding(building)
          ),
        })
        const buildings = response.buildings.map((building) =>
          buildBuildingFromPrompt(building)
        )
        const validBuildings: WithId<Building>[] = []
        for (const building of buildings) {
          try {
            worldSetting = addBuildingToWorldSetting(worldSetting, building)
            validBuildings.push(building)
          } catch (e) {
            log.info(`Ignore invalid building due to: ${String(e)}`)
          }
        }
        if (validBuildings.length === 0) {
          throw new Error("No valid building generated")
        }
        result.push(...validBuildings)
      })
    }
    return result
  }

  async generateNpcs(
    scope: Scope,
    hint: string,
    worldSetting: WorldSetting,
    npcCount: number
  ): Promise<WithId<NpcSetting>[]> {
    const callable = this.#structuredLlm.buildCallable(
      objectType([
        {
          name: "hint",
          type: stringType,
        },
        {
          name: "description",
          type: stringType,
        },
        {
          name: "apartments",
          type: roomListPromptType,
        },
        {
          name: "buildings",
          type: facilityListPromptType,
        },
        {
          name: "characters",
          type: arrayType(npcPromptType),
        },
      ] as const),
      objectType([
        { name: "characters", type: arrayType(npcPromptType) },
      ] as const),
      promptsByLanguage[this.#language].generateNpcs(npcCount),
      0.2
    )
    const result: WithId<NpcSetting>[] = []
    while (result.length < npcCount) {
      await retryable(3, async () => {
        const response = await callable(scope, {
          hint,
          description: worldSetting.description,
          apartments: buildPromptFromWorldRooms(worldSetting),
          buildings: buildPromptFromWorldFacilities(worldSetting),
          characters: worldSetting.npcs.map((npc) =>
            buildPromptFromNpc(worldSetting, npc)
          ),
        })
        const npcs = response.characters.map((character) =>
          buildNpcFromPrompt(worldSetting, character)
        )
        const validNpcs: WithId<NpcSetting>[] = []
        for (const npc of npcs) {
          try {
            worldSetting = addNpcToWorldSetting(worldSetting, npc)
            validNpcs.push(npc)
          } catch (e) {
            log.info(`Ignore invalid NPC due to: ${String(e)}`)
          }
        }
        if (validNpcs.length === 0) {
          throw new Error("No valid NPC generated")
        }
        result.push(...validNpcs)
      })
    }
    return result
  }

  async generateNpcRelations(
    scope: Scope,
    hint: string,
    worldSetting: WorldSetting
  ): Promise<WithId<NpcRelation>[]> {
    const callable = this.#structuredLlm.buildCallable(
      objectType([
        {
          name: "hint",
          type: stringType,
        },
        {
          name: "description",
          type: stringType,
        },
        {
          name: "apartments",
          type: roomListPromptType,
        },
        {
          name: "buildings",
          type: facilityListPromptType,
        },
        {
          name: "characters",
          type: arrayType(npcPromptType),
        },
        {
          name: "relations",
          type: arrayType(npcRelationPromptType),
        },
      ] as const),
      objectType([
        { name: "relations", type: arrayType(npcRelationPromptType) },
      ] as const),
      promptsByLanguage[this.#language].generateNpcRelations(),
      0.2
    )
    const result: WithId<NpcRelation>[] = []
    while (
      result.length <
      ([0, 0, 1, 2, 3, 6][worldSetting.npcs.length] ??
        worldSetting.npcs.length * 1.5)
    ) {
      await retryable(3, async () => {
        const response = await callable(scope, {
          hint,
          description: worldSetting.description,
          apartments: buildPromptFromWorldRooms(worldSetting),
          buildings: buildPromptFromWorldFacilities(worldSetting),
          characters: worldSetting.npcs.map((npc) =>
            buildPromptFromNpc(worldSetting, npc)
          ),
          relations: worldSetting.npcRelations.map((relation) =>
            buildPromptFromNpcRelation(worldSetting, relation)
          ),
        })
        const relations = response.relations.map((relation) =>
          buildNpcRelationFromPrompt(worldSetting, relation)
        )
        const validRelations: WithId<NpcRelation>[] = []
        for (const relation of relations) {
          try {
            worldSetting = addNpcRelationToWorldSetting(worldSetting, relation)
            validRelations.push(relation)
          } catch (e) {
            log.info(`Ignore invalid NPC relation due to: ${String(e)}`)
          }
        }
        if (validRelations.length === 0) {
          throw new Error("No valid NPC relation generated")
        }
        result.push(...validRelations)
      })
    }
    return result
  }

  async generateNpcRoutine(
    scope: Scope,
    hint: string,
    worldSetting: WorldSetting,
    npcId: string
  ): Promise<NpcRoutineTask[]> {
    const accessor = new WorldSettingAccessor(worldSetting)
    const npc = accessor.getNpcById(npcId)
    const callable = this.#structuredLlm.buildCallable(
      objectType([
        {
          name: "hint",
          type: stringType,
        },
        {
          name: "description",
          type: stringType,
        },
        {
          name: "apartments",
          type: roomListPromptType,
        },
        {
          name: "buildings",
          type: facilityListPromptType,
        },
        {
          name: "character",
          type: npcPromptType,
        },
      ]),
      objectType([
        {
          name: "routineTasks",
          type: arrayType(npcRoutineTaskPromptType),
        },
      ]),
      promptsByLanguage[this.#language].generateNpcRoutine(npc.name),
      0.2
    )
    return await retryable(3, async () => {
      const response = await callable(scope, {
        hint,
        description: worldSetting.description,
        apartments: buildPromptFromWorldRooms(worldSetting),
        buildings: buildPromptFromWorldFacilities(worldSetting),
        character: buildPromptFromNpc(worldSetting, npc),
      })
      const routineTasks = response.routineTasks.map((task) =>
        buildNpcRoutineTaskFromPrompt(worldSetting, task)
      )
      return arraySort(
        routineTasks,
        comparatorChain(
          comparatorExtract<NpcRoutineTask>(byKey("hour")),
          comparatorExtract<NpcRoutineTask>(byKey("minute"))
        )
      )
    })
  }

  async generateNpcPlan(
    scope: Scope,
    hint: string,
    worldSetting: WorldSetting,
    worldTime: WorldTime,
    npcId: string,
    routineTasks: readonly NpcRoutineTask[],
    currentPlanTasks: readonly NpcPlanTask[],
    worldState: WorldState
  ): Promise<NpcPlanTask[]> {
    const accessor = new WorldSettingAccessor(worldSetting)
    const npc = accessor.getNpcById(npcId)
    const npcState = findNpcStateFromWorldState(worldState, npcId)
    const groupId =
      npcState?.location.staying?.groupId ??
      npcState?.location.moving?.spot.groupId
    const group =
      groupId === undefined
        ? undefined
        : worldState.groups.find(byKeyIs("groupId", groupId))?.group
    const messages =
      group?.messages.map((message) => ({
        name:
          message.author.npcId !== undefined
            ? worldSetting.npcs.find(byKeyIs("_id", message.author.npcId))
                ?.name ?? "(unknown)"
            : message.author.playerId !== undefined
            ? worldSetting.players.find(byKeyIs("_id", message.author.playerId))
                ?.name ?? "(unknown)"
            : "(unknown)",
        content: message.content,
      })) ?? []
    const callable = this.#structuredLlm.buildCallable(
      objectType([
        {
          name: "hint",
          type: stringType,
        },
        {
          name: "description",
          type: stringType,
        },
        {
          name: "apartments",
          type: roomListPromptType,
        },
        {
          name: "buildings",
          type: facilityListPromptType,
        },
        {
          name: "character",
          type: npcPromptType,
        },
        {
          name: "routine",
          type: arrayType(npcRoutineTaskPromptType),
        },
        {
          name: "currentTime",
          type: stringType,
        },
        {
          name: "currentPlan",
          type: arrayType(npcPlanTaskPromptType),
        },
        {
          name: "messages",
          type: arrayType(
            objectType([
              { name: "name", type: stringType },
              { name: "content", type: stringType },
            ])
          ),
        },
      ]),
      objectType([
        {
          name: "newPlan",
          type: arrayType(npcPlanTaskPromptType),
        },
      ]),
      promptsByLanguage[this.#language].generateNpcPlan(npc.name),
      0.2
    )
    return await retryable(3, async () => {
      const response = await callable(scope, {
        hint,
        description: worldSetting.description,
        apartments: buildPromptFromWorldRooms(worldSetting),
        buildings: buildPromptFromWorldFacilities(worldSetting),
        character: buildPromptFromNpc(worldSetting, npc),
        routine: routineTasks.map((task) =>
          buildPromptFromNpcRoutineTask(task)
        ),
        currentTime: worldTimeToPrompt(worldTime),
        currentPlan: currentPlanTasks.map((task) =>
          buildPromptFromNpcPlanTask(task)
        ),
        messages,
      })
      const planTasks = response.newPlan.map((task) =>
        buildNpcPlanTaskFromPrompt(worldSetting, task)
      )
      if (planTasks.length === 0) {
        throw new Error("No valid NPC plan generated")
      }
      return arraySort(
        planTasks,
        comparatorChain(
          comparatorExtract<NpcPlanTask>((task) =>
            worldTimeToDate(task.time).getTime()
          )
        )
      )
    })
  }

  async decideChatChoice(
    scope: Scope,
    hint: string,
    worldSetting: WorldSetting,
    currentTime: WorldTime,
    worldState: WorldState,
    npcId: string
  ): Promise<
    OneOf<{
      group: string
      npc: string
      none: undefined
    }>
  > {
    const accessor = new WorldSettingAccessor(worldSetting)
    const npc = accessor.getNpcById(npcId)
    const currentPlan =
      findNpcStateFromWorldState(worldState, npcId)?.planTasks ?? []
    const chatChoices = listValidChatChoices(worldState, npcId)
    const characters = [
      npc,
      ...worldSetting.npcs.filter((npc) => {
        return chatChoices.some((choice) => choice.npcIds.includes(npc._id))
      }),
    ]
    const callable = this.#structuredLlm.buildCallable(
      objectType([
        { name: "hint", type: stringType },
        { name: "description", type: stringType },
        { name: "apartments", type: roomListPromptType },
        { name: "buildings", type: facilityListPromptType },
        { name: "characters", type: arrayType(npcSettingType) },
        { name: "currentTime", type: stringType },
        { name: "currentPlan", type: arrayType(npcPlanTaskPromptType) },
        {
          name: "chatChoices",
          type: arrayType(
            objectType([
              { name: "groupName", type: stringType },
              { name: "characterNames", type: arrayType(stringType) },
            ])
          ),
        },
      ]),
      objectType([
        { name: "reason", type: stringType },
        { name: "groupName", type: stringType },
        { name: "characterNames", type: arrayType(stringType) },
      ]),
      promptsByLanguage[this.#language].decideChatChoice(npc.name),
      0.2
    )

    return await retryable(3, async () => {
      const { characterNames } = await callable(scope, {
        hint,
        description: worldSetting.description,
        apartments: buildPromptFromWorldRooms(worldSetting),
        buildings: buildPromptFromWorldFacilities(worldSetting),
        characters,
        currentTime: worldTimeToPrompt(currentTime),
        currentPlan: currentPlan.map((task) =>
          buildPromptFromNpcPlanTask(task)
        ),
        chatChoices: chatChoices.map((choice) => ({
          groupName: choice.group,
          characterNames: choice.npcIds.map(
            (npcId) => accessor.getNpcById(npcId).name
          ),
        })),
      })
      const firstCharacterName = characterNames[0]
      if (firstCharacterName === undefined) {
        return {
          kind: "none",
          value: undefined,
        }
      }
      const npcId = accessor.getNpcByName(firstCharacterName)._id
      const choice = chatChoices.find((choice) => choice.npcIds.includes(npcId))
      if (choice === undefined) {
        return {
          kind: "none",
          value: undefined,
        }
      }
      if (choice.group === "") {
        return {
          kind: "npc",
          value: npcId,
        }
      }
      return {
        kind: "group",
        value: choice.group,
      }
    })
  }

  async decideChatContent(
    scope: Scope,
    hint: string,
    worldSetting: WorldSetting,
    currentTime: WorldTime,
    worldState: WorldState,
    npcId: string
  ): Promise<NpcReaction> {
    const accessor = new WorldSettingAccessor(worldSetting)
    const npc = accessor.getNpcById(npcId)
    const npcState = findNpcStateFromWorldState(worldState, npcId)
    if (npcState === undefined) {
      console.log(worldState)
      throw new Error(`NPC [${npcId}] is not born yet`)
    }
    const groupId =
      npcState.location.staying?.groupId ??
      npcState.location.moving?.spot.groupId
    if (groupId === undefined || groupId === "") {
      throw new Error(`NPC [${npcId}] is not in a chat group`)
    }
    const group = worldState.groups.find(byKeyIs("groupId", groupId))?.group
    if (group === undefined) {
      throw new Error(`Group [${groupId}] is not found`)
    }
    const currentPlan =
      findNpcStateFromWorldState(worldState, npcId)?.planTasks ?? []
    const npcAttenders = worldState.npcs
      .filter(
        (npc) =>
          (npc.npcState.location.moving?.spot.groupId === groupId ||
            npc.npcState.location.staying?.groupId === groupId) &&
          npc.npcId !== npcId
      )
      .map((npc) => npc.npcId)
      .map((npcId) => accessor.getNpcById(npcId).name)
    const playerAttenders = worldState.players
      .filter((player) => player.playerState.groupId === groupId)
      .map((player) => player.playerId)
      .map(
        (playerId) =>
          worldSetting.players.find(byKeyIs("_id", playerId))?.name ??
          "(unknown)"
      )
    const recipients = [...npcAttenders, ...playerAttenders]
    const messages = group.messages.map((message) => ({
      name:
        message.author.npcId !== undefined
          ? worldSetting.npcs.find(byKeyIs("_id", message.author.npcId))
              ?.name ?? "(unknown)"
          : message.author.playerId !== undefined
          ? worldSetting.players.find(byKeyIs("_id", message.author.playerId))
              ?.name ?? "(unknown)"
          : "(unknown)",
      content: message.content,
    }))
    const callable = this.#structuredLlm.buildCallable(
      objectType([
        { name: "hint", type: stringType },
        { name: "description", type: stringType },
        { name: "apartments", type: roomListPromptType },
        { name: "buildings", type: facilityListPromptType },
        { name: "characters", type: arrayType(npcSettingType) },
        { name: "players", type: arrayType(playerSettingType) },
        { name: "currentTime", type: stringType },
        { name: "currentPlan", type: arrayType(npcPlanTaskPromptType) },
        { name: "recipients", type: arrayType(stringType) },
        {
          name: "messages",
          type: arrayType(
            objectType([
              { name: "name", type: stringType },
              { name: "content", type: stringType },
            ])
          ),
        },
      ]),
      objectType([
        { name: "reason", type: stringType },
        { name: "content", type: stringType },
        { name: "emotion", type: stringType },
        { name: "action", type: stringType },
      ]),
      promptsByLanguage[this.#language].decideChatContent(
        npc.name,
        recipients,
        emotionList,
        actionsList
      ),
      0.2
    )

    return await retryable(3, async () => {
      const { content, emotion, action } = await callable(scope, {
        hint,
        description: worldSetting.description,
        apartments: buildPromptFromWorldRooms(worldSetting),
        buildings: buildPromptFromWorldFacilities(worldSetting),
        characters: worldSetting.npcs,
        players: worldSetting.players,
        currentTime: worldTimeToPrompt(currentTime),
        currentPlan: currentPlan.map((task) =>
          buildPromptFromNpcPlanTask(task)
        ),
        recipients,
        messages,
      })
      return { content, emotion, action }
    })
  }

  async decideTwisserContent(
    scope: Scope,
    hint: string,
    worldSetting: WorldSetting,
    currentTime: WorldTime,
    worldState: WorldState,
    npcId: string
  ): Promise<string | undefined> {
    const accessor = new WorldSettingAccessor(worldSetting)
    const npc = accessor.getNpcById(npcId)
    const twisserMessages = worldState.twissers
    const currentPlan =
      findNpcStateFromWorldState(worldState, npcId)?.planTasks ?? []
    const posts = twisserMessages.map((message) => ({
      name:
        message.author.npcId !== undefined
          ? worldSetting.npcs.find(byKeyIs("_id", message.author.npcId))
              ?.name ?? "(unknown)"
          : message.author.playerId !== undefined
          ? worldSetting.players.find(byKeyIs("_id", message.author.playerId))
              ?.name ?? "(unknown)"
          : "(unknown)",
      content: message.content,
    }))
    const callable = this.#structuredLlm.buildCallable(
      objectType([
        { name: "hint", type: stringType },
        { name: "description", type: stringType },
        { name: "apartments", type: roomListPromptType },
        { name: "buildings", type: facilityListPromptType },
        { name: "characters", type: arrayType(npcSettingType) },
        { name: "players", type: arrayType(playerSettingType) },
        { name: "currentTime", type: stringType },
        { name: "currentPlan", type: arrayType(npcPlanTaskPromptType) },
        {
          name: "posts",
          type: arrayType(
            objectType([
              { name: "name", type: stringType },
              { name: "content", type: stringType },
            ])
          ),
        },
      ]),
      objectType([
        { name: "reason", type: stringType },
        { name: "content", type: stringType },
      ]),
      promptsByLanguage[this.#language].decideTwisserContent(npc.name),
      0.2
    )

    return await retryable(3, async () => {
      const { content } = await callable(scope, {
        hint,
        description: worldSetting.description,
        apartments: buildPromptFromWorldRooms(worldSetting),
        buildings: buildPromptFromWorldFacilities(worldSetting),
        characters: worldSetting.npcs,
        players: worldSetting.players,
        currentTime: worldTimeToPrompt(currentTime),
        currentPlan: currentPlan.map((task) =>
          buildPromptFromNpcPlanTask(task)
        ),
        posts,
      })
      return content
    })
  }

  async decideTwisserCommentContent(
    scope: Scope,
    hint: string,
    worldSetting: WorldSetting,
    currentTime: WorldTime,
    worldState: WorldState,
    npcId: string,
    twisserId: string
  ): Promise<string | undefined> {
    const accessor = new WorldSettingAccessor(worldSetting)
    const npc = accessor.getNpcById(npcId)
    const twisserMessages = worldState.twissers
    const currentPlan =
      findNpcStateFromWorldState(worldState, npcId)?.planTasks ?? []
    const twisser = twisserMessages.find(
      (message) => message.twisserId === twisserId
    )
    const post = twisser === undefined ? "" : twisser.content
    const comments =
      twisser === undefined
        ? []
        : twisser.comments.map((comment) => ({
            name:
              comment.author.npcId !== undefined
                ? worldSetting.npcs.find(byKeyIs("_id", comment.author.npcId))
                    ?.name ?? "(unknown)"
                : comment.author.playerId !== undefined
                ? worldSetting.players.find(
                    byKeyIs("_id", comment.author.playerId)
                  )?.name ?? "(unknown)"
                : "(unknown)",
            content: comment.content,
          }))
    const callable = this.#structuredLlm.buildCallable(
      objectType([
        { name: "hint", type: stringType },
        { name: "description", type: stringType },
        { name: "apartments", type: roomListPromptType },
        { name: "buildings", type: facilityListPromptType },
        { name: "characters", type: arrayType(npcSettingType) },
        { name: "players", type: arrayType(playerSettingType) },
        { name: "currentTime", type: stringType },
        { name: "currentPlan", type: arrayType(npcPlanTaskPromptType) },
        { name: "post", type: stringType },
        {
          name: "comments",
          type: arrayType(
            objectType([
              { name: "name", type: stringType },
              { name: "content", type: stringType },
            ])
          ),
        },
      ]),
      objectType([
        { name: "reason", type: stringType },
        { name: "content", type: stringType },
      ]),
      promptsByLanguage[this.#language].decideTwisserCommentContent(
        npc.name,
        twisserId
      ),
      0.2
    )

    return await retryable(3, async () => {
      const { content } = await callable(scope, {
        hint,
        description: worldSetting.description,
        apartments: buildPromptFromWorldRooms(worldSetting),
        buildings: buildPromptFromWorldFacilities(worldSetting),
        characters: worldSetting.npcs,
        players: worldSetting.players,
        currentTime: worldTimeToPrompt(currentTime),
        currentPlan: currentPlan.map((task) =>
          buildPromptFromNpcPlanTask(task)
        ),
        post,
        comments,
      })

      console.log("prompt.ts comment: ", content)
      console.log("prompt.ts comment: ", content)
      console.log("prompt.ts comment: ", content)
      console.log("prompt.ts comment: ", content)
      console.log("prompt.ts comment: ", content)

      return content
    })
  }

  async decideTwisserLike(
    scope: Scope,
    hint: string,
    worldSetting: WorldSetting,
    currentTime: WorldTime,
    worldState: WorldState,
    npcId: string,
    twisserId: string
  ): Promise<boolean> {
    const accessor = new WorldSettingAccessor(worldSetting)
    const npc = accessor.getNpcById(npcId)
    const twisserMessages = worldState.twissers
    const currentPlan =
      findNpcStateFromWorldState(worldState, npcId)?.planTasks ?? []
    const twisser = twisserMessages.find(
      (message) => message.twisserId === twisserId
    )
    if (twisser === undefined) {
      console.log(worldState)
      throw new Error(`twisser with ID [${twisserId}] is not posted yet`)
    }
    worldState.twissers
    const likes = [
      ...twisser.likes,
      {
        twisserId: twisserId,
        owner: {
          npcId: npcId,
        },
      },
    ]
    const callable = this.#structuredLlm.buildCallable(
      objectType([
        { name: "hint", type: stringType },
        { name: "description", type: stringType },
        { name: "apartments", type: roomListPromptType },
        { name: "buildings", type: facilityListPromptType },
        { name: "characters", type: arrayType(npcSettingType) },
        { name: "players", type: arrayType(playerSettingType) },
        { name: "currentTime", type: stringType },
        { name: "currentPlan", type: arrayType(npcPlanTaskPromptType) },
        {
          name: "likes",
          type: arrayType(twisserLikeType),
        },
      ]),
      objectType([
        { name: "reason", type: stringType },
        { name: "like", type: booleanType },
      ]),
      promptsByLanguage[this.#language].decideTwisserCommentContent(
        npc.name,
        twisserId
      ),
      0.2
    )

    return await retryable(3, async () => {
      const { like } = await callable(scope, {
        hint,
        description: worldSetting.description,
        apartments: buildPromptFromWorldRooms(worldSetting),
        buildings: buildPromptFromWorldFacilities(worldSetting),
        characters: worldSetting.npcs,
        players: worldSetting.players,
        currentTime: worldTimeToPrompt(currentTime),
        currentPlan: currentPlan.map((task) =>
          buildPromptFromNpcPlanTask(task)
        ),
        likes,
      })

      console.log("prompt.ts like: ", like)
      console.log("prompt.ts like: ", like)
      console.log("prompt.ts like: ", like)
      console.log("prompt.ts like: ", like)
      console.log("prompt.ts like: ", like)

      return like
    })
  }
}
