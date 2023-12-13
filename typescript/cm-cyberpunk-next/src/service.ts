import { Scope } from "base-core/lib/scope.js"
import { log } from "base-core/lib/logging.js"

import { ApiKeyDoc, ModelClient } from "./model"
import {
  stringRandomSimpleName,
  stringRemovePrefix,
} from "base-core/lib/string.js"
import { abortIfUndefined } from "base-core/lib/debug.js"
import { globalScopePromise } from "base-node/lib/request-scope.js"
import { flyingPromise } from "base-core/lib/utils.js"

export interface Service {
  getApiKeyForUser(scope: Scope, userEmail: string): Promise<ApiKeyDoc>
  refreshApiKey(scope: Scope, userEmail: string): Promise<ApiKeyDoc>
}

export async function buildService(scope: Scope): Promise<Service> {
  const modelClient = await ModelClient.build(
    scope,
    "mongodb+srv://cyber:yythKoAZJcqgw8dH@cyberpunk.cj8og.mongodb.net/?retryWrites=true&w=majority",
    "prod"
  )
  const generateApiKey = async (scope: Scope, userEmail: string) => {
    const apiKey = stringRandomSimpleName(32).toUpperCase()
    const apiKeyDoc: ApiKeyDoc = {
      _id: apiKey,
      user: {
        email: userEmail,
      },
    }
    if (
      !(await modelClient.apiKeyCollection.createIfNotExists(scope, apiKeyDoc))
    ) {
      throw new Error("Failed to create API key")
    }
    return apiKeyDoc
  }
  return {
    getApiKeyForUser: async (scope: Scope, userEmail: string) => {
      const apiKeyDocs = await modelClient.apiKeyCollection
        .find(scope, {
          "user.email": userEmail,
        })
        .toArray()
      if (apiKeyDocs.length === 0) {
        return await generateApiKey(scope, userEmail)
      }
      return apiKeyDocs[0]
    },
    refreshApiKey: async (scope: Scope, userEmail: string) => {
      const apiKeyDocs = await modelClient.apiKeyCollection
        .find(scope, {
          "user.email": userEmail,
        })
        .toArray()
      for (const apiKeyDoc of apiKeyDocs) {
        await modelClient.apiKeyCollection.deleteById(scope, apiKeyDoc._id)
      }
      return await generateApiKey(scope, userEmail)
    },
  }
}

let globalServicePromise: Promise<Service> | undefined

export async function getGlobalService(): Promise<Service> {
  if (globalServicePromise === undefined) {
    globalServicePromise = new Promise((resolve) => {
      flyingPromise(async () => {
        const scope = abortIfUndefined(await globalScopePromise)
        resolve(await buildService(scope))
      })
    })
  }
  return await globalServicePromise
}
