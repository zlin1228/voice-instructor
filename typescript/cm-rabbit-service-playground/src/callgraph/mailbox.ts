import { log } from "base-core/lib/logging.js"
import { OneOf } from "base-core/lib/one-of.js"
import {
  Scope,
  launchBackgroundScope,
  ScopeAttachment,
  HandlingQueue,
  runCancellableScope,
} from "base-core/lib/scope.js"
import { buildAttachmentForCancellation } from "base-core/lib/scope.js"
import { chatFragmentIterToChatPieceIter } from "../kernel/chat.js"
import { ModelClient, UserStorage, sharedCallgraphOutput } from "../model.js"
import { azureTextToSpeech } from "../kernel/tts-azure.js"
import {
  Os2ClientMessage,
  Os2ServerMessage,
} from "cm-rabbit-common/lib/schema/schema.js"
import {
  clearCallgraphAsync,
} from "../callgraph/graph.js"
import {
  sleepSeconds,
  checkAndGetCancelToken,
} from "base-core/lib/scope.js"
import {
  getUserDocCreateIfNotExist,
  formatDbMessage,
} from "../kernel/kernel-common.js"
import { addToConversationMemory, retrieveRecentConversationMemory, retrieveConversationMemory, MemoryRecord } from "../memory/conversation.js"
import { updateIntentionByUserUtterance, updateIntentionByAssistantResponse, updateIntentionByRabbitResponse, clearOutstandingIntention } from "../kernel/intention.js"
import { synthesizeBunnyFlushResponse } from "../callgraph/nli.js"
import { Kernel } from "../kernel/kernel.js"

export function flushBunnyMailbox(scope: Scope,
  modelClient: ModelClient, serverMessageQueue: HandlingQueue<OneOf<{ json: Os2ServerMessage; binary: Uint8Array }>>,
  speaker: string, assistantName: string,
  newBunnyMailbox: { bunnyId: string, result: string, flush: boolean }[],
  kernel: Kernel, attachment: ScopeAttachment,
  clear: boolean = false
) {
  kernel.isFlushing = true
  launchBackgroundScope(scope, async (scope: Scope) => {
    if (newBunnyMailbox.length > kernel.bunnyMailbox.length) {
      console.log("New bunnyMailbox: ", newBunnyMailbox)
    }
    kernel.bunnyMailbox = newBunnyMailbox

    while (kernel.isGreeting) {
      await sleepSeconds(scope, 0.5)
      console.log("Waiting for greeting to be finished...")
    }

    const userDoc = await getUserDocCreateIfNotExist(
      scope,
      kernel.modelClient,
      kernel.language,
      kernel.userId
    )

    // convert newBunnyMailbox to string
    var bunnyString = ""

    for (var i = 0; i < newBunnyMailbox.length; i++) {
      const bunny = newBunnyMailbox[i]
      if (bunny !== undefined && !bunny.flush) {
        bunnyString += `${i + 1}: ${bunny.result}\n`
      }
    }

    if (bunnyString.trim() === "") {
      console.log("bunnyString is empty. Skipping...")
      kernel.isFlushing = false
      if (clear) {
        console.log("Clearing callgraph...")
        await clearCallgraphAsync(scope, kernel.modelClient, kernel.userId, kernel.language)
        console.log("Callgraph cleared.")
      }
      return
    }

    console.log("-----------------------------------")
    console.log("bunnyString: ", bunnyString)
    console.log("-----------------------------------")
    console.log("shared_callgraph_output", userDoc.shared_callgraph_output)
    console.log("-----------------------------------")

    // clear bunny mailbox in db
    const userDoc_ = {
      _id: userDoc._id,
      bunny_mailbox: []
    }
    await kernel.modelClient.userStorageCollections
      .get(kernel.language)
      ?.bulkMergeFields(scope, [userDoc_])

    let assistantCallgraphResponse = ""
    try {
      await Scope.with(undefined, [], async (scope: any) => {

        while (kernel.openAillmClient == null || kernel.openAiInstructClient == null) {
          await sleepSeconds(scope, 0.1)
          console.log("Waiting for openAillmClient and openAiInstructClient to be initialized...")
        }

        for await (var chatAccumulator of chatFragmentIterToChatPieceIter(synthesizeBunnyFlushResponse(
          scope, bunnyString, kernel.salientMemory.join("\n"), kernel.language, kernel.openAillmClient, kernel.timeZone
        )
        )) {
          if (kernel.userUtteranceInProgress) {
            console.log("User utterance in progress. Skipping...")
            return
          }

          const chatPiece = chatAccumulator.fragment
          log.info(`AI: [Callgraph Response] ${chatPiece}`)
          kernel.salientMemory[kernel.salientMemory.length - 1] = kernel.salientMemory[kernel.salientMemory.length - 1] + chatPiece
          assistantCallgraphResponse += chatPiece

          if (chatPiece.trim().length > 1) {

            const newIntention = await updateIntentionByAssistantResponse(
              scope, modelClient, kernel.openAiInstructClient, kernel.userId, assistantCallgraphResponse, kernel.salientMemory)

            console.log("\t newIntention in callgraph: ", newIntention)

            if (kernel.listening) {
              const responseAudio = await azureTextToSpeech(
                scope,
                chatPiece,
                kernel.language,
                speaker
              )
              console.log(
                "responseAudio.duration: ",
                responseAudio.duration
              )
              serverMessageQueue.pushBack({
                kind: "json",
                value: {
                  kernel: {
                    assistantResponse: chatPiece,
                  },
                },
              })
              serverMessageQueue.pushBack({
                kind: "binary",
                value: responseAudio.data,
              })
              await sleepSeconds(
                scope,
                responseAudio.duration / 10000000
              )
            } else {
              serverMessageQueue.pushBack({
                kind: "json",
                value: {
                  kernel: {
                    assistantResponse: chatPiece,
                  },
                },
              })
              await sleepSeconds(scope, 0.07 * chatPiece.length)
            }
          }
        }
        console.log(
          "assistantCallgraphResponse: ",
          assistantCallgraphResponse
        )

        await addToConversationMemory(scope, userDoc, kernel.userId,
          kernel.language, kernel.milvusCollectionName, kernel.modelClient,
          kernel.embeddingClient, kernel.milvusClient, [formatDbMessage(assistantName, assistantCallgraphResponse)])

        kernel.isFlushing = false
      })
    } catch (e) {
      log.info(`Exception in flushBunnyMailbox: [${String(e)}]`)
    }

    if (clear) {
      console.log("Clearing callgraph...")
      await clearCallgraphAsync(scope, kernel.modelClient, kernel.userId, kernel.language)
      console.log("Callgraph cleared.")
    }

  })
}
