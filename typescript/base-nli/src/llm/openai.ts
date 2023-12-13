import { encode as encode_cl100k_base } from "gpt-tokenizer"

import { openai } from "../deps.js"

import { abortIfUndefined, asInstanceOrAbort } from "base-core/lib/debug.js"
import { Scope, checkAndGetAbortSignal } from "base-core/lib/scope.js"
import { throwError } from "base-core/lib/exception.js"
import { arrayToVector } from "base-core/lib/array.js"
import { makeOptionalField } from "base-core/lib/optional.js"
import { LlmClient, LlmCompletionLog, LlmCompletionRequest } from "./client.js"
import { CompletionCreateParams } from "openai/resources/chat/index.js"
import {
  CookType,
  arrayType,
  booleanType,
  doubleType,
  int32Type,
  objectType,
  stringType,
} from "base-core/lib/types.js"

export const chatMessageType = objectType([
  { name: "role", type: stringType },
  {
    name: "function_call", type: objectType([
      { name: "name", type: stringType },
      { name: "arguments", type: stringType },
    ] as const), optional: true
  },
  { name: "content", type: stringType, optional: true },
  { name: "name", type: stringType, optional: true },
] as const)

export type ChatMessage = CookType<typeof chatMessageType>

export const chatFragmentType = objectType([
  { name: "fragment", type: stringType, optional: true },
  { name: "truncated", type: booleanType, optional: true },
] as const)

export type ChatFragment = CookType<typeof chatFragmentType>

export const openAiLlmCompletionRequestType = objectType([
  {
    name: "messages",
    type: arrayType(chatMessageType),
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
    // best efforts - OpenAI supports only up to 4 sequences
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
    // best efforts - not available in OpenAI
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


export const openAiLlmFunctionCompletionRequestType = objectType([
  {
    name: "messages",
    type: arrayType(chatMessageType),
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
    // best efforts - OpenAI supports only up to 4 sequences
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
    // best efforts - not available in OpenAI
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
  {
    name: "functions",
    type: arrayType(
      objectType([
        { name: "name", type: stringType },
        { name: "description", type: stringType, optional: true },
      ] as const)
    ),
  },
] as const)

export type openAiLlmCompletionRequest = CookType<
  typeof openAiLlmCompletionRequestType
>

export type openAiLlmFunctionCompletionRequest = CookType<
  typeof openAiLlmFunctionCompletionRequestType
>

export const openAiLlmFunctionCompletionResponseType = objectType([
  {
    name: "name",
    type: stringType,
  },
  {
    name: "arguments",
    type: stringType,
  },
] as const)

export type openAiLlmFunctionCompletionResponse = CookType<
  typeof openAiLlmFunctionCompletionResponseType
>

export interface OpenAiLlmClient extends LlmClient {
  openAiChatCompletion(
    scope: Scope,
    request: openAiLlmCompletionRequest
  ): Promise<string>

  openAiFunctionCompletion(
    scope: Scope,
    request: openAiLlmFunctionCompletionRequest
  ): Promise<openAiLlmFunctionCompletionResponse>

  openAichatCompletionStream(
    scope: Scope,
    request: openAiLlmCompletionRequest
  ): AsyncIterable<string>
}

// OpenAI API Reference:
// https://github.com/openai/openai-node/blob/v4/README.md

// Available models: https://platform.openai.com/docs/models/overview
export const openAiModel_Gpt35_Turbo_16K = "gpt-3.5-turbo-16k"
export const openAiModel_Gpt4 = "gpt-4"
export const openAiModel_Gpt4_32K = "gpt-4-32k"
export const openAiModel_Gpt35_Finetuned_CoreNonexec = "ft:gpt-3.5-turbo-0613:rabbit:core-nonexec:8FGEylgP"

export type OpenAiModel =
  | typeof openAiModel_Gpt35_Turbo_16K
  | typeof openAiModel_Gpt4
  | typeof openAiModel_Gpt4_32K
  | typeof openAiModel_Gpt35_Finetuned_CoreNonexec

const tokenizerMap = {
  [openAiModel_Gpt35_Turbo_16K]: encode_cl100k_base,
  [openAiModel_Gpt4]: encode_cl100k_base,
  [openAiModel_Gpt4_32K]: encode_cl100k_base,
  [openAiModel_Gpt35_Finetuned_CoreNonexec]: encode_cl100k_base,
} as const

export interface OpenAiLlmOptions {
  apiKey: string | undefined // use env OPENAI_API_KEY if undefined
  model: OpenAiModel
  completionLogger?: (
    scope: Scope,
    completionLog: LlmCompletionLog
  ) => Promise<void>
}

export async function buildOpenAiLlmClient(
  scope: Scope,
  options: OpenAiLlmOptions
): Promise<OpenAiLlmClient> {
  const openaiClient = new openai.OpenAI({
    ...makeOptionalField("apiKey", options.apiKey),
  })
  const encode = tokenizerMap[options.model]
  const buildParams = (
    request: LlmCompletionRequest
  ): CompletionCreateParams => {
    return {
      model: options.model,
      messages: request.messages.map((message, idx) => ({
        role: (request.messages.length - idx) % 2 === 1 ? "user" : "assistant",
        content: message,
      })),
      temperature: request.temperature0to1 * 2,
      max_tokens: request.maxTokens,
      stop: request.stopSequences?.slice(0, 4),
      ...makeOptionalField(
        "logit_bias",
        (() => {
          if (request.logitBias === undefined) return undefined
          const tokenMap = new Map<number, number>()
          for (const { text, bias } of request.logitBias) {
            for (const token of encode(text)) {
              tokenMap.set(token, (tokenMap.get(token) ?? 0) + bias)
            }
          }
          return Object.fromEntries(
            [...tokenMap.entries()].map(([token, bias]) => [
              token,
              Math.min(Math.max(bias * 100, -100), 100),
            ])
          )
        })()
      ),
      ...makeOptionalField("top_p", request.topP),
      ...makeOptionalField("user", request.userId),
    }
  }

  const openAiBuildParams = (
    request: openAiLlmCompletionRequest
  ): CompletionCreateParams => {
    return {
      model: options.model,
      messages:
        request.messages as unknown as CompletionCreateParams["messages"],
      temperature: request.temperature0to1 * 2,
      max_tokens: request.maxTokens,
      stop: request.stopSequences?.slice(0, 4),
      ...makeOptionalField(
        "logit_bias",
        (() => {
          if (request.logitBias === undefined) return undefined
          const tokenMap = new Map<number, number>()
          for (const { text, bias } of request.logitBias) {
            for (const token of encode(text)) {
              tokenMap.set(token, (tokenMap.get(token) ?? 0) + bias)
            }
          }
          return Object.fromEntries(
            [...tokenMap.entries()].map(([token, bias]) => [
              token,
              Math.min(Math.max(bias * 100, -100), 100),
            ])
          )
        })()
      ),
      ...makeOptionalField("top_p", request.topP),
      ...makeOptionalField("user", request.userId),
    }
  }

  const openAiBuildFunctionParams = (
    request: openAiLlmFunctionCompletionRequest
  ): CompletionCreateParams => {
    return {
      model: options.model,
      messages:
        request.messages as unknown as CompletionCreateParams["messages"],
      temperature: request.temperature0to1 * 2,
      max_tokens: request.maxTokens,
      ...makeOptionalField("functions", request.functions as unknown as CompletionCreateParams["functions"]),
      stop: request.stopSequences?.slice(0, 4),
      ...makeOptionalField(
        "logit_bias",
        (() => {
          if (request.logitBias === undefined) return undefined
          const tokenMap = new Map<number, number>()
          for (const { text, bias } of request.logitBias) {
            for (const token of encode(text)) {
              tokenMap.set(token, (tokenMap.get(token) ?? 0) + bias)
            }
          }
          return Object.fromEntries(
            [...tokenMap.entries()].map(([token, bias]) => [
              token,
              Math.min(Math.max(bias * 100, -100), 100),
            ])
          )
        })()
      ),
      ...makeOptionalField("top_p", request.topP),
      ...makeOptionalField("user", request.userId),
    }
  }

  const countTokens = (message: ChatMessage) => {
    if (message.content !== undefined) {
      return encode(message.content).length
    } else {
      const args = message.function_call?.arguments ?? ""
      const name = message.function_call?.name ?? ""
      return encode(args).length + encode(name).length
    }
  }

  const serializeMessage = (message: any) => {
    return message.content
      ? message.content
      : message.function_call
      ? `${message.function_call?.name as unknown as string}(${
          message.function_call?.arguments as unknown as string
        })`
      : ""
  }

  return {
    chatCompletion: async (scope, request) => {
      const signal = checkAndGetAbortSignal(scope)
      const params = buildParams(request)
      const startTime = new Date()
      let completionLog: LlmCompletionLog | undefined
      try {
        const completion = await openaiClient.chat.completions.create(
          {
            ...params,
            stream: false,
          },
          { signal }
        )
        const [choice] =
          arrayToVector(completion.choices, 1) ??
          throwError(
            "Invalid response from OpenAI (completion.choices.length !== 1)"
          )
        if (choice.finish_reason !== "stop") {
          throw new Error(
            "Invalid response from OpenAI (finish_reason !== stop)"
          )
        }
        const content =
          choice.message.content ??
          throwError("Invalid response from OpenAI (empty content)")
        const promptTokenCount =
          completion.usage?.prompt_tokens ??
          throwError(
            "Invalid response from OpenAI (prompt_tokens not available)"
          )
        const completionTokenCount =
          completion.usage?.completion_tokens ??
          throwError(
            "Invalid response from OpenAI (completion_tokens not available)"
          )
        completionLog = {
          request,
          stream: false,
          elapsedSeconds: (new Date().getTime() - startTime.getTime()) / 1000,
          responseComplete: {
            promptTokenCount,
            completionTokenCount,
            content,
          },
        }
        return content
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

    openAiChatCompletion: async (scope, request) => {
      const signal = checkAndGetAbortSignal(scope)
      const params = openAiBuildParams(request)
      const startTime = new Date()
      let completionLog: LlmCompletionLog | undefined
      try {
        const completion = await openaiClient.chat.completions.create(
          {
            ...params,
            stream: false,
          },
          { signal }
        )
        const [choice] =
          arrayToVector(completion.choices, 1) ??
          throwError(
            "Invalid response from OpenAI (completion.choices.length !== 1)"
          )
        if (choice.finish_reason !== "stop") {
          throw new Error(
            "Invalid response from OpenAI (finish_reason !== stop)"
          )
        }
        const content =
          choice.message.content ??
          throwError("Invalid response from OpenAI (empty content)")
        const promptTokenCount =
          completion.usage?.prompt_tokens ??
          throwError(
            "Invalid response from OpenAI (prompt_tokens not available)"
          )
        const completionTokenCount =
          completion.usage?.completion_tokens ??
          throwError(
            "Invalid response from OpenAI (completion_tokens not available)"
          )
        const loggingRequest: LlmCompletionRequest = {
          ...request,
          messages: request.messages.map(serializeMessage),
        }
        completionLog = {
          request: loggingRequest,
          stream: false,
          elapsedSeconds: (new Date().getTime() - startTime.getTime()) / 1000,
          responseComplete: {
            promptTokenCount,
            completionTokenCount,
            content,
          },
        }
        return content
      } catch (e) {
        const loggingRequest: LlmCompletionRequest = {
          ...request,
          messages: request.messages.map(serializeMessage),
        }
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

    openAiFunctionCompletion: async (scope, request) => {
      const signal = checkAndGetAbortSignal(scope)
      const params = openAiBuildFunctionParams(request)
      const startTime = new Date()
      let completionLog: LlmCompletionLog | undefined
      try {
        const completion = await openaiClient.chat.completions.create(
          {
            ...params,
            stream: false,
          },
          { signal }
        )
        const [choice] =
          arrayToVector(completion.choices, 1) ??
          throwError(
            "Invalid response from OpenAI (completion.choices.length !== 1)"
          )
        if (choice.finish_reason !== "function_call") {
          throw new Error(
            `Invalid response from OpenAI (finish_reason !== function_call): ${choice.finish_reason}`
          )
        }
        var ret;
        const fcall = choice.message?.function_call
        if (fcall === undefined) {
          ret = {
            name: "",
            arguments: "",
          }
        } else {
          ret = {
            name: fcall.name ?? "",
            arguments: fcall.arguments ?? "",
          }
        }
        const promptTokenCount =
          completion.usage?.prompt_tokens ??
          throwError(
            "Invalid response from OpenAI (prompt_tokens not available)"
          )
        const completionTokenCount =
          completion.usage?.completion_tokens ??
          throwError(
            "Invalid response from OpenAI (completion_tokens not available)"
          )
        const loggingRequest: LlmCompletionRequest = {
          ...request,
          messages: request.messages.map(serializeMessage),
        }
        completionLog = {
          request: loggingRequest,
          stream: false,
          elapsedSeconds: (new Date().getTime() - startTime.getTime()) / 1000,
          responseComplete: {
            promptTokenCount,
            completionTokenCount,
            content: JSON.stringify(ret),
          },
        }

        return ret;
      } catch (e) {
        const loggingRequest: LlmCompletionRequest = {
          ...request,
          messages: request.messages.map(serializeMessage),
        }
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
        const completionStream = await openaiClient.chat.completions.create(
          {
            ...params,
            stream: true,
          },
          { signal }
        )
        const promptTokenCount = request.messages
          .map((message) => encode(message).length)
          .reduce((a, b) => a + b, 0)
        let completionTokenCount = 0
        let content = ""
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
          const contentChunk =
            choice.delta.content ??
            throwError("Invalid response from OpenAI (empty content)")
          content += contentChunk
          completionTokenCount += encode(contentChunk).length
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
          yield contentChunk
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

    openAichatCompletionStream: async function* (scope, request) {
      const signal = checkAndGetAbortSignal(scope)
      const params = openAiBuildParams(request)
      const startTime = new Date()
      let completionLog: LlmCompletionLog | undefined
      try {
        const completionStream = await openaiClient.chat.completions.create(
          {
            ...params,
            stream: true,
          },
          { signal }
        )
        const promptTokenCount = request.messages
          .map(countTokens)
          .reduce((a, b) => a + b, 0)
        let completionTokenCount = 0
        let content = ""
        for await (const completion of completionStream) {
          // console.log("COMPLETION: ", completion)
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
          const contentChunk =
            choice.delta.content ??
            throwError("Invalid response from OpenAI (empty content)")
          content += contentChunk
          completionTokenCount += encode(contentChunk).length
          // Update completionLog before yield so that it gets logged even if the generator is aborted
          const loggingRequest: LlmCompletionRequest = {
            ...request,
            messages: request.messages.map(serializeMessage),
          }
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
          yield contentChunk
        }
      } catch (e) {
        const loggingRequest: LlmCompletionRequest = {
          ...request,
          messages: request.messages.map(serializeMessage),
        }
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
