import { Scope } from "base-core/lib/scope.js"
import { log } from "base-core/lib/logging.js"
import { fileExists } from "base-node/lib/file.js"
import { throwError } from "base-core/lib/exception.js"
import { AuthClient } from "./auth.js"
import { ModelClient } from "./model.js"

export interface CmProfile {
  readonly authClient: AuthClient
  readonly modelClient: ModelClient
}

export async function buildCmDevProfile(scope: Scope): Promise<CmProfile> {
  const modelClient = await ModelClient.build(
    scope,
    "mongodb+srv://cyber:yythKoAZJcqgw8dH@test.cj8og.mongodb.net/?retryWrites=true&w=majority",
    "dev"
  )
  const authClient = await AuthClient.build(
    modelClient
  )
  return {
    authClient,
    modelClient,
  }
}

export async function buildCmProdProfile(scope: Scope): Promise<CmProfile> {
  const modelClient = await ModelClient.build(
    scope,
    process.env["MONGODB_URI"] ?? throwError("MONGODB_URI is not set"),
    process.env["MONGODB_DATABASE"] ?? throwError("MONGODB_DATABASE is not set")
  )
  const authClient = await AuthClient.build(
    modelClient
  )
  return {
    authClient,
    modelClient,
  }
}

export async function buildCmProfile(scope: Scope): Promise<CmProfile> {
  if (process.env["KUBERNETES_SERVICE_HOST"] !== undefined) {
    log.info("Running in Kubernetes environment - use prod profile")
    return buildCmProdProfile(scope)
  } else if (await fileExists("/.dockerenv")) {
    log.info("Running in Docker environment - use prod profile")
    return buildCmProdProfile(scope)
  } else {
    log.info("Running in non-Kubernetes environment - use dev profile")
    return buildCmDevProfile(scope)
  }
}
