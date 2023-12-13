import {
  Scope,
  launchBackgroundScope,
  sleepSeconds,
  sleepUntilCancel,
} from "base-core/lib/scope.js"

import {
  createFastifyPluginFromService,
  createFastifyServer,
  extractQuery,
  handleWebSocket,
} from "base-fastify/lib/fastify-server.js"

import { fastifyWebsocket, fastifyCors } from "base-fastify/lib/deps.js"

import { runMainScope } from "base-node/lib/main-scope.js"

import {
  lightspeedHttpServiceSchema,
  playerControlQueryType,
  playerControlClientType,
  playerControlServerType,
  worldEventType,
} from "cm-community-common/lib/schema/lightspeed.js"

import { buildLightspeedService } from "./lightspeed/service.js"
import { ModelClient } from "./lightspeed/model.js"
import { log } from "base-core/lib/logging.js"
import { buildPromise, forceGetProperty } from "base-core/lib/utils.js"
import { emptyObjectType } from "base-core/lib/types.js"
import { buildAsyncGenerator } from "base-core/lib/processing.js"
import {
  anthropicModel_ClaudeInstant1,
  buildAnthropicLlmClient,
} from "base-nli/lib/llm/anthropic.js"
import {
  LlmModelClient,
  buildLlmCompletionLogger,
} from "base-nli/lib/llm/log.js"
import { LightspeedPrompt } from "./lightspeed/prompt.js"
import { NpcController } from "./lightspeed/npc.js"
import { WorldController } from "./lightspeed/world.js"
import { GameEngine } from "./lightspeed/game.js"
import { demoWorldSetting } from "cm-community-common/lib/schema/lightspeed-demo.js"

const port = parseInt(process.env["PORT"] ?? "1080")

async function main(scope: Scope, cancel: (error: Error) => void) {
  const modelClient = await ModelClient.build(
    scope,
    "mongodb+srv://cm:yMmWNxLlIFZkTJfp@zy-community-1.utnqu.mongodb.net/?retryWrites=true&w=majority",
    process.env["KUBERNETES_SERVICE_HOST"] !== undefined
      ? "lightspeed-prod"
      : "lightspeed"
  )
  const service = await buildLightspeedService(scope, modelClient)
  const server = await createFastifyServer(scope)
  await server.register(fastifyCors)
  server.get("/", {}, async function (request, reply) {
    return await reply.redirect("/webapp")
  })
  server.get("/favicon.ico", {}, async function (request, reply) {
    return await reply.redirect(`/webapp/favicon.ico`)
  })
  await server.register(
    await createFastifyPluginFromService(
      scope,
      lightspeedHttpServiceSchema,
      service
    ),
    {
      prefix: "/apis",
    }
  )
  await server.register(async function (fastify) {
    await fastify.register(fastifyWebsocket, {
      options: { maxPayload: 1024 * 1024 * 16 },
    })
    fastify.get(
      "/playerControl",
      { websocket: true },
      async (connection, request) => {
        const playerControlQuery = await extractQuery(
          playerControlQueryType,
          request
        )
        const { promise, resolve } = buildPromise()
        scope.onLeave(async () => {
          await promise
        })
        await Scope.with(scope, [], async (scope) => {
          scope.onLeave(async () => {
            resolve()
          })
          await handleWebSocket(
            scope,
            connection.socket,
            playerControlClientType,
            playerControlServerType,
            async function* (scope, playerControlClientIter) {
              launchBackgroundScope(scope, async (scope) => {
                for await (const playerControlClient of playerControlClientIter) {
                  if (playerControlClient.kind === "binary") {
                    continue
                  }
                  if (
                    playerControlClient.value.operation === undefined &&
                    playerControlClient.value.gameOperation === undefined
                  ) {
                    continue
                  }
                  await service.writePlayerOperation(
                    scope,
                    playerControlQuery.worldId,
                    playerControlClient.value.operation,
                    playerControlClient.value.gameOperation
                  )
                }
              })
              yield* buildAsyncGenerator(async (push) => {
                service.listenWorldEvent(
                  scope,
                  playerControlQuery.worldId,
                  (worldEvent) => {
                    launchBackgroundScope(scope, async (scope) => {
                      await push({
                        kind: "json",
                        value: {
                          worldEvent,
                        },
                      })
                    })
                  }
                )
                await sleepUntilCancel(scope)
              })
            }
          )
        })
      }
    )
  })
  const address = await server.listen({ port, host: "0.0.0.0" })
  console.log(`Server listening at ${address}`)
  if (process.env["LIGHTSPEED_GAME_ENGINE"] === "1") {
    await sleepSeconds(scope, 10)
    const llmClient = await buildAnthropicLlmClient(scope, {
      apiKey:
        "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",
      model: anthropicModel_ClaudeInstant1,
      completionLogger: await buildLlmCompletionLogger(
        await LlmModelClient.build(
          scope,
          "mongodb+srv://cm:yMmWNxLlIFZkTJfp@zy-community-1.utnqu.mongodb.net/?retryWrites=true&w=majority",
          "llm-logs-server"
        ),
        anthropicModel_ClaudeInstant1
      ),
    })
    const lightspeedPrompt = new LightspeedPrompt(llmClient, "zh")
    // const world = await service.post_createWorld(scope, demoWorldSetting)
    // await service.post_startWorld(scope, { worldId: world._id, timeRate: 20 })
    log.info("Running game engine")
    const npcController = new NpcController(lightspeedPrompt)
    const worldController = new WorldController(npcController)
    const gameEngine = new GameEngine(modelClient, worldController)
    await gameEngine.run(scope)
  }
  await sleepUntilCancel(scope)
}

void (async () => {
  await runMainScope(main)
  process.exit()
})()
