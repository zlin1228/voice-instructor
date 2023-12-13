import { OneOf } from "base-core/lib/one-of.js"
import {
  HandlingQueue,
  Scope,
  launchBackgroundScope,
  sleepSeconds,
} from "base-core/lib/scope.js"
import { log } from "base-core/lib/logging.js"

import {
  CmClientMessage,
  CmServerMessage,
} from "./schema/schema.js"
import {
  CmClientMessageGlobal,
  CmClientMessageGlobalInitialize,
} from "./session/session-global.js"
import { AuthClient } from "./auth.js"
import { ModelClient } from "./model.js"
import { throwError } from "base-core/lib/exception.js"
import { Kernel } from "./kernel/kernel.js"
import {
  buildAttachmentForCancellation,
  TimeoutError,
  checkAndGetCancelToken,
} from "base-core/lib/scope.js"

export async function handleSession(
  scope: Scope,
  key: string,
  language: string,
  authClient: AuthClient,
  modelClient: ModelClient,
  clientIp: string,
  clientMessageIter: AsyncIterable<
    OneOf<{ json: CmClientMessage; binary: Uint8Array }>
  >,
  serverMessageQueue: HandlingQueue<
    OneOf<{
      json: CmServerMessage
      binary: Uint8Array
    }>
  >
): Promise<void> {
  log.info("Handling session begin")

  let kernelInstance: Kernel | undefined

  launchBackgroundScope(scope, async (scope) => {
    const cancelToken = checkAndGetCancelToken(scope)
    var it = 0
    while (cancelToken.cancelReason === undefined) {
      it += 1
      scope.onLeave(async () => {
        log.info("launch scope left")
      })
      try {
        kernelInstance = await Kernel.build(
          scope,
          serverMessageQueue,
          modelClient,
          it
        )
        kernelInstance.setKey(key)
        kernelInstance.setLanguage(language)
        kernelInstance.setHostIp(clientIp)
        console.log("kernelInstance.build done.")
        await kernelInstance.launch(scope, false)
        console.log("kernelInstance.launch done.")
      } catch (e) {
        log.info("Exception in kernelInstance.launch")
      }
      console.log("Iteration complete.")
      while (!kernelInstance?.getListening()) {
        await sleepSeconds(scope, 1)
      }
      kernelInstance.destroy()
      console.log("kernelInstance.destroy done.")
    }
  })

  const handleGlobalInitialize = async (
    session: CmClientMessageGlobalInitialize
  ) => {
    if (kernelInstance === undefined) {
      return
    } else {
      console.log("Received auth token: " + session.token)
    }
  }

  const handleGlobal = async (globalMessage: CmClientMessageGlobal) => {
    if (globalMessage.debugLog !== undefined) {
      log.info(`Received client-side log: ${globalMessage.debugLog.message}`)
    }
    if (globalMessage.initialize !== undefined) {
      await handleGlobalInitialize(globalMessage.initialize)
    }
  }

  try {
    for await (const clientMessage of clientMessageIter) {
      launchBackgroundScope(scope, async (scope) => {
        try {
          if (clientMessage.kind === "json") {
            const jsonMessage = clientMessage.value
            log.info(
              `Received client JSON message: ${JSON.stringify(jsonMessage)}`
            )
            if (jsonMessage.global !== undefined) {
              await handleGlobal(jsonMessage.global)
            } else if (jsonMessage.kernel !== undefined) {
              if (jsonMessage.kernel.listening !== undefined) {
                if (jsonMessage.kernel.listening) {
                  kernelInstance?.startListening()
                } else {
                  kernelInstance?.stopListening()
                }
              } else if (jsonMessage.kernel.audio !== undefined) {
                await kernelInstance?.handleAudioMessage(
                  jsonMessage.kernel.audio,
                  scope
                )
              }
            } else {
              log.info(
                `Ignored unknown client message: ${JSON.stringify(jsonMessage)}`
              )
            }
          } else {
            log.info(
              `Received client binary message: ${clientMessage.value.byteLength}`
            )
            /*
            if (kernelInstance === undefined) {
              log.info(
                `Ignored binary message before kernelInstance is initialized`
              )
            } else {
              await kernelInstance.push(clientMessage.value)
            }
            */
          }
        } catch (e) {
          log.info("Exception in client message handling loop!")
          console.log(e)
          serverMessageQueue.pushBack({
            kind: "json",
            value: {
              global: {
                debugLog: {
                  message: `Exception in client message handling loop: ${String(
                    e
                  )}`,
                },
              },
            },
          })
        }
      })
    }
  } catch (e) {
    log.info("Exception in client message handling loop!")
    console.log(e)
    throw e
  }
  log.info("Handling session end")
}
