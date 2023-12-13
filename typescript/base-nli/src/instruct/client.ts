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
// https://github.com/openai/openai-node/blob/e5f385233737002b4bb47a94cba33da7fedfe64d/src/index.ts
// Chat completion:
// https://github.com/openai/openai-node/blob/e5f385233737002b4bb47a94cba33da7fedfe64d/src/resources/completions.ts

export const instructCompletionRequestType = objectType([
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

export type InstructCompletionRequest = CookType<typeof instructCompletionRequestType>

export interface InstructClient {
  completion(scope: Scope, request: InstructCompletionRequest): Promise<string>
}

export const instructCompletionLogType = objectType([
  { name: "request", type: instructCompletionRequestType },
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

export type InstructCompletionLog = CookType<typeof instructCompletionLogType>
