import { encode as encode_cl100k_base } from "gpt-tokenizer"
import {
  encode as encode_p50k_base,
} from 'gpt-tokenizer/esm/model/text-davinci-003'

import { openai } from "../deps.js"

import { abortIfUndefined, asInstanceOrAbort } from "base-core/lib/debug.js"
import { Scope, checkAndGetAbortSignal } from "base-core/lib/scope.js"
import { throwError } from "base-core/lib/exception.js"
import { arrayToVector } from "base-core/lib/array.js"
import { makeOptionalField } from "base-core/lib/optional.js"
import { InstructClient, InstructCompletionLog, InstructCompletionRequest } from "./client.js"
import { CompletionCreateParams } from "openai/resources/completions.js"
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

export const openAiInstructCompletionRequestType = objectType([
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


export const openAiInstructFunctionCompletionRequestType = objectType([
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

export type openAiInstructCompletionRequest = CookType<
  typeof openAiInstructCompletionRequestType
>

export type openAiInstructFunctionCompletionRequest = CookType<
  typeof openAiInstructFunctionCompletionRequestType
>

export const openAiInstructFunctionCompletionResponseType = objectType([
  {
    name: "name",
    type: stringType,
  },
  {
    name: "arguments",
    type: stringType,
  },
] as const)

export type openAiInstructFunctionCompletionResponse = CookType<
  typeof openAiInstructFunctionCompletionResponseType
>

// OpenAI API Reference:
// https://github.com/openai/openai-node/blob/v4/README.md

// Available models: https://platform.openai.com/docs/models/overview
export const openAiModel_Gpt35_Turbo_Instruct = "gpt-3.5-turbo-instruct"
export const openAiModel_Text_Davinci = "text-davinci-003"
export type OpenAiModel =
  | typeof openAiModel_Gpt35_Turbo_Instruct
  | typeof openAiModel_Text_Davinci

const tokenizerMap = {
  [openAiModel_Gpt35_Turbo_Instruct]: encode_cl100k_base,
  [openAiModel_Text_Davinci]: encode_p50k_base,
} as const

export interface OpenAiInstructOptions {
  apiKey: string | undefined // use env OPENAI_API_KEY if undefined
  model: OpenAiModel
}

export async function buildOpenAiInstructClient(
  scope: Scope,
  options: OpenAiInstructOptions
): Promise<InstructClient> {
  const openaiClient = new openai.OpenAI({
    ...makeOptionalField("apiKey", options.apiKey),
  })
  const encode = tokenizerMap[options.model]
  const buildParams = (
    request: InstructCompletionRequest
  ): CompletionCreateParams => {
    return {
      model: options.model,
      prompt: request.prompt,
      temperature: request.temperature0to1 * 2,
      max_tokens: request.maxTokens,
      // stop: request.stopSequences?.slice(0, 4),
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

  return {
    completion: async (scope, request) => {
      const signal = checkAndGetAbortSignal(scope)
      const params = buildParams(request)
      const startTime = new Date()
      let completionLog: InstructCompletionLog | undefined
      try {
        // console.log("Params", params)
        const completion = await openaiClient.completions.create(
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
          choice.text ??
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
      }
    },

  }
}
