import {
  HandlingQueue,
  Scope,
  buildAttachmentForCancellation,
} from "base-core/lib/scope.js"
import { throwError } from "base-core/lib/exception.js"
import { OneOf } from "base-core/lib/one-of.js"

import {
  Os2ClientMessage,
  Os2HttpService,
  Os2ServerMessage,
} from "cm-rabbit-common/lib/schema/schema.js"

import { Os2Profile } from "./profile.js"
import { handleSession } from "./session.js"
import { buildAsyncGenerator } from "base-core/lib/processing.js"
import { log } from "base-core/lib/logging.js"
import {
  BroadcastController,
} from "base-core/lib/scope.js"
import { UserStorage } from "./model.js"

export interface Os2Config {
  profile: Os2Profile
}

export interface Os2Service extends Os2HttpService {
  handleSession(
    scope: Scope,
    clientIp: string,
    requestIter: AsyncIterable<
      OneOf<{ json: Os2ClientMessage; binary: Uint8Array }>
    >,
    userDocOperationBroadcast: BroadcastController<UserStorage>
  ): AsyncGenerator<
    OneOf<{
      json: Os2ServerMessage
      binary: Uint8Array
    }>
  >
}

export async function buildOs2Service(
  scope: Scope,
  config: Os2Config
): Promise<Os2Service> {
  return {
    post_test: async (scope, request) => {
      console.log(request)
      const payload = config.profile.authClient.verify(request.token, false)
      console.log(payload)
      const userId = payload.sub ?? throwError("No user ID")
      const userProfile =
        (await config.profile.modelClient.userStorageCollections
          .get("en")
          ?.getById(scope, userId)) ?? throwError("User profile not found")
      const lastChat = userProfile.history[userProfile.history.length - 1]
      return {
        what: `This is OS2 service. Your user ID is ${
          payload.sub ?? "(unknown)"
        }. Your last chat was: ${lastChat ?? "(none)"}`,
      }
    },
    handleSession: (scope, clientIp, clientMessageIter, userDocOperationBroadcast) => {
      return buildAsyncGenerator(async (pushServerMessage) => {
        const { cancel, attachment } = buildAttachmentForCancellation(true)
        return await Scope.with(scope, [attachment], async (scope) => {
          const serverMessageQueue = new HandlingQueue<
            OneOf<{
              json: Os2ServerMessage
              binary: Uint8Array
            }>
          >(scope, async (scope, serverMessage) => {
            if (serverMessage.kind === "json") {
              log.info(
                `Sending server JSON message: ${JSON.stringify(
                  serverMessage.value
                )}`
              )
            } else {
              log.info(
                `Sending server binary message: ${serverMessage.value.byteLength}`
              )
            }
            try {
              await pushServerMessage(serverMessage)
            } catch (e) {
              console.log(`Failed to send server message: ${String(e)}`)
              cancel(new Error("Failed to send server message", { cause: e }))
            }
          })
          await handleSession(
            scope,
            config.profile.authClient,
            config.profile.modelClient,
            config.profile.kubeConfig,
            config.profile.kubernetesServiceLocator,
            clientIp,
            config.profile.spotifyClient,
            clientMessageIter,
            serverMessageQueue,
            userDocOperationBroadcast
          )
        })
      })
    },
  }
}
