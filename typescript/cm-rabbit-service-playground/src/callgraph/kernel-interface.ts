import { log } from "base-core/lib/logging.js"
import { OneOf } from "base-core/lib/one-of.js"
import {
  Scope,
  launchBackgroundScope,
  ScopeAttachment,
  HandlingQueue,
  runCancellableScope,
} from "base-core/lib/scope.js"
import {
  synthesizeCallgraph,
  CallgraphInitialConfig,
  isScheduleSingleton,
  extractSingetonNode,
  CallgraphExecutionStep,
  clearCallgraphAsync,
} from "../callgraph/graph.js"
import {
  sleepSeconds,
  checkAndGetCancelToken,
} from "base-core/lib/scope.js"
import { addToConversationMemory, retrieveRecentConversationMemory, retrieveConversationMemory, MemoryRecord } from "../memory/conversation.js"
import { updateIntentionByUserUtterance, updateIntentionByAssistantResponse, updateIntentionByRabbitResponse, clearOutstandingIntention } from "../kernel/intention.js"
import { Kernel } from "../kernel/kernel.js"
import { formatDbMessage } from "../kernel/kernel-common.js"

export async function callgraphPattern(
    scope: Scope,
    userDoc: any,
    userMessage: string,
    intention: string,
    assistantName: string,
    assistantResponse: string,
    memory: MemoryRecord[],
    firstFragmentDelivered: { current: boolean },
    kernel: Kernel,
  ): Promise<void> {
    if (userDoc != undefined) {
      try {
        var attachment = kernel.cancelAttachment

        await Scope.with(undefined, [], async (scope: any) => {

          while (kernel.openAiGPT4LlmClient == null || kernel.openAiInstructClient == null || kernel.openAillmClient == null || kernel.milvusClient == null) {
            await sleepSeconds(scope, 0.2)
            console.log("Waiting for openAiGPT4LlmClient and openAiInstructClient and openAillmClient and milvusClient to be initialized...")
          }

          const context = memory.map((record) => record.text).join("\n")
          const speaker = userDoc.speaker
          const initialConfig: CallgraphInitialConfig = {
            languageCode: kernel.language,
            context: context,
          }

          kernel.serverMessageQueue.pushBack({
            kind: "json",
            value: {
              kernel: {
                debugChat: {
                  assistantName,
                  assistantResponse,
                },
              },
            },
          })

          kernel.sharedParameter = {
            languageCode: kernel.language,
            context: context,
            question: intention,
            previousResponse: assistantResponse,
            timeZone: kernel.timeZone,
          }

          const intentionCallgraphSchedule = await synthesizeCallgraph(
            intention,
            assistantResponse,
            kernel.modelClient,
            kernel.userId,
            scope,
            kernel.language,
            kernel.openAiGPT4LlmClient,
            kernel.openAiInstructClient,
            initialConfig
          )

          console.log("\tintentionCallgraphSchedule: ", intentionCallgraphSchedule)
          if (intentionCallgraphSchedule.steps.length > 0) {
            if (isScheduleSingleton(intentionCallgraphSchedule)) {
              const singleton = extractSingetonNode(intentionCallgraphSchedule);
              console.log(
                "Callgraph: Singleton.", singleton
              )
              if (singleton.action === "clear_history") {
                kernel.salientMemory = []
              }
            } else {
              console.log(
                "Callgraph: Non-Singleton. Handle step by step in change stream."
              )
            }
          } else {
            log.info("Callgraph: Empty Graph.")
            const newIntentionAssistantResponse = await updateIntentionByAssistantResponse(scope, kernel.modelClient, kernel.openAiInstructClient, kernel.userId, assistantResponse, kernel.salientMemory)
            console.log("newIntentionAssistantResponse: ", newIntentionAssistantResponse)
          }

        })
      } catch (e) {
        log.info(`callgraph failed: [${String(e)}]`)
      }

      const dbMessages = `${userMessage}
${formatDbMessage(assistantName, assistantResponse)}`

      await addToConversationMemory(scope, userDoc, kernel.userId,
        kernel.language, kernel.milvusCollectionName, kernel.modelClient,
        kernel.embeddingClient, kernel.milvusClient, [dbMessages])

      kernel.serverMessageQueue.pushBack({
        kind: "json",
        value: {
          kernel: {
            debugChat: {
              assistantName,
              assistantResponse,
            },
          },
        },
      })
    }
  }