import k8s from "@kubernetes/client-node"

import { OneOf } from "base-core/lib/one-of.js"
import {
  HandlingQueue,
  Scope,
  launchBackgroundScope,
  sleepSeconds,
} from "base-core/lib/scope.js"
import { log } from "base-core/lib/logging.js"

import {
  Os2ClientMessage,
  Os2ServerMessage,
} from "cm-cyberpunk-common/lib/schema/schema.js"
import {
  Os2ClientMessageGlobal,
  Os2ClientMessageGlobalInitialize,
} from "cm-cyberpunk-common/lib/session/session-global.js"
import { AuthClient } from "./auth.js"
import { ModelClient } from "./model.js"
import { throwError } from "base-core/lib/exception.js"
import { Kernel } from "./kernel/kernel.js"
import { KubernetesServiceLocator } from "base-kubernetes/lib/kubernetes.js"
import {
  buildAttachmentForCancellation,
  TimeoutError,
  checkAndGetCancelToken,
} from "base-core/lib/scope.js"

export async function handleSession(
  scope: Scope,
  authClient: AuthClient,
  modelClient: ModelClient,
  kubeConfig: k8s.KubeConfig,
  kubernetesServiceLocator: KubernetesServiceLocator,
  clientIp: string,
  clientMessageIter: AsyncIterable<
    OneOf<{ json: Os2ClientMessage; binary: Uint8Array }>
  >,
  serverMessageQueue: HandlingQueue<
    OneOf<{
      json: Os2ServerMessage
      binary: Uint8Array
    }>
  >
): Promise<void> {
  log.info("Handling session begin")
  let userId: string | undefined

  let kernelInstance: Kernel | undefined

  const handleGlobalInitialize = async (
    session: Os2ClientMessageGlobalInitialize
  ) => {
    userId = await authClient.verify(session.token) ?? undefined
    if (userId === undefined) {
      log.info("Invalid token")
    }
    else {
      launchBackgroundScope(scope, async (scope) => {
        const cancelToken = checkAndGetCancelToken(scope)
        var musicPlaying = false
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
              it,
              musicPlaying
            )
            kernelInstance.setUserId(userId ?? "")
            kernelInstance.setLanguage(session.language)
            kernelInstance.setHostIp(clientIp)
            console.log("kernelInstance.build done.")
            await kernelInstance.launch(scope, false)
            console.log("kernelInstance.launch done.")
          } catch (e) {
            log.info("Exception in kernelInstance.launch")
          }
          console.log("Iteration complete.")
          musicPlaying = kernelInstance?.getMusicPlaying() ?? false
          while (!kernelInstance?.getListening()) {
            await sleepSeconds(scope, 1)
          }
          kernelInstance.destroy()
          console.log("kernelInstance.destroy done.")
        }
      })

      console.log(
        `Language: ${session.language}, host: ${clientIp}`
      )
      serverMessageQueue.pushBack({
        kind: "json",
        value: {
          global: {
            initialize: {
              currentTime: new Date(),
              clientIp,
              logged_in: userId === undefined ? false : true,
            },
          },
        },
      })
    }
  }

  const handleGlobal = async (globalMessage: Os2ClientMessageGlobal) => {
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
            } else if (jsonMessage.spotify !== undefined) {

            } else if (jsonMessage.kernel !== undefined) {
              if (jsonMessage.kernel.userText !== undefined) {
                launchBackgroundScope(scope, async (scope) => {
                  await kernelInstance?.handleTextMessage(
                    jsonMessage.kernel?.userText?.text ?? "",
                    jsonMessage.kernel?.userText?.character ?? "",
                    scope
                  )
                })
              } else if (jsonMessage.kernel.listening !== undefined) {
                if (jsonMessage.kernel.listening) {
                  kernelInstance?.startListening()
                } else {
                  kernelInstance?.stopListening()
                }
              } else if (jsonMessage.kernel.userAudio !== undefined) {
                console.log("Received audio message.", kernelInstance?.getUser())
                if (kernelInstance?.getUser() !== "" && kernelInstance?.getUser() !== undefined) {
                  await kernelInstance?.handleAudioMessage(
                    jsonMessage.kernel.userAudio?.character ?? "",
                    jsonMessage.kernel.userAudio?.audio ?? "",
                    jsonMessage.kernel.userAudio?.uuid ?? "",
                    scope
                  )
                } else {
                  console.log("No user set. Skipping audio message.")
                }
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
