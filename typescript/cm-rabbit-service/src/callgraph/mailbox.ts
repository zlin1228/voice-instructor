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
import { chatFragmentIterToChatPieceIter } from "../conversation/chat.js"
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
  newBunnyMailbox: { bunnyId: string, result: string, flush: boolean, intentionId: string }[],
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

    const currentIntentionId = kernel.currentIntentionId

    // convert newBunnyMailbox to string
    var bunnyString = ""

    for (var i = 0; i < newBunnyMailbox.length; i++) {
      const bunny = newBunnyMailbox[i]
      if (bunny !== undefined && !bunny.flush) {
        bunnyString += `${i + 1}: ${bunny.result}\n`
      }
    }

    var mailboxIntentionIds = newBunnyMailbox.map((bunny) => bunny.intentionId)

    // if the current intention id is not in the mailbox, then set mute = true
    var mute = false
    if (currentIntentionId !== undefined && !mailboxIntentionIds.includes(currentIntentionId)) {
      mute = true
    }
    console.log((mute ? "Muting ..." : "Not muting ..."), "Current intention vs mailboxIntentionIds: ", currentIntentionId, mailboxIntentionIds)

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

        while (kernel.anthropicLlm2Client == null || kernel.openAiInstructClient == null) {
          await sleepSeconds(scope, 0.1)
          console.log("Waiting for anthropicLlm2Client and openAiInstructClient to be initialized...")
        }

        for await (var chatAccumulator of chatFragmentIterToChatPieceIter(synthesizeBunnyFlushResponse(
          scope, bunnyString, kernel.salientMemory.join("\n"), kernel.language, kernel.anthropicLlm2Client, kernel.timeZone
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

          if (chatPiece.trim().length > 1 && !mute) {

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

        const newIntention = await updateIntentionByAssistantResponse(
          scope, modelClient, kernel.openAiInstructClient, kernel.userId, assistantCallgraphResponse, kernel.salientMemory)

        console.log("\t newIntention in callgraph: ", newIntention)

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
