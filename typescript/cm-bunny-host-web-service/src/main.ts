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

import { bunnyHostWebHttpServiceSchema } from "cm-bunny-host-web-common/lib/service/schema.js"

import { buildDefaultProfile } from "./profile.js"
import { buildPromise } from "base-core/lib/utils.js"
import { emptyObjectType } from "base-core/lib/types.js"
import { treeNodeLocationType } from "cm-bunny-host-common/lib/tree/tree.js"

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
    await createFastifyPluginFromService(
      scope,
      bunnyHostWebHttpServiceSchema,
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
      "/selectedNode",
      { websocket: true },
      async (connection, request) => {
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
            emptyObjectType,
            treeNodeLocationType,
            profile.service.handleSelectedNode
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
