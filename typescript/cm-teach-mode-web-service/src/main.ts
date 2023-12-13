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

import { teachModeWebHttpServiceSchema } from "cm-teach-mode-web-common/lib/schema/schema.js"

import { buildTeachModeWebService } from "./service.js"
import { log } from "base-core/lib/logging.js"
import { buildPromise, forceGetProperty } from "base-core/lib/utils.js"
import { emptyObjectType } from "base-core/lib/types.js"
import { buildAsyncGenerator } from "base-core/lib/processing.js"

const port = parseInt(process.env["PORT"] ?? "8080")

async function main(scope: Scope, cancel: (error: Error) => void) {
  const service = await buildTeachModeWebService(scope)
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
      teachModeWebHttpServiceSchema,
      service
    ),
    {
      prefix: "/apis",
    }
  )
  const address = await server.listen({ port, host: "0.0.0.0" })
  console.log(`Server listening at ${address}`)
  await sleepUntilCancel(scope)
}

void (async () => {
  await runMainScope(main)
  process.exit()
})()
