import { Scope } from "base-core/lib/scope.js"
import {
  CookType,
  doubleType,
  int32Type,
  objectType,
  stringType,
} from "base-core/lib/types.js"

export const llmCompletionRequestType = objectType([
  { name: "content", type: stringType },
  { name: "temperature0to1", type: doubleType }, // [0, 1], Amount of randomness injected into the response.
] as const)

export type LlmCompletionRequest = CookType<typeof llmCompletionRequestType>

export interface LlmClient {
  chatCompletion(scope: Scope, request: LlmCompletionRequest): Promise<string>

  chatCompletionStream(
    scope: Scope,
    request: LlmCompletionRequest
  ): AsyncIterable<string>
}
