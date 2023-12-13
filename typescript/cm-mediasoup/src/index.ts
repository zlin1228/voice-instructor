import fastifyCors from "@fastify/cors"

import {
  checkAndGetCancelToken,
  Scope,
  sleepUntilCancel,
} from "base-core/lib/scope.js"
import {
  createFastifyPluginFromService,
  createFastifyServer,
} from "base-fastify/lib/fastify-server.js"
import { buildStreamerHttpService, Room } from "./room.js"
import { streamerHttpServiceSchema } from "cm-streamer-common/lib/schema/schema.js"

import "base-node/lib/init.js"

const port = parseInt(process.env["PORT"] ?? "8080")

async function main() {
  await Scope.with(undefined, [], async (scope) => {
    const server = await createFastifyServer()
    await server.register(fastifyCors)
    await server.register(
      await createFastifyPluginFromService(
        scope,
        streamerHttpServiceSchema,
        await buildStreamerHttpService(scope, {})
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
  })
}

void main()
