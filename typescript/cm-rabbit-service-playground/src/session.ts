import k8s from "@kubernetes/client-node"

import { OneOf } from "base-core/lib/one-of.js"
import {
  HandlingQueue,
  Scope,
  launchBackgroundScope,
  sleepSeconds,
  buildAttachmentForCancellation
} from "base-core/lib/scope.js"
import { log } from "base-core/lib/logging.js"

import {
  Os2ClientMessage,
  Os2ServerMessage,
} from "cm-rabbit-common/lib/schema/schema.js"
import {
  Os2ClientMessageGlobal,
  Os2ClientMessageGlobalInitialize,
} from "cm-rabbit-common/lib/session/session-global.js"
import { AuthClient } from "./auth.js"
import { ModelClient } from "./model.js"
import { throwError } from "base-core/lib/exception.js"
import { Kernel } from "./kernel/kernel.js"
import { KubernetesServiceLocator } from "base-kubernetes/lib/kubernetes.js"
import { SpotifyClient } from "./rabbits/spotify/spotify-client.js"
import { SpotifySession } from "./rabbits/spotify/spotify-session.js"
import {
  BroadcastController,
  checkAndGetCancelToken,
} from "base-core/lib/scope.js"
import { clearOutstandingIntention } from "./kernel/intention.js"
import { clearCallgraphAsync } from "./callgraph/graph.js"
import { UserStorage } from "./model.js"
import { generateWelcomeMessage } from "./kernel/init.js"
import { sleep } from "@zilliz/milvus2-sdk-node"

export async function handleSession(
  scope: Scope,
  authClient: AuthClient,
  modelClient: ModelClient,
  kubeConfig: k8s.KubeConfig,
  kubernetesServiceLocator: KubernetesServiceLocator,
  clientIp: string,
  spotifyClient: SpotifyClient,
  clientMessageIter: AsyncIterable<
    OneOf<{ json: Os2ClientMessage; binary: Uint8Array }>
  >,
  serverMessageQueue: HandlingQueue<
    OneOf<{
      json: Os2ServerMessage
      binary: Uint8Array
    }>
  >,
  userDocOperationBroadcast: BroadcastController<UserStorage>
): Promise<void> {
  log.info("Handling session begin")
  let userId: string | undefined
  const spotifySession = new SpotifySession(
    spotifyClient,
    (spotifyServerMessage) => {
      serverMessageQueue.pushBack({
        kind: "json",
        value: {
          spotify: spotifyServerMessage,
        },
      })
    }
  )

  let kernelInstance: Kernel | undefined

  const handleGlobalInitialize = (
    session: Os2ClientMessageGlobalInitialize
  ) => {
    userId = authClient.verify(session.token, session.evaluate).sub ?? throwError("No user ID")
    launchBackgroundScope(scope, async (scope: Scope) => {
      const cancelToken = checkAndGetCancelToken(scope)
      var greet = session.greet
      var musicPlaying = false
      var it = 0
      var determineAudioHandler = session.listening
      console.log("LISTENING: ", session.listening)
      kernelInstance = await Kernel.build(
        scope,
        serverMessageQueue,
        spotifySession,
        modelClient,
        it,
        musicPlaying,
        userDocOperationBroadcast
      )
      if (session.listening) {
        kernelInstance.startListening()
      } else {
        kernelInstance.stopListening()
      }

      while (cancelToken.cancelReason === undefined) {
        it += 1
        scope.onLeave(async () => {
          log.info("handleGlobalInitialize: launch scope left")
          await Scope.with(undefined, [], async (_scope: Scope) => {
            await clearOutstandingIntention(_scope, modelClient, userId ?? "")
            log.info("Outstanding intention cleared before quitting the session.")
            await clearCallgraphAsync(scope, modelClient, userId ?? "", "en")
            log.info("Callgraph cleared before quitting the session.")
          })
        })
        try {
          kernelInstance.setUserId(userId ?? "")
          kernelInstance.setLanguage(session.language)
          kernelInstance.setMimeType(session.mimeType)
          kernelInstance.setHostIp(clientIp)
          kernelInstance.setTimeZone(session.timeZone)
          if (greet) {
            await generateWelcomeMessage(scope, kernelInstance)
          }
          if (determineAudioHandler && kernelInstance?.getListening()) {
            kernelInstance.startListening()
            console.log("kernelInstance.launchAudioHandler begin. greet:", greet, "listening:", session.listening)
            await kernelInstance.launchAudioHandler(scope)
            console.log("kernelInstance.launchAudioHandler done.")
          } else {
            kernelInstance.stopListening()
            console.log("kernelInstance in text mode. greet:", greet, "listening:", session.listening)
            determineAudioHandler = true
          }
          console.log("kernelInstance.build done.")
          greet = false
        } catch (e) {
          log.info("Exception in kernelInstance.launch")
        }
        console.log("Iteration complete.")
        musicPlaying = kernelInstance?.getMusicPlaying() ?? false
        while (!kernelInstance?.getListening()) {
          await sleepSeconds(scope, 0.1)
        }
        // kernelInstance.destroy()
        console.log("kernelInstance loop done.")
      }
    })

    console.log(
      `Language: ${session.language}, mimeType: ${session.mimeType}, host: ${clientIp}`
    )
    serverMessageQueue.pushBack({
      kind: "json",
      value: {
        global: {
          initialize: {
            currentTime: new Date(),
            clientIp,
          },
        },
      },
    })
  }

  const handleGlobal = async (globalMessage: Os2ClientMessageGlobal) => {
    if (globalMessage.debugLog !== undefined) {
      log.info(`Received client-side log: ${globalMessage.debugLog.message}`)
    }
    if (globalMessage.initialize !== undefined) {
      handleGlobalInitialize(globalMessage.initialize)
    }
  }

  try {
    for await (const clientMessage of clientMessageIter) {
      launchBackgroundScope(scope, async (scope: Scope) => {
        try {
          if (clientMessage.kind === "json") {
            const jsonMessage = clientMessage.value
            log.info(
              `Received client JSON message: ${JSON.stringify(jsonMessage)}`
            )
            if (jsonMessage.global !== undefined) {
              await handleGlobal(jsonMessage.global)
            } else if (jsonMessage.spotify !== undefined) {
              await spotifySession.handleClientMessage(
                scope,
                jsonMessage.spotify
              )
            } else if (jsonMessage.kernel !== undefined) {
              if (jsonMessage.kernel.userText !== undefined) {
                launchBackgroundScope(scope, async (scope: Scope) => {
                  await kernelInstance?.handleTextMessage(
                    jsonMessage.kernel?.userText?.text ?? "",
                    scope
                  )
                })
              } else if (jsonMessage.kernel.listening !== undefined) {
                if (jsonMessage.kernel.listening) {
                  launchBackgroundScope(scope, async (scope: Scope) => {
                    kernelInstance?.startListening()
                    // await kernelInstance?.launchAudioHandler(scope)
                  });
                } else {
                  kernelInstance?.stopListening()
                }
              } else if (jsonMessage.kernel.utteranceMark !== undefined) {
                if (jsonMessage.kernel.utteranceMark) {
                  // TODO (Peiyuan): flush all outstanding intention on start of new utterance; need to check if this implementation is correct
                  console.log("User utterance begins.")
                  if (kernelInstance !== undefined) {
                    kernelInstance.userUtteranceInProgress = true
                    kernelInstance.textBuffer = ""
                  }
                  //kernelInstance?.cancelHandler(new Error("User utterance begins."))
                  //var { cancel, attachment } = buildAttachmentForCancellation(true)
                  //if (kernelInstance !== undefined) {
                  //  kernelInstance.cancelHandler = cancel
                  //  kernelInstance.cancelAttachment = attachment
                  //}
                } else {
                  console.log("User utterance ends.")
                  if (kernelInstance !== undefined) {
                    kernelInstance.flushNext = true
                    kernelInstance.userUtteranceInProgress = false
                    await sleepSeconds(scope, 0.4)
                    console.log("kernelInstance.textBuffer: ", kernelInstance?.textBuffer)
                    console.log("kernelInstance.flushNext: ", kernelInstance?.flushNext)
                    if (kernelInstance !== undefined && kernelInstance.flushNext && kernelInstance.textBuffer.trim().length > 0) {
                      kernelInstance.flushNext = false
                      var buf = kernelInstance.textBuffer
                      kernelInstance.textBuffer = ""
                      launchBackgroundScope(scope, async (scope: Scope) => {
                        await kernelInstance?.handleTextMessage(
                          buf,
                          scope
                        )
                      })
                    }
                  }
                }
              }
            } else {
              log.info(
                `Ignored unknown client message: ${JSON.stringify(jsonMessage)}`
              )
            }
          } else {
            //log.info(
            //  `Received client binary message: ${clientMessage.value.byteLength}`
            //)
            if (kernelInstance === undefined) {
              log.info(
                `Ignored binary message before kernelInstance is initialized`
              )
            } else {
              await kernelInstance.push(clientMessage.value)
            }
          }
        } catch (e) {
          log.info("Exception in client message handling loop!")
          await clearOutstandingIntention(scope, modelClient, userId ?? "")
          log.info("Outstanding intention cleared before quitting the session.")
          await clearCallgraphAsync(scope, modelClient, userId ?? "", "en")
          log.info("Callgraph cleared before quitting the session.")
          
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
