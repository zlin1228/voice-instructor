import {
  buildHttpServiceClient,
  defaultBuildHttpServiceClientOptions,
} from "base-node/lib/service.js"
import { os2HttpServiceSchema } from "../../schema/schema"

const serviceAddress = process.env["CM_SERVICE_ADDRESS"] ?? "/api"

export const serviceClient = buildHttpServiceClient(
  os2HttpServiceSchema,
  defaultBuildHttpServiceClientOptions(serviceAddress)
)
