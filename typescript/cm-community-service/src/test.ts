import { Scope, runParallelScopes } from "base-core/lib/scope.js"
import { runMainScope } from "base-node/lib/main-scope.js"
import { throwError } from "base-core/lib/exception.js"

import {
  anthropicModel_Claude2,
  anthropicModel_ClaudeInstant1,
  buildAnthropicLlmClient,
} from "base-nli/lib/llm/anthropic.js"
import { stringRandomSimpleName } from "base-core/lib/string.js"
import { LlmClient } from "base-nli/lib/llm/client.js"
import {
  LlmModelClient,
  buildLlmCompletionLogger,
} from "base-nli/lib/llm/log.js"
import {
  ExpressionLiteral,
  fluentExpression,
} from "base-core/lib/expressions.js"
import { log } from "base-core/lib/logging.js"
import { ModelClient } from "./lightspeed/model.js"
import { buildLightspeedService } from "./lightspeed/service.js"
import { demoWorldSetting } from "cm-community-common/lib/schema/lightspeed-demo.js"
import { WorldSettingAccessor } from "./lightspeed/utils.js"
import { generateWorldSetting } from "./lightspeed/generation.js"
import { GameEngine } from "./lightspeed/game.js"
import { NpcController } from "./lightspeed/npc.js"
import { World } from "cm-community-common/lib/schema/lightspeed.js"
import { WithId } from "cm-community-common/lib/schema/common.js"
import { abortIfUndefined } from "base-core/lib/debug.js"
import { arrayRepeat } from "base-core/lib/array.js"
import { LightspeedPrompt } from "./lightspeed/prompt.js"
import { WorldController } from "./lightspeed/world.js"

async function buildLlmClient(scope: Scope): Promise<LlmClient> {
  return await buildAnthropicLlmClient(scope, {
    apiKey:
      "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",
    model: anthropicModel_ClaudeInstant1,
    completionLogger: await buildLlmCompletionLogger(
      await LlmModelClient.build(
        scope,
        "mongodb+srv://cm:yMmWNxLlIFZkTJfp@zy-community-1.utnqu.mongodb.net/?retryWrites=true&w=majority",
        "llm-logs"
      ),
      anthropicModel_ClaudeInstant1
    ),
  })
}

async function buildModelClient(scope: Scope): Promise<ModelClient> {
  return await ModelClient.build(
    scope,
    "mongodb+srv://cm:yMmWNxLlIFZkTJfp@zy-community-1.utnqu.mongodb.net/?retryWrites=true&w=majority",
    "test"
  )
}

async function buildProdModelClient(scope: Scope): Promise<ModelClient> {
  return await ModelClient.build(
    scope,
    "mongodb+srv://cm:yMmWNxLlIFZkTJfp@zy-community-1.utnqu.mongodb.net/?retryWrites=true&w=majority",
    "lightspeed"
  )
}

async function generateLightspeedWorld(scope: Scope): Promise<void> {
  const llmClient = await buildLlmClient(scope)
  const modelClient = await buildModelClient(scope)
  const lightspeedPrompt = new LightspeedPrompt(llmClient, "zh")
  const worldSetting = await generateWorldSetting(scope, lightspeedPrompt)
  console.log(JSON.stringify(worldSetting, null, 2))
  const lightspeedService = await buildLightspeedService(scope, modelClient)
  await lightspeedService.post_createWorld(scope, worldSetting)
}

async function generateLightspeedWorldBatch(scope: Scope): Promise<void> {
  const llmClient = await buildLlmClient(scope)
  const modelClient = await buildProdModelClient(scope)
  const lightspeedPrompt = new LightspeedPrompt(llmClient, "zh")
  const lightspeedService = await buildLightspeedService(scope, modelClient)
  await lightspeedService.post_createWorld(scope, demoWorldSetting)
  await runParallelScopes(
    scope,
    arrayRepeat(async (scope) => {
      try {
        const worldSetting = await generateWorldSetting(scope, lightspeedPrompt)
        console.log(JSON.stringify(worldSetting, null, 2))
        await lightspeedService.post_createWorld(scope, worldSetting)
      } catch (error) {
        log.info(`Failed to generate world due to ${String(error)}`)
        console.log(error)
      }
    }, 20)
  )
}

async function generateLightspeedDemoWorld(scope: Scope): Promise<void> {
  const modelClient = await buildModelClient(scope)
  const lightspeedService = await buildLightspeedService(scope, modelClient)
  await lightspeedService.post_createWorld(scope, demoWorldSetting)
}

async function clearDatabase(
  scope: Scope,
  modelClient: ModelClient
): Promise<void> {
  for (const world of await modelClient.worldCollection
    .find(scope, {})
    .toArray()) {
    await modelClient.worldCollection.deleteById(scope, world._id)
  }
  for (const event of await modelClient.worldEventCollection
    .find(scope, {})
    .toArray()) {
    await modelClient.worldEventCollection.deleteById(scope, event._id)
  }
}

async function runGameEngine(scope: Scope): Promise<void> {
  const llmClient = await buildLlmClient(scope)
  const lightspeedPrompt = new LightspeedPrompt(llmClient, "zh")
  const modelClient = await buildModelClient(scope)

  await clearDatabase(scope, modelClient)
  log.info("Adding world to game engine")
  const lightspeedService = await buildLightspeedService(scope, modelClient)
  // await lightspeedService.post_createWorld(scope, demoWorldSetting)
  await lightspeedService.post_createWorld(
    scope,
    await generateWorldSetting(scope, lightspeedPrompt)
  )
  const worlds = await modelClient.worldCollection.find(scope, {}).toArray()
  const world = abortIfUndefined(worlds[0])
  await lightspeedService.post_startWorld(scope, {
    worldId: world._id,
    timeRate: 30,
    activeDurationSeconds: 60 * 60 * 8,
  })
  log.info("Running game engine")
  const npcController = new NpcController(lightspeedPrompt)
  const worldController = new WorldController(npcController)
  const gameEngine = new GameEngine(modelClient, worldController)
  await gameEngine.run(scope)
}

const tasksMap: Record<string, (scope: Scope) => Promise<void>> = {
  "generate-lightspeed-world": generateLightspeedWorld,
  "generate-lightspeed-world-batch": generateLightspeedWorldBatch,
  "generate-lightspeed-demo-world": generateLightspeedDemoWorld,
  "run-game-engine": runGameEngine,
}

async function main(scope: Scope, cancel: (error: Error) => void) {
  const taskName = process.env["TEST_TASK"] ?? "run-game-engine"
  const task = tasksMap[taskName]
  if (!task) {
    throw new Error(`Unknown task: ${taskName}`)
  }
  await task(scope)
}

void (async () => {
  await runMainScope(main)
  // process.exit()
})()
