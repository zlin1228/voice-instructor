import { log } from "base-core/lib/logging.js"
import { Scope } from "base-core/lib/scope.js"
import { LightspeedPrompt } from "./prompt.js"
import {
  addHouseToWorldSetting,
  addBuildingToWorldSetting,
  addNpcToWorldSetting,
  addNpcRelationToWorldSetting,
} from "./utils.js"
import { WorldSetting } from "cm-community-common/lib/schema/lightspeed.js"
import { arrayShuffle } from "base-core/lib/array.js"

export async function generateWorldSetting(
  scope: Scope,
  lightspeedPrompt: LightspeedPrompt
): Promise<WorldSetting> {
  const worldKeywordBag = await lightspeedPrompt.generateWorldKeywordBag(
    scope,
    "关键词应当涉及到科技、未来、科学、物理、生物、化学、机械、环境、人工智能、宇宙等各个领域"
  )
  const keywords = arrayShuffle(worldKeywordBag).slice(0, 5)
  log.info(`Keywords: ` + keywords.join(", "))
  const worldGenreBag = await lightspeedPrompt.generateWorldGenreBag(
    scope,
    "请只列出科幻相关的题材，包括蒸汽朋克、赛博朋克、后末日等。"
  )
  const genres = arrayShuffle(worldGenreBag).slice(0, 2)
  log.info(`Genres: ${genres.join(", ")}`)
  let worldSetting = await lightspeedPrompt.generateWorldSetting(
    scope,
    "起初，故事中的所有人都过着平静的生活。可是突然某一天，故事里发生了一个重大的变故。" +
      "每个人的日常都被这个重大变故影响，都希望解开秘密，恢复平静的生活。" +
      `故事发生在一个架空世界几十年后的未来。故事的题材是${genres.join(
        "、"
      )}。故事的关键词有这些：` +
      keywords.join("，")
  )
  const expectedNumNpcs = 8
  const expectedNumHouses = 2
  const buildingProfiles = [
    { hint: "建筑是工作的地方。", num: 2 },
    { hint: "建筑提供餐饮服务。", num: 1 },
    { hint: "建筑是购物中心。", num: 1 },
    { hint: "建筑是学习的地方。", num: 1 },
  ]
  console.log(worldSetting)
  while (worldSetting.houses.length < expectedNumHouses) {
    const houses = await lightspeedPrompt.generateHouses(
      scope,
      "住宅中的单元应当在 5 楼以上。",
      worldSetting,
      expectedNumHouses
    )
    for (const house of houses) {
      worldSetting = addHouseToWorldSetting(worldSetting, house)
    }
  }
  for (const buildingProfile of buildingProfiles) {
    const buildings = await lightspeedPrompt.generateBuildings(
      scope,
      buildingProfile.hint,
      worldSetting,
      buildingProfile.num
    )
    for (const building of buildings) {
      worldSetting = addBuildingToWorldSetting(worldSetting, building)
    }
  }
  const npcs = await lightspeedPrompt.generateNpcs(
    scope,
    "人物的名字必须不常见。",
    worldSetting,
    expectedNumNpcs
  )
  for (const npc of npcs) {
    worldSetting = addNpcToWorldSetting(worldSetting, npc)
  }
  const npcRelations = await lightspeedPrompt.generateNpcRelations(
    scope,
    "",
    worldSetting
  )
  for (const npcRelation of npcRelations) {
    worldSetting = addNpcRelationToWorldSetting(worldSetting, npcRelation)
  }
  return worldSetting
}
