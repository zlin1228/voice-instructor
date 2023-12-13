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

import {
  fastifyWebsocket,
  fastifyCors,
  fastifyHttpProxy,
} from "base-fastify/lib/deps.js"

import { runMainScope } from "base-node/lib/main-scope.js"

import { log } from "base-core/lib/logging.js"
import { buildPromise, forceGetProperty } from "base-core/lib/utils.js"
import { buildAsyncGenerator } from "base-core/lib/processing.js"
import {
  anthropicModel_ClaudeInstant1,
  buildAnthropicLlmClient,
} from "base-nli/lib/llm/anthropic.js"
import {
  LlmModelClient,
  buildLlmCompletionLogger,
} from "base-nli/lib/llm/log.js"
import { buildDefaultProfile } from "./profile.js"
import {
  hostControlClientType,
  hostControlConnectType,
  hostControlServerType,
  presetBunnyBuilderHttpServiceSchema,
} from "cm-preset-bunny-builder-common/lib/service/schema.js"

const port = parseInt(process.env["PORT"] ?? "8080")

async function main(scope: Scope, cancel: (error: Error) => void) {
  const profile = await buildDefaultProfile(scope)
  const server = await createFastifyServer(scope)
  await server.register(fastifyCors)
  server.get("/", {}, async function (request, reply) {
    return await reply.redirect("/webapp")
  })
  server.get("/favicon.ico", {}, async function (request, reply) {
    return await reply.redirect(`/webapp/favicon.ico`)
  })
  await server.register(
    async function (fastify) {
      await fastify.register(fastifyHttpProxy, {
        upstream: profile.webappUrl,
        rewritePrefix: "/webapp",
        replyOptions: {
          rewriteRequestHeaders(req, headers) {
            // @fastify/reply-from rewrite the `host` header by default.
            // We restore it here so that Clerk can determine the correct hostname for origin checking.
            return {
              ...headers,
              host: req.hostname,
            }
          },
        },
      })
    },
    {
      prefix: "/webapp",
    }
  )
  await server.register(
    await createFastifyPluginFromService(
      scope,
      presetBunnyBuilderHttpServiceSchema,
      profile.service
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
      "/bunnyHostWeb",
      { websocket: true },
      async (connection, request) => {
        const hostControlQuery = await extractQuery(
          hostControlConnectType,
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
            hostControlClientType,
            hostControlServerType,
            profile.service.handleHostControl
          )
        })
      }
    )
  })
  const address = await server.listen({ port, host: "0.0.0.0" })
  console.log(`Server listening at ${address}`)
  await sleepUntilCancel(scope)
}

void (async () => {
  await runMainScope(main)
  process.exit()
})()
