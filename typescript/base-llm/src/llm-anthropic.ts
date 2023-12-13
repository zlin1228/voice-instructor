import { anthropicSdk, anthropicTokenizer } from "./deps.js"

import { Scope, checkAndGetAbortSignal } from "base-core/lib/scope.js"
import { makeOptionalField } from "base-core/lib/optional.js"
import { LlmClient } from "./llm-client.js"
import { log } from "base-core/lib/logging.js"

// anthropic API Reference:
// https://github.com/anthropics/anthropic-sdk-typescript

// Available models: https://docs.anthropic.com/claude/reference/selecting-a-model
export const anthropicModel_ClaudeInstant1 = "claude-instant-1"
export const anthropicModel_Claude2 = "claude-2"
export type AnthropicModel =
  | typeof anthropicModel_ClaudeInstant1
  | typeof anthropicModel_Claude2

export interface AnthropicOptions {
  apiKey: string
  model: AnthropicModel
  maxTokensToSample: number
}

export async function buildAnthropicLlmClient(
  scope: Scope,
  options: AnthropicOptions
): Promise<LlmClient> {
  const anthropicClient = new anthropicSdk.Anthropic({
    ...makeOptionalField("apiKey", options.apiKey),
  })
  return {
    chatCompletion: async (scope, request) => {
      log.info("Anthropic chatCompletion")
      console.log(request.content)
      const completion = await anthropicClient.completions.create(
        {
          model: options.model,
          max_tokens_to_sample: options.maxTokensToSample,
          prompt: `${anthropicSdk.Anthropic.HUMAN_PROMPT} ${request.content} ${anthropicSdk.Anthropic.AI_PROMPT}`,
        },
        {
          signal: checkAndGetAbortSignal(scope),
        }
      )
      console.log(completion.completion)
      // return {
      //   content: completion.completion,
      //   promptTokenCount: anthropicTokenizer.countTokens(request.content),
      //   completionTokenCount: anthropicTokenizer.countTokens(
      //     completion.completion
      //   ),
      // }
      return completion.completion
    },

    chatCompletionStream: async function* (scope, request) {
      const completionStream = await anthropicClient.completions.create(
        {
          model: options.model,
          max_tokens_to_sample: 1000,
          prompt: `${anthropicSdk.Anthropic.HUMAN_PROMPT} ${request.content} ${anthropicSdk.Anthropic.AI_PROMPT}`,
          stream: true,
        },
        {
          signal: checkAndGetAbortSignal(scope),
        }
      )
      for await (const completion of completionStream) {
        yield completion.completion
      }
    },
  }
}
