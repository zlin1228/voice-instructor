import {
  buildHttpServiceClient,
  defaultBuildHttpServiceClientOptions,
} from "base-node/lib/service.js"
import { quantumPeripheralHttpServiceSchema } from "cm-quantum-peripheral-common/lib/schema/schema.js"

const peripheralAddress =
  process.env["CM_PERIPHERAL_ADDRESS"] ??
  "http://localhost:8080/quantum-peripheral"

export const peripheralClient = buildHttpServiceClient(
  quantumPeripheralHttpServiceSchema,
  defaultBuildHttpServiceClientOptions(peripheralAddress)
)
