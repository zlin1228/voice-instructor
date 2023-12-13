import { anthropicSdk, anthropicTokenizer } from "../deps.js"

import { Scope, checkAndGetAbortSignal } from "base-core/lib/scope.js"
import { makeOptionalField } from "base-core/lib/optional.js"
import { LlmClient, LlmCompletionLog, LlmCompletionRequest } from "./client.js"
import { CompletionCreateParams } from "@anthropic-ai/sdk/resources/index.js"
import { abortIfUndefined } from "base-core/lib/debug.js"
import {
  CookType,
  arrayType,
  booleanType,
  doubleType,
  int32Type,
  objectType,
  stringType,
} from "base-core/lib/types.js"

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
  completionLogger?: (
    scope: Scope,
    completionLog: LlmCompletionLog
  ) => Promise<void>
}

export const anthropicLlmCompletionRequestType = objectType([
  {
    name: "prompt",
    type: stringType,
  },
  {
    // [0, 1], Amount of randomness injected into the response.
    name: "temperature0to1",
    type: doubleType,
  },
  {
    name: "maxTokens",
    type: int32Type,
  },
  {
    // best efforts - anthropic supports only up to 4 sequences
    name: "stopSequences",
    type: arrayType(stringType),
  },
  {
    // best efforts - not available in Anthropic
    name: "logitBias",
    type: arrayType(
      objectType([
        { name: "text", type: stringType }, // All tokens encoded from the text will be biased.
        { name: "bias", type: doubleType }, // [-1, 1], Amount of bias to be applied to the logit of the specified tokens.
      ] as const)
    ),
    optional: true,
  },
  {
    name: "topP",
    type: doubleType,
    optional: true,
  },
  {
    // best efforts - not available in anthropic
    name: "topK",
    type: int32Type,
    optional: true,
  },
  {
    name: "userId",
    type: stringType,
    optional: true,
  },
  {
    // additional text for debugging
    name: "debugText",
    type: stringType,
    optional: true,
  },
] as const)

export type anthropicLlmCompletionRequest = CookType<
  typeof anthropicLlmCompletionRequestType
>

export interface AnthropicLlmClient extends LlmClient {
  anthropicCompletion(
    scope: Scope,
    request: anthropicLlmCompletionRequest
  ): Promise<string>

  anthropicCompletionStream(
    scope: Scope,
    request: anthropicLlmCompletionRequest
  ): AsyncIterable<string>
}

export const HUMAN_PROMPT = anthropicSdk.Anthropic.HUMAN_PROMPT;
export const AI_PROMPT = anthropicSdk.Anthropic.AI_PROMPT;

export async function buildAnthropicLlmClient(
  scope: Scope,
  options: AnthropicOptions
): Promise<AnthropicLlmClient> {
  const anthropicClient = new anthropicSdk.Anthropic({
    ...makeOptionalField("apiKey", options.apiKey),
  })
  const buildParams = (
    request: LlmCompletionRequest
  ): CompletionCreateParams => {
    return {
      model: options.model,
      prompt:
        request.messages
          .map((message, idx) => {
            if (message.includes(anthropicSdk.Anthropic.HUMAN_PROMPT)) {
              throw new Error("message cannot contain human prompt")
            }
            if (message.includes(anthropicSdk.Anthropic.AI_PROMPT)) {
              throw new Error("message cannot contain AI prompt")
            }
            return (request.messages.length - idx) % 2 === 1
              ? `${anthropicSdk.Anthropic.HUMAN_PROMPT} ${message}`
              : `${anthropicSdk.Anthropic.AI_PROMPT} ${message}}`
          })
          .join("") + anthropicSdk.Anthropic.AI_PROMPT,
      temperature: request.temperature0to1,
      max_tokens_to_sample: request.maxTokens,
      stop_sequences: [...request.stopSequences],
      ...makeOptionalField("top_p", request.topP),
      ...makeOptionalField("top_k", request.topK),
      metadata: {
        ...makeOptionalField("user_id", request.userId),
      },
    }
  }

  const buildAnthropicParams = (
    request: anthropicLlmCompletionRequest
  ): CompletionCreateParams => {
    if (!request.prompt.includes(anthropicSdk.Anthropic.HUMAN_PROMPT) || !request.prompt.includes(anthropicSdk.Anthropic.AI_PROMPT)) {
      throw new Error("prompt must contain both human and AI prompts")
    }
    return {
      model: options.model,
      prompt: request.prompt,
      temperature: request.temperature0to1,
      max_tokens_to_sample: request.maxTokens,
      stop_sequences: [...request.stopSequences],
      ...makeOptionalField("top_p", request.topP),
      ...makeOptionalField("top_k", request.topK),
      metadata: {
        ...makeOptionalField("user_id", request.userId),
      },
    }
  }

  return {
    chatCompletion: async (scope, request) => {
      const signal = checkAndGetAbortSignal(scope)
      const params = buildParams(request)
      const startTime = new Date()
      let completionLog: LlmCompletionLog | undefined
      try {
        const completion = await anthropicClient.completions.create(
          {
            ...params,
            stream: false,
          },
          {
            signal,
          }
        )
        completionLog = {
          request,
          stream: false,
          elapsedSeconds: (new Date().getTime() - startTime.getTime()) / 1000,
          responseComplete: {
            promptTokenCount: anthropicTokenizer.countTokens(params.prompt),
            completionTokenCount: anthropicTokenizer.countTokens(
              completion.completion
            ),
            content: completion.completion,
          },
        }
        return completion.completion
      } catch (e) {
        completionLog = {
          request,
          stream: false,
          elapsedSeconds: (new Date().getTime() - startTime.getTime()) / 1000,
          responseError: String(e),
        }
        throw e
      } finally {
        await options.completionLogger?.(scope, abortIfUndefined(completionLog))
      }
    },

    anthropicCompletion: async (scope, request) => {
      const signal = checkAndGetAbortSignal(scope)
      const params = buildAnthropicParams(request)
      const startTime = new Date()
      let completionLog: LlmCompletionLog | undefined
      const loggingRequest : LlmCompletionRequest = {
        ... request,
        messages: [request.prompt],
      }
      try {
        const completion = await anthropicClient.completions.create(
          {
            ...params,
            stream: false,
          },
          {
            signal,
          }
        )
        completionLog = {
          request: loggingRequest,
          stream: false,
          elapsedSeconds: (new Date().getTime() - startTime.getTime()) / 1000,
          responseComplete: {
            promptTokenCount: anthropicTokenizer.countTokens(params.prompt),
            completionTokenCount: anthropicTokenizer.countTokens(
              completion.completion
            ),
            content: completion.completion,
          },
        }
        return completion.completion
      } catch (e) {
        completionLog = {
          request: loggingRequest,
          stream: false,
          elapsedSeconds: (new Date().getTime() - startTime.getTime()) / 1000,
          responseError: String(e),
        }
        throw e
      } finally {
        await options.completionLogger?.(scope, abortIfUndefined(completionLog))
      }
    },

    chatCompletionStream: async function* (scope, request) {
      const signal = checkAndGetAbortSignal(scope)
      const params = buildParams(request)
      const startTime = new Date()
      let completionLog: LlmCompletionLog | undefined
      try {
        const completionStream = await anthropicClient.completions.create(
          {
            ...params,
            stream: true,
          },
          {
            signal,
          }
        )
        const promptTokenCount = anthropicTokenizer.countTokens(params.prompt)
        let completionTokenCount = 0
        let content = ""
        for await (const completion of completionStream) {
          content += completion.completion
          completionTokenCount += anthropicTokenizer.countTokens(
            completion.completion
          )
          // Update completionLog before yield so that it gets logged even if the generator is aborted
          completionLog = {
            request,
            stream: true,
            elapsedSeconds: (new Date().getTime() - startTime.getTime()) / 1000,
            responseComplete: {
              promptTokenCount,
              completionTokenCount,
              content,
            },
          }
          yield completion.completion
        }
      } catch (e) {
        completionLog = {
          request,
          stream: true,
          elapsedSeconds: (new Date().getTime() - startTime.getTime()) / 1000,
          responseError: String(e),
        }
      } finally {
        await options.completionLogger?.(scope, abortIfUndefined(completionLog))
      }
    },

    anthropicCompletionStream: async function* (scope, request) {
      const signal = checkAndGetAbortSignal(scope)
      const params = buildAnthropicParams(request)
      const startTime = new Date()
      let completionLog: LlmCompletionLog | undefined
      const loggingRequest : LlmCompletionRequest = {
        ... request,
        messages: [request.prompt],
      }
      try {
        const completionStream = await anthropicClient.completions.create(
          {
            ...params,
            stream: true,
          },
          {
            signal,
          }
        )
        const promptTokenCount = anthropicTokenizer.countTokens(params.prompt)
        let completionTokenCount = 0
        let content = ""
        for await (const completion of completionStream) {
          content += completion.completion
          completionTokenCount += anthropicTokenizer.countTokens(
            completion.completion
          )
          // Update completionLog before yield so that it gets logged even if the generator is aborted
          completionLog = {
            request: loggingRequest,
            stream: true,
            elapsedSeconds: (new Date().getTime() - startTime.getTime()) / 1000,
            responseComplete: {
              promptTokenCount,
              completionTokenCount,
              content,
            },
          }
          yield completion.completion
        }
      } catch (e) {
        completionLog = {
          request: loggingRequest,
          stream: true,
          elapsedSeconds: (new Date().getTime() - startTime.getTime()) / 1000,
          responseError: String(e),
        }
      } finally {
        await options.completionLogger?.(scope, abortIfUndefined(completionLog))
      }
    },
  }
}
