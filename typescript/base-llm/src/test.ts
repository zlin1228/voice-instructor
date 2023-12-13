import { log } from "base-core/lib/logging.js"
import { Scope } from "base-core/lib/scope.js"
import { runMainScope } from "base-node/lib/main-scope.js"
import { createFileReadable } from "base-node/lib/file.js"
import { readableToAsyncIterable } from "base-core/lib/stream.js"
import {
  buildOpenAiLlmClient,
  openAiModel_Gpt35_Turbo_16K,
  openAiModel_Gpt4,
} from "./llm-openai.js"
import {
  anthropicModel_Claude2,
  buildAnthropicLlmClient,
} from "./llm-anthropic.js"

async function testOpenAiLlmClient(scope: Scope) {
  const llmClient = await buildOpenAiLlmClient(scope, {
    apiKey: "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",
    model: openAiModel_Gpt35_Turbo_16K,
    // model: openAiModel_Gpt4,
  })
  const response = await llmClient.chatCompletion(scope, {
    content: "Hello, how are you?",
    temperature0to1: 0.5,
  })
  console.log(response)
}

async function testAnthropicLlmClient(scope: Scope) {
  const llmClient = await buildAnthropicLlmClient(scope, {
    apiKey:
      "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",
    model: anthropicModel_Claude2,
    maxTokensToSample: 4000,
  })
  const response = await llmClient.chatCompletion(scope, {
    content: "Hello, how are you?",
    temperature0to1: 0.5,
  })
  console.log(response)
}

async function testOpenAiLlmClientStream(scope: Scope) {
  const llmClient = await buildOpenAiLlmClient(scope, {
    apiKey: "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",
    model: openAiModel_Gpt35_Turbo_16K,
    // model: openAiModel_Gpt4,
  })
  for await (const content of llmClient.chatCompletionStream(scope, {
    content: "Hello, could you write a long scientific story in 30 words?",
    temperature0to1: 0.5,
  })) {
    console.log(content)
  }
}

async function testAnthropicLlmClientStream(scope: Scope) {
  const llmClient = await buildAnthropicLlmClient(scope, {
    apiKey:
      "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",
    model: anthropicModel_Claude2,
    maxTokensToSample: 4000,
  })
  for await (const content of llmClient.chatCompletionStream(scope, {
    content: "Hello, could you write a long scientific story in 30 words?",
    temperature0to1: 0.5,
  })) {
    console.log(content)
  }
}

async function main(scope: Scope, cancel: (error: Error) => void) {
  log.info("base-llm test")
  await testOpenAiLlmClient(scope)
}

void (async () => {
  await runMainScope(main)
  // process.exit()
})()
