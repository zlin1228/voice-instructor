import {
  HandlingQueue,
  Scope,
  buildAttachmentForCancellation,
} from "base-core/lib/scope.js"
import { OneOf } from "base-core/lib/one-of.js"

import {
  CmClientMessage,
  CmHttpService,
  CmServerMessage,
} from "./schema/schema.js"

import { CmProfile } from "./profile.js"
import { handleSession } from "./session.js"
import { buildAsyncGenerator } from "base-core/lib/processing.js"
import { log } from "base-core/lib/logging.js"

export interface CmConfig {
  profile: CmProfile
}

export interface CmService extends CmHttpService {
  handleSession(
    scope: Scope,
    key: string,
    language: string,
    clientIp: string,
    requestIter: AsyncIterable<
      OneOf<{ json: CmClientMessage; binary: Uint8Array }>
    >
  ): AsyncGenerator<
    OneOf<{
      json: CmServerMessage
      binary: Uint8Array
    }>
  >
}

export async function buildCmService(
  scope: Scope,
  config: CmConfig
): Promise<CmService> {
  return {
    post_test: async (scope, request) => {
      console.log(request)
      const payload = await config.profile.authClient.verify(request.token)
      console.log(payload)
      return {
        what: `This is the speech server. Your user ID is ${
          payload ?? "(unknown)"
        }.`,
      }
    },
    handleSession: (scope, key, language, clientIp, clientMessageIter) => {
      return buildAsyncGenerator(async (pushServerMessage) => {
        const { cancel, attachment } = buildAttachmentForCancellation(true)
        return await Scope.with(scope, [attachment], async (scope) => {
          const serverMessageQueue = new HandlingQueue<
            OneOf<{
              json: CmServerMessage
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
            key,
            language,
            config.profile.authClient,
            config.profile.modelClient,
            clientIp,
            clientMessageIter,
            serverMessageQueue
          )
        })
      })
    },
  }
}
