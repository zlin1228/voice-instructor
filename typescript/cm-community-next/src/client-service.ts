"use client"

import {
  HandlingQueue,
  Scope,
  buildAttachmentForCancellation,
} from "base-core/lib/scope.js"

import { abortIfUndefined } from "base-core/lib/debug.js"
import { globalScopePromise } from "base-node/lib/request-scope.js"
import { flyingPromise } from "base-core/lib/utils.js"
import {
  CookHttpServiceClient,
  buildHttpServiceClient,
  defaultBuildHttpServiceClientOptions,
} from "base-node/lib/service.js"
import {
  PlayerControlClient,
  PlayerControlQuery,
  PlayerControlServer,
  lightspeedHttpServiceSchema,
  playerControlClientType,
  playerControlQueryType,
  playerControlServerType,
} from "cm-community-common/lib/schema/lightspeed.js"
import { OneOf } from "base-core/lib/one-of"
import { connectWebSocket } from "./websocket"
import { buildHttpQuerySearchParams } from "base-core/lib/http-schema"

export type LightspeedClient = CookHttpServiceClient<
  typeof lightspeedHttpServiceSchema
>

export interface ClientService {
  getLightspeedClient(): LightspeedClient
  connectPlayerControl(
    scope: Scope,
    playerControlQuery: PlayerControlQuery,
    body: (
      scope: Scope,
      serverMessageIter: AsyncIterable<
        OneOf<{ json: PlayerControlServer; binary: Uint8Array }>
      >,
      clientMessageQueue: HandlingQueue<
        OneOf<{ json: PlayerControlClient; binary: Uint8Array | Blob }>
      >
    ) => Promise<void>
  ): Promise<void>
}

export async function buildClientService(scope: Scope): Promise<ClientService> {
  const lightspeedServiceAddress =
    window.location.hostname === "localhost" ? "http://localhost:1080" : ""
  console.debug(`LIGHTSPEED_SERVICE_ADDRESSES: ${lightspeedServiceAddress}`)
  const lightspeedClient = buildHttpServiceClient(
    lightspeedHttpServiceSchema,
    defaultBuildHttpServiceClientOptions(`${lightspeedServiceAddress}/apis`)
  )
  return {
    getLightspeedClient: () => {
      return lightspeedClient
    },
    connectPlayerControl: async (scope, playerControlQuery, body) => {
      const params = buildHttpQuerySearchParams(
        playerControlQueryType,
        playerControlQuery
      )
      await connectWebSocket(
        scope,
        `${lightspeedServiceAddress}/playerControl?${params.toString()}`,
        playerControlClientType,
        playerControlServerType,
        false,
        body
      )
    },
  }
}

let globalServicePromise: Promise<ClientService> | undefined

// export async function getGlobalService(): Promise<ClientService> {
//   if (globalServicePromise === undefined) {
//     globalServicePromise = new Promise((resolve) => {
//       flyingPromise(async () => {
//         const scope = abortIfUndefined(await globalScopePromise)
//         resolve(await buildClientService(scope))
//       })
//     })
//   }
//   return await globalServicePromise
// }

export function withGlobalService(
  fn: (scope: Scope, service: ClientService) => Promise<void>
) {
  flyingPromise(async () => {
    await Scope.with(undefined, [], async (scope) => {
      const clientService = await buildClientService(scope)
      await fn(scope, clientService)
    })
  })
}
