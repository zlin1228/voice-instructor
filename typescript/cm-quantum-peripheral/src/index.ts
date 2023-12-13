import {
  checkAndGetCancelToken,
  Scope,
  sleepUntilCancel,
} from "base-core/lib/scope.js"
import {
  createFastifyPluginFromService,
  createFastifyServer,
} from "base-fastify/lib/fastify-server.js"
import { quantumPeripheralHttpServiceSchema } from "cm-quantum-peripheral-common/lib/schema/schema.js"
import { buildQuantumPeripheralHttpService } from "./apps/quantum-peripheral/service.js"
import { quantumMockHttpServiceSchema } from "./apps/quantum-mock/apis/schema.js"
import { buildQuantumMockHttpService } from "./apps/quantum-mock/service.js"

const port = parseInt(process.env["PORT"] ?? "8080")

async function main() {
  await Scope.with(undefined, [], async (scope) => {
    const server = await createFastifyServer()
    await server.register(
      await createFastifyPluginFromService(
        scope,
        quantumPeripheralHttpServiceSchema,
        await buildQuantumPeripheralHttpService(scope, {})
      ),
      {
        prefix: "/quantum-peripheral",
      }
    )
    await server.register(
      await createFastifyPluginFromService(
        scope,
        quantumMockHttpServiceSchema,
        await buildQuantumMockHttpService(scope, {})
      ),
      {
        prefix: "/quantum-mock",
      }
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
