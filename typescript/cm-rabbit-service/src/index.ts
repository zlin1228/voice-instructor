import {
  fastifyCors,
  fastifyWebsocket,
  fastifyHttpProxy,
} from "base-fastify/lib/deps.js"

import {
  buildAttachmentForCancellation,
  launchBackgroundScope,
  BroadcastController,
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
} from "cm-rabbit-common/lib/schema/schema.js"

import { buildOs2Service } from "./service.js"
import { buildOs2Profile } from "./profile.js"
import { UserStorage } from "./model.js"

const port = parseInt(process.env["PORT"] ?? "8080")

async function main(scope: Scope, cancel: (error: Error) => void) {
  const profile = await buildOs2Profile(scope)
  const service = await buildOs2Service(scope, { profile })
  const server = await createFastifyServer(scope)
  await server.register(fastifyCors)

  if (profile.webApp !== undefined) {
    const { upstreamUrl, basePath } = profile.webApp
    log.info(`Registering /: redirect to ${basePath}/`)
    server.get("/", {}, async function (request, reply) {
      return await reply.redirect(`${basePath}/`)
    })
    log.info(`Registering /favicon.ico: redirect to ${basePath}/favicon.ico`)
    server.get("/favicon.ico", {}, async function (request, reply) {
      return await reply.redirect(`${basePath}/favicon.ico`)
    })
    log.info(`Registering ${basePath}/*: redirect to ${upstreamUrl}`)
    await server.register(
      async function (fastify) {
        await fastify.register(fastifyHttpProxy, {
          upstream: upstreamUrl,
          rewritePrefix: basePath,
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
        prefix: basePath,
      }
    )
  }

  log.info(`Registering /apis/*: handle by rabbit service`)
  await server.register(
    await createFastifyPluginFromService(scope, os2HttpServiceSchema, service),
    {
      prefix: "/apis",
    }
  )
  log.info(`Registering broadcast controller to MongoDB`)
  const userDocOperationBroadcast = new BroadcastController<UserStorage>()
  launchBackgroundScope(scope, async (scope) => {
    const collection = profile.modelClient.userStorageCollections.get("en");
    if (collection === undefined) {
      console.log("No user storage collection for English")
      return
    }
    for await (const mailboxOperationDoc of collection.findAndWatch(
      scope,
      (pipeline) => pipeline
    )) {
      if (mailboxOperationDoc.kind !== "update") {
        continue
      }
      // console.log("Mailbox operation: ", mailboxOperationDoc);
      userDocOperationBroadcast.emit(mailboxOperationDoc.value)
    }
  })

  log.info(`Registering /session: handle by rabbit service.handleSession()`)
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
              yield* service.handleSession(scope, request.ip, requestIter, userDocOperationBroadcast)
            }
          )
        })
      }
    )
  })
  // log.info(`Registering /minions: handle by rabbit service.handleSession()`)
  // await server.register(
  //   async function (fastify) {
  //     await fastify.register(fastifyHttpProxy, {
  //       upstream: "",
  //       replyOptions: {
  //         getUpstream: (req, base) => {
  //           const params = req.params as {
  //             minionName: string
  //             app: string
  //           }
  //           const minionUrl = service.getMinionProxyUpstream(
  //             params.minionName,
  //             params.app
  //           )
  //           log.info(`Minion request to: ${minionUrl}`)
  //           return minionUrl
  //         },
  //       },
  //       disableCache: true,
  //       cacheURLs: 0,
  //       websocket: true,
  //       prefix: "/minions/:minionName/:app",
  //       rewritePrefix: ".",
  //     })
  //   },
  //   {
  //     prefix: "/minions",
  //   }
  // )
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
