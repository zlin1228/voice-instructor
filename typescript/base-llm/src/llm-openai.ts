import { openai } from "./deps.js"

import { Scope, checkAndGetAbortSignal } from "base-core/lib/scope.js"
import { throwError } from "base-core/lib/exception.js"
import { arrayToVector } from "base-core/lib/array.js"
import { makeOptionalField } from "base-core/lib/optional.js"
import { LlmClient } from "./llm-client.js"

// OpenAI API Reference:
// https://github.com/openai/openai-node/blob/v4/README.md

export const openAiModel_Gpt35_Turbo_16K = "gpt-3.5-turbo-16k"
export const openAiModel_Gpt4 = "gpt-4"
export const openAiModel_Gpt4_32K = "gpt-4-32k"
export const openAiModel_Gpt35_Finetuned_ClearConversation = "ft:gpt-3.5-turbo-0613:rabbit:clear-memory:8E9N2rZc"
export type OpenAiModel =
  | typeof openAiModel_Gpt35_Turbo_16K
  | typeof openAiModel_Gpt4
  | typeof openAiModel_Gpt4_32K
  | typeof openAiModel_Gpt35_Finetuned_ClearConversation

export interface OpenAiLlmOptions {
  apiKey: string | undefined // use env OPENAI_API_KEY if undefined
  model: OpenAiModel
}

export async function buildOpenAiLlmClient(
  scope: Scope,
  options: OpenAiLlmOptions
): Promise<LlmClient> {
  const openaiClient = new openai.OpenAI({
    ...makeOptionalField("apiKey", options.apiKey),
  })
  return {
    chatCompletion: async (scope, request) => {
      const completion = await openaiClient.chat.completions.create(
        {
          messages: [
            {
              role: "user",
              content: request.content,
            },
          ],
          model: options.model,
          temperature: request.temperature0to1 * 2,
        },
        {
          signal: checkAndGetAbortSignal(scope),
        }
      )
      const [choice] =
        arrayToVector(completion.choices, 1) ??
        throwError(
          "Invalid response from OpenAI (completion.choices.length !== 1)"
        )
      if (choice.finish_reason !== "stop") {
        throw new Error("Invalid response from OpenAI (finish_reason !== stop)")
      }
      const content =
        choice.message.content ??
        throwError("Invalid response from OpenAI (empty content)")
      // const promptTokenCount =
      //   completion.usage?.prompt_tokens ??
      //   throwError("Invalid response from OpenAI (prompt_tokens not available)")
      // const completionTokenCount =
      //   completion.usage?.completion_tokens ??
      //   throwError(
      //     "Invalid response from OpenAI (completion_tokens not available)"
      //   )
      return content
    },

    chatCompletionStream: async function* (scope, request) {
      const completionStream = await openaiClient.chat.completions.create(
        {
          messages: [
            {
              role: "user",
              content: request.content,
            },
          ],
          model: options.model,
          temperature: request.temperature0to1 * 2,
          stream: true,
        },
        {
          signal: checkAndGetAbortSignal(scope),
        }
      )
      for await (const completion of completionStream) {
        const [choice] =
          arrayToVector(completion.choices, 1) ??
          throwError(
            "Invalid response from OpenAI (completion.choices.length !== 1)"
          )
        if (choice.finish_reason !== null) {
          if (choice.finish_reason !== "stop") {
            throw new Error(
              "Invalid response from OpenAI (finish_reason !== stop)"
            )
          }
          continue
        }
        const content =
          choice.delta.content ??
          throwError("Invalid response from OpenAI (empty content)")
        yield content
      }
    },
  }
}
