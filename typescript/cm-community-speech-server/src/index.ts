import {
  fastifyCors,
  fastifyWebsocket,
  fastifyHttpProxy,
} from "base-fastify/lib/deps.js"

import {
  buildAttachmentForCancellation,
  checkAndGetCancelToken,
  Scope,
  sleepUntilCancel,
} from "base-core/lib/scope.js"
import { OneOf } from "base-core/lib/one-of.js"
import { buildAsyncGenerator } from "base-core/lib/processing.js"
import { buildPromise } from "base-core/lib/utils.js"
import { log } from "base-core/lib/logging.js"

import {
  buildWebSocketStreams,
  createFastifyPluginFromService,
  createFastifyServer,
  handleWebSocket,
} from "base-fastify/lib/fastify-server.js"

import { runMainScope } from "base-node/lib/main-scope.js"

import {
  cmClientMessageType,
  cmHttpServiceSchema,
  cmServerMessageType,
} from "./schema/schema.js"

import { buildCmService } from "./service.js"
import { buildCmProfile } from "./profile.js"

const port = parseInt(process.env["PORT"] ?? "8080")

async function main(scope: Scope, cancel: (error: Error) => void) {
  const profile = await buildCmProfile(scope)
  const service = await buildCmService(scope, { profile })
  const server = await createFastifyServer(scope)
  await server.register(fastifyCors)

  log.info(`Registering /session: handle by kernel service.handleSession()`)
  await server.register(async function (fastify) {
    await fastify.register(fastifyWebsocket, {
      options: { maxPayload: 1024 * 1024 * 16 },
    })
    fastify.get(
      "/session",
      { websocket: true },
      async (connection, request) => {
        // get key from query string
        const query : any = (request.query as any)
        const key = query["key"] as string ?? ""
        const language = query["language"] as string ?? "cn"

        console.log(`New connection: ${key} ${language}`)

        const { cancel, attachment } = buildAttachmentForCancellation(false)
        const { promise, resolve } = buildPromise()
        scope.onLeave(async () => {
          await promise
        })
        await Scope.with(scope, [attachment], async (scope) => {
          scope.onLeave(async () => {
            resolve()
          })
          await handleWebSocket(
            scope,
            connection.socket,
            cmClientMessageType,
            cmServerMessageType,
            async function* (scope, requestIter) {
              yield* service.handleSession(scope, key, language, request.ip, requestIter)
            }
          )
        })
      }
    )
  })

  const address = await server.listen({ port, host: "0.0.0.0" })
  console.log(`Server listening at ${address}`)
  // const cancelToken = checkAndGetCancelToken(scope)
  // cancelToken.onCancel(async (reason) => {
  //   console.log(`Server shutting down due to: ${reason.message}`)
  //   void server.close()
  // })
  await sleepUntilCancel(scope)
}

void (async () => {
  await runMainScope(main)
  process.exit()
})()
