import { arrayMax, comparatorExtract } from "base-core/lib/array.js"
import { log } from "base-core/lib/logging.js"
import { Scope } from "base-core/lib/scope.js"
import { CommonClosure } from "base-core/lib/types-common.js"
import { Type } from "base-core/lib/types.js"
import { LlmClient } from "./client.js"
import {
  extractTypedResponses,
  renderTypeDefinition,
  renderValueAsJsonCodeBlock,
} from "./utils.js"

const instructionsByLanguages = {
  zh: {
    responseTypeInstructions:
      "你将会回答一个完整且合法的 JSON 文档（不是 JavaScript/TypeScript 代码），这个文档包含在独立的 JSON 代码块里，并且符合下面的 TypeScript 类型定义：",
    requestValueInstructions: "你的任务细节是这个 JSON 文档：",
  },
}

export class StructuredLlm {
  readonly #llmClient: LlmClient
  readonly #assistantRoleInstructions: string
  readonly #responseTypeInstructions: string
  readonly #requestValueInstructions: string

  constructor(
    llmClient: LlmClient,
    language: keyof typeof instructionsByLanguages,
    assistantRoleInstructions: string // instructions for the role of the AI assistant
  ) {
    this.#llmClient = llmClient
    this.#assistantRoleInstructions = assistantRoleInstructions
    this.#responseTypeInstructions =
      instructionsByLanguages[language].responseTypeInstructions
    this.#requestValueInstructions =
      instructionsByLanguages[language].requestValueInstructions
  }

  buildCallable<Req, Resp>(
    requestType: Type<CommonClosure, Req>, // type of request
    responseType: Type<CommonClosure, Resp>, // type of response
    instructions: string, // instructions for this call
    temperature0to1: number,
    stopSequences?: string[],
    maxTokens?: number,
    scorer?: (response: Resp) => number // Which to choose if there are multiple responses. Default: prefer longer response.
  ): (scope: Scope, request: Req) => Promise<Resp> {
    return async (scope, request) => {
      const prompt = [
        this.#assistantRoleInstructions,
        instructions,
        this.#responseTypeInstructions,
        renderTypeDefinition(responseType),
        this.#requestValueInstructions,
        renderValueAsJsonCodeBlock(requestType, request),
      ].join("\n\n")
      const completion = await this.#llmClient.chatCompletion(scope, {
        messages: [prompt],
        temperature0to1,
        stopSequences: stopSequences ?? [],
        maxTokens: maxTokens ?? 4000,
      })
      const responses = extractTypedResponses(responseType, completion)
      const top = arrayMax(
        responses,
        scorer ?? ((r) => JSON.stringify(r).length),
        comparatorExtract((s) => s)
      )
      if (top === undefined) {
        log.info("Failed to extract response from completion")
        console.log(completion)
        throw new Error("Failed to extract response from completion")
      }
      if (top[2] <= 0) {
        log.info("Failed to extract acceptable response from completion")
        console.log(completion)
        throw new Error("Failed to extract acceptable response from completion")
      }
      return top[1]
    }
  }
}
