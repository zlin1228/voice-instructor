import { Scope } from "base-core/lib/scope.js"
import {
  CookType,
  arrayType,
  booleanType,
  doubleType,
  int32Type,
  objectType,
  stringType,
} from "base-core/lib/types.js"

// === OpenAI References ===
// Client creation:
// https://github.com/openai/openai-node/blob/v4/src/index.ts
// Chat completion:
// https://github.com/openai/openai-node/blob/v4/src/resources/chat/completions.ts

// === Anthropic References ===
// Client creation:
// https://github.com/anthropics/anthropic-sdk-typescript/blob/main/src/index.ts
// Chat completion:
// https://github.com/anthropics/anthropic-sdk-typescript/blob/main/src/resources/completions.ts

export const llmCompletionRequestType = objectType([
  {
    // Previous messages in the conversation.
    // They must alternate between user and assistant.
    // The last message should be from the user.
    name: "messages",
    type: arrayType(stringType),
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

export type LlmCompletionRequest = CookType<typeof llmCompletionRequestType>

export interface LlmClient {
  chatCompletion(scope: Scope, request: LlmCompletionRequest): Promise<string>

  chatCompletionStream(
    scope: Scope,
    request: LlmCompletionRequest
  ): AsyncIterable<string>
}

export const llmCompletionLogType = objectType([
  { name: "request", type: llmCompletionRequestType },
  { name: "stream", type: booleanType },
  { name: "elapsedSeconds", type: doubleType },
  {
    name: "responseComplete",
    type: objectType([
      { name: "promptTokenCount", type: int32Type },
      { name: "completionTokenCount", type: int32Type },
      { name: "content", type: stringType },
    ] as const),
    optional: true,
  },
  { name: "responseError", type: stringType, optional: true },
] as const)

export type LlmCompletionLog = CookType<typeof llmCompletionLogType>
