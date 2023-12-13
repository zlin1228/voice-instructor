"use client"

import {
  HandlingQueue,
  Scope,
  buildAttachmentForCancellation,
} from "base-core/lib/scope.js"

import { flyingPromise } from "base-core/lib/utils.js"
import {
  CookHttpServiceClient,
  buildHttpServiceClient,
  defaultBuildHttpServiceClientOptions,
} from "base-node/lib/service.js"
import { OneOf } from "base-core/lib/one-of"
import { connectWebSocket } from "./websocket"
import { buildHttpQuerySearchParams } from "base-core/lib/http-schema"
import {
  presetBunnyBuilderHttpServiceSchema,
  HostControlConnect,
  HostControlClient,
  HostControlServer,
  hostControlConnectType,
  hostControlClientType,
  hostControlServerType,
} from "cm-preset-bunny-builder-common/lib/service/schema.js"

export type PresetBunnyBuilderClient = CookHttpServiceClient<
  typeof presetBunnyBuilderHttpServiceSchema
>

export interface ClientService {
  getPresetBunnyBuilderClient(): PresetBunnyBuilderClient
  connectHostControl(
    scope: Scope,
    hostControlConnect: HostControlConnect,
    body: (
      scope: Scope,
      serverMessageIter: AsyncIterable<
        OneOf<{ json: HostControlServer; binary: Uint8Array }>
      >,
      clientMessageQueue: HandlingQueue<
        OneOf<{ json: HostControlClient; binary: Uint8Array | Blob }>
      >
    ) => Promise<void>
  ): Promise<void>
}

export async function buildClientService(scope: Scope): Promise<ClientService> {
  const presetBunnyBuilderClient = buildHttpServiceClient(
    presetBunnyBuilderHttpServiceSchema,
    defaultBuildHttpServiceClientOptions("/apis")
  )
  return {
    getPresetBunnyBuilderClient: () => {
      return presetBunnyBuilderClient
    },
    connectHostControl: async (scope, hostControlConnect, body) => {
      const params = buildHttpQuerySearchParams(
        hostControlConnectType,
        hostControlConnect
      )
      await connectWebSocket(
        scope,
        `/bunnyHostWeb?${params.toString()}`,
        hostControlClientType,
        hostControlServerType,
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
): () => void {
  const { cancel, attachment } = buildAttachmentForCancellation(true)
  flyingPromise(async () => {
    try {
      await Scope.with(undefined, [attachment], async (scope) => {
        const clientService = await buildClientService(scope)
        await fn(scope, clientService)
      })
    } catch (e) {
      console.log("withGlobalService throws an exception", e)
      return
    }
  })
  return () => {
    cancel(new Error("cancel by withGlobalService"))
  }
}
