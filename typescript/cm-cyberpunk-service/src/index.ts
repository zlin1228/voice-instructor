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
  os2ClientMessageType,
  os2HttpServiceSchema,
  os2ServerMessageType,
} from "cm-cyberpunk-common/lib/schema/schema.js"

import { buildOs2Service } from "./service.js"
import { buildOs2Profile } from "./profile.js"
import { stringRemovePrefix } from "base-core/lib/string.js"
import { throwError } from "base-core/lib/exception.js"

const port = parseInt(process.env["PORT"] ?? "8080")

async function main(scope: Scope, cancel: (error: Error) => void) {
  const profile = await buildOs2Profile(scope)
  const service = await buildOs2Service(scope, { profile })
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
            os2ClientMessageType,
            os2ServerMessageType,
            async function* (scope, requestIter) {
              yield* service.handleSession(scope, request.ip, requestIter)
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
