import { Readable } from "node:stream"
import { IncomingMessage } from "node:http"

import { ChatCompletionFunctions, Configuration, CreateChatCompletionResponse, OpenAIApi } from "openai"
import { abortIfUndefined } from "base-core/lib/debug.js"

import {
  BytesReadable,
  splitReadableToStringIter,
} from "base-core/lib/stream.js"
import { stringRemovePrefix } from "base-core/lib/string.js"
import { throwError } from "base-core/lib/exception.js"
import {
  CookType,
  arrayType,
  int32Type,
  nullableType,
  objectType,
  stringType,
} from "base-core/lib/types.js"
import { commonNormalizer } from "base-core/lib/types-common.js"
import { ChatFragment, ChatMessage } from "./chat.js"

const openAiApiKey = "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"

const configuration = new Configuration({
  apiKey: openAiApiKey,
})
const openai = new OpenAIApi(configuration)

const openAiStreamDataType = objectType([
  { name: "id", type: stringType },
  { name: "object", type: stringType },
  { name: "created", type: int32Type },
  { name: "model", type: stringType },
  {
    name: "choices",
    type: arrayType(
      objectType([
        {
          name: "delta",
          type: objectType([
            { name: "role", type: stringType, optional: true },
            { name: "content", type: stringType, optional: true },
          ] as const),
        },
        { name: "index", type: int32Type },
        { name: "finish_reason", type: nullableType(stringType) },
      ] as const)
    ),
  },
] as const)

export async function* openAiCompleteChat(
  messages: ChatMessage[],
  stopSequence: string[] = [],
  logitBias: Record<number, number> = {},
  temperature: number = 0.9
): AsyncGenerator<ChatFragment> {
  // https://github.com/openai/openai-node/issues/18#issuecomment-1369996933
  const resp = await openai.createChatCompletion(
    {
      model: "gpt-3.5-turbo-16k",
      messages: messages.map((message) => (message.content === undefined ?
        {
          role:
            message.role === "system" ||
              message.role === "assistant" ||
              message.role === "function" ||
              message.role === "user"
              ? message.role
              : throwError(`Invalid role for OpenAI chat: [${message.role}]`),
          function_call: message.function_call ?? { name: "", arguments: "" },
          ...(message.name === undefined ? undefined : { name: message.name }),
        } :
        {
          role:
            message.role === "system" ||
              message.role === "assistant" ||
              message.role === "function" ||
              message.role === "user"
              ? message.role
              : throwError(`Invalid role for OpenAI chat: [${message.role}]`),
          content: message.content ?? "",
          ...(message.name === undefined ? undefined : { name: message.name }),
        })),
      stop: stopSequence,
      logit_bias: logitBias,
      temperature: temperature,
      stream: true,
    },
    { responseType: "stream" }
  )
  const data = resp.data as unknown as IncomingMessage
  for await (const message of splitReadableToStringIter(
    Readable.toWeb(data) as BytesReadable,
    "\n\n"
  )) {
    const body =
      stringRemovePrefix(message, "data: ") ??
      throwError(`Invalid response from OpenAI: [${message}]`)
    if (body === "[DONE]") {
      break
    }
    const d = commonNormalizer(openAiStreamDataType, JSON.parse(body))
    const content = d.choices[0]?.delta.content
    if (content !== undefined) {
      yield { fragment: content }
    }
    if (d.choices[0]?.finish_reason === "stop") {
      break
    } else if (d.choices[0]?.finish_reason === "length") {
      yield { truncated: true }
      break
    }
  }
}

export async function openAiCompleteChatNonStreaming(
  messages: ChatMessage[],
  temperature: number = 0.9,
  model: string = "gpt-3.5-turbo-16k"
): Promise<string> {
  const resp = await openai.createChatCompletion(
    {
      model: model,
      messages: messages.map((message) => (
        message.content === undefined ?
          {
            role:
              message.role === "system" ||
                message.role === "assistant" ||
                message.role === "function" ||
                message.role === "user"
                ? message.role
                : throwError(`Invalid role for OpenAI chat: [${message.role}]`),
            function_call: message.function_call ?? { name: "", arguments: "" },
            ...(message.name === undefined ? undefined : { name: message.name }),
          } :
          {
            role:
              message.role === "system" ||
                message.role === "assistant" ||
                message.role === "function" ||
                message.role === "user"
                ? message.role
                : throwError(`Invalid role for OpenAI chat: [${message.role}]`),
            content: message.content ?? "",
            ...(message.name === undefined ? undefined : { name: message.name }),
          }
      )),
      stream: false,
      temperature: temperature,
    })
  const res = abortIfUndefined(resp.data as CreateChatCompletionResponse).choices
  if (res.length === 0) {
    return ""
  } else {
    return res[0]?.message?.content ?? ""
  }
}

export async function openAiCompleteChatNonStreamingFunctions(
  messages: ChatMessage[],
  functions: ChatCompletionFunctions[],
  temperature: number = 0.9,
  model: string = "gpt-3.5-turbo-16k"
): Promise<{
  name: string,
  arguments: string,
}> {
  const resp = await openai.createChatCompletion(
    {
      model: model,
      messages: messages.map((message) => (message.content === undefined ?
        {
          role:
            message.role === "system" ||
              message.role === "assistant" ||
              message.role === "function" ||
              message.role === "user"
              ? message.role
              : throwError(`Invalid role for OpenAI chat: [${message.role}]`),
          function_call: message.function_call ?? { name: "", arguments: "" },
          ...(message.name === undefined ? undefined : { name: message.name }),
        } :
        {
          role:
            message.role === "system" ||
              message.role === "assistant" ||
              message.role === "function" ||
              message.role === "user"
              ? message.role
              : throwError(`Invalid role for OpenAI chat: [${message.role}]`),
          content: message.content ?? "",
          ...(message.name === undefined ? undefined : { name: message.name }),
        })),
      stream: false,
      temperature: temperature,
      functions: functions,
    })
  const res = abortIfUndefined(resp.data as CreateChatCompletionResponse).choices
  if (res.length === 0) {
    return {
      name: "",
      arguments: "",
    }
  } else {
    const fcall = res[0]?.message?.function_call
    if (fcall === undefined) {
      return {
        name: "",
        arguments: "",
      }
    }
    return {
      name: fcall.name ?? "",
      arguments: fcall.arguments ?? "",
    }
  }
}

export async function openAiCompleteChatNonStreamingSummarize(
  messages: ChatMessage[],
  functions: ChatCompletionFunctions[],
  temperature: number = 0.9,
  model: string = "gpt-3.5-turbo-16k"
): Promise<string> {
  const resp = await openai.createChatCompletion(
    {
      model: model,
      messages: messages.map((message) => (message.content === undefined ?
        {
          role:
            message.role === "system" ||
              message.role === "assistant" ||
              message.role === "function" ||
              message.role === "user"
              ? message.role
              : throwError(`Invalid role for OpenAI chat: [${message.role}]`),
          function_call: message.function_call ?? { name: "", arguments: "" },
          ...(message.name === undefined ? undefined : { name: message.name }),
        } :
        {
          role:
            message.role === "system" ||
              message.role === "assistant" ||
              message.role === "function" ||
              message.role === "user"
              ? message.role
              : throwError(`Invalid role for OpenAI chat: [${message.role}]`),
          content: message.content ?? "",
          ...(message.name === undefined ? undefined : { name: message.name }),
        })),
      stream: false,
      temperature: temperature,
      functions: functions,
    })
  console.log(resp)
  const res = abortIfUndefined(resp.data as CreateChatCompletionResponse).choices
  if (res.length === 0) {
    return ""
  } else {
    return res[0]?.message?.content ?? ""
  }
}