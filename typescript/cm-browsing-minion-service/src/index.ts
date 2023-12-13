import fastifyCors from "base-fastify/node_modules/@fastify/cors"

import { log } from "base-core/lib/logging.js"
import {
  checkAndGetCancelToken,
  Scope,
  sleepUntilCancel,
} from "base-core/lib/scope.js"
import {
  createFastifyPluginFromService,
  createFastifyServer,
} from "base-fastify/lib/fastify-server.js"

import { runMainScope } from "base-node/lib/main-scope.js"
import { buildBrowsingMinionProfile } from "./profile.js"
import { buildBrowsingMinionService } from "./service.js"
import { browsingMinionHttpServiceSchema } from "cm-browsing-minion-common/lib/schema/schema.js"

const port = parseInt(process.env["PORT"] ?? "8080")

async function main(scope: Scope, cancel: (error: Error) => void) {
  const profile = await buildBrowsingMinionProfile(scope)
  log.info(`selfHostForRtp: ${profile.selfHostForRtp}`)
  log.info(`selfHostForWebRtc: ${profile.selfHostForWebRtc}`)
  const service = await buildBrowsingMinionService(scope, {
    profile,
  })

  const server = await createFastifyServer(scope)
  await server.register(fastifyCors)
  await server.register(
    await createFastifyPluginFromService(
      scope,
      browsingMinionHttpServiceSchema,
      service
    )
  )
  const address = await server.listen({ port, host: "0.0.0.0" })
  console.log(`Server listening at ${address}`)
  const cancelToken = checkAndGetCancelToken(scope)
  cancelToken.onCancel(async (reason) => {
    console.log(`Server shutting down due to: ${reason.message}`)
    await server.close()
  })
  await sleepUntilCancel(scope)
}

void (async () => {
  await runMainScope(main)
  process.exit()
})()
