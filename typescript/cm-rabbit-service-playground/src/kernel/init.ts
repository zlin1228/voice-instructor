import fetch from "node-fetch"
import { getLanguageNameFallback } from "./language.js"
import {
  Scope,
  buildAttachmentForTimeout,
  checkAndGetAbortSignal,
  launchBackgroundScope
} from "base-core/lib/scope.js"
import { log } from "base-core/lib/logging.js"

import {
  AnthropicLlmClient,
  HUMAN_PROMPT,
  AI_PROMPT
} from "base-nli/lib/llm/anthropic.js"
import { formatDateTime } from "../utils/time.js"
import { azureTextToSpeech } from "./tts-azure.js"
import {
  clearCallgraphAsync,
} from "../callgraph/graph.js"
import {
  sleepSeconds,
  checkAndGetCancelToken,
} from "base-core/lib/scope.js"
import {
  getUserDocCreateIfNotExist,
  wavToRaw,
} from "./kernel-common.js"
import { tokenize } from "./conversation-prompt.js"
import { addToConversationMemory, retrieveRecentConversationMemory, retrieveConversationMemory, MemoryRecord } from "../memory/conversation.js"
import { clearOutstandingIntention } from "./intention.js"
import { formatDbMessage } from "./kernel-common.js"
import { Kernel } from "./kernel.js"

interface WeatherLocationData {
  host_ip: string
  country: string
  city: string
  regionName: string
}

interface Coordinates {
  lat: number
  lon: number
}

interface IntroResponse {
  response: string
  city: string
}

export async function weatherSearch(
  scope: Scope,
  query: string
): Promise<string> {
  const geoCode = await fetch(
    `http://api.openweathermap.org/geo/1.0/direct?q=${query}&limit=1&appid=3cdd6619328dfd0f2d922ddc6b3ec171`
  )
  const geoCodeJson = (await geoCode.json()) as Coordinates[]
  if (geoCodeJson === undefined || geoCodeJson[0] === undefined) {
    return ""
  } else {
    const lat = geoCodeJson[0].lat
    const lon = geoCodeJson[0].lon
    const weather = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=3cdd6619328dfd0f2d922ddc6b3ec171&units=imperial`
    )
    const weatherJson = await weather.json()
    return JSON.stringify(weatherJson)
  }
}

export async function weatherLocationIntro(
  scope: Scope,
  hostIp: string,
  userName: string,
  languageCode: string,
  timeZone: string,
  contextStr: string,
  llmClient: AnthropicLlmClient,
): Promise<IntroResponse> {
  let data: WeatherLocationData = {
    host_ip: "",
    country: "",
    city: "",
    regionName: "",
  }
  let weather: string = ""
  let city: string = ""

  const attachment = buildAttachmentForTimeout(2)
  try {
    await Scope.with(scope, [attachment], async (scope) => {
    try {
      const ip_api_key = "q9O5EKbWfOR5paq"
      const response = await fetch(
        `https://pro.ip-api.com/json/${hostIp}?key=${ip_api_key}`,
        {
          signal: checkAndGetAbortSignal(scope),
        }
      )
      data = (await response.json()) as WeatherLocationData
      log.info(`ip-api response: ${JSON.stringify(data)}`)
      // if random number is less than 0.1, then use the host ip to get the location
      if (Math.random() > 0.1) {
        weather = "not available"
      } else {
        const query = `${data.city},${data.regionName},${data.country}`
        weather = await weatherSearch(scope, query)
      }
      data.host_ip = hostIp
      city = data.city
    } catch {
      weather = "not available"
      data = {
        host_ip: hostIp,
        country: "unknown",
        city: "unknown",
        regionName: "unknown",
      }
      city = "unknown"
    }
  })
  } catch (e) {
    weather = "not available"
    data = {
      host_ip: hostIp,
      country: "unknown",
      city: "unknown",
      regionName: "unknown",
    }
  }
  const formattedTime = formatDateTime(timeZone)

  if (languageCode === "cn") {
    languageCode = "zh-cn"
  } else if (languageCode === "jp") {
    languageCode = "ja"
  } else if (languageCode === "kr") {
    languageCode = "ko"
  }
  const languageName = getLanguageNameFallback(languageCode)

  console.log(languageCode, languageName)

  const bringUpNumbers =
    Math.random() < 0.3 ? "Bring up concrete numbers." : ""
  const beFunny = Math.random() < 0.2 ? "Be funny." : ""
  const referenceContext = Math.random() < 0.65 ? "Reference something from the context." : ""
  const weatherMsg =
    weather === "not available"
      ? "not available"
      : `Weather (all numbers are in Fahrenheit): ${weather}`

  const prompt: string = `${HUMAN_PROMPT}Generate a intro greeting from a friend based on the current time and user's name. Do not bring up any specifics.
Be kind, personal and sweet. Also be quite terse. Anticipate a follow-up long conversation between the user and the assistant, so don't say something like "Have a nice day!".
Do not bring up any particular task. Do not reference any particular numbers apart from the current time or weather.
DO NOT CHANGE THE CURRENT TIME.
${bringUpNumbers}${beFunny}
This greeting should be a continuation from where you left off last time. Here is the context:
${contextStr}
${referenceContext}
You have to respond in the following language: ${languageName}, including the location itself. You know all langauges.
${weatherMsg}
Current time: ${formattedTime}
User's name: ${userName}
Start directly, no quotes. You have to limit your response to two terse sentences.
${AI_PROMPT}`;

  const response = await llmClient.anthropicCompletion(scope, {
    prompt: prompt,
    stopSequences: [],
    temperature0to1: 0.4,
    maxTokens: 256,
  })

  return {
    response: response,
    city: city,
  }
}

export interface LocationBasedGoogleSearchConfig {
  location: string
  hl: string
  google_domain: string
}

const searchLanguageMapping: Record<string, string> = {
  en: "en",
  cn: "zh-cn",
  kr: "ko",
  jp: "ja",
}

interface LocationResult {
  name: string
  canonical_name: string
  country_code: string
  target_type: string
}

export async function determineSearchParameters(
  scope: Scope,
  city: string,
  languageCode: string
): Promise<LocationBasedGoogleSearchConfig> {
  const attachment = buildAttachmentForTimeout(5)
  try {
    await Scope.with(scope, [attachment], async (scope) => {
      const language = searchLanguageMapping[languageCode] ?? "en"
      const result = await fetch(
        `https://serpapi.com/locations.json?q=${city}&limit=1`,
        {
          signal: checkAndGetAbortSignal(scope),
        }
      )
      const resultJson = (await result.json()) as LocationResult[]
      if (resultJson !== undefined && resultJson[0] !== undefined) {
        const canonicalName = resultJson[0].canonical_name
        const hl = language
        return {
          location: canonicalName,
          hl: hl,
          google_domain: "google.com",
        }
      } else {
        return {
          location: "United States",
          hl: "en",
          google_domain: "google.com",
        }
      }
    })
  } catch (e) {}
  return {
    location: "United States",
    hl: "en",
    google_domain: "google.com",
  }
}

export async function generateWelcomeMessage(scope: Scope, kernel: Kernel): Promise<void> {
  launchBackgroundScope(scope, async (scope: any) => {
    kernel.isGreeting = true
    try {
      const userDoc = await getUserDocCreateIfNotExist(
        scope,
        kernel.modelClient,
        kernel.language,
        kernel.userId
      )
      await clearOutstandingIntention(scope, kernel.modelClient, kernel.userId)
      await clearCallgraphAsync(scope, kernel.modelClient, kernel.userId, kernel.language)

      while (kernel.embeddingClient == null) {
        await sleepSeconds(scope, 0.2)
        console.log("Waiting for openAiEmbeddingClient to be initialized...")
      }

      while (!kernel.milvusInit) {
        await sleepSeconds(scope, 0.2)
        console.log("Waiting for milvusClient to be initialized...")
      }

      const memory = await retrieveRecentConversationMemory(
        scope, userDoc, 10, kernel.milvusClient, kernel.userId, kernel.milvusCollectionName
      )

      var context = memory.map((result) => {
        return result['text']
      })
      context = ["User logged in again."].concat(context ?? [])
      var tokenCount = tokenize(context.join("\n"))
      while (tokenCount > 2000) {
        context = context.slice(2)
        tokenCount = tokenize(context.join("\n"))
      }
      const contextStr = context.join("\n")
      const userName = userDoc?.user_name ?? "User"
      const speaker = userDoc?.speaker ?? "female"
      const assistantName = userDoc?.assistant_name ?? "Assistant"

      while (kernel.anthropicLlmClient == null) {
        await sleepSeconds(scope, 0.2)
        console.log("Waiting for anthropicLlmClient to be initialized...")
      }

      const response = await weatherLocationIntro(
        scope,
        kernel.hostIp,
        userName,
        kernel.language,
        kernel.timeZone,
        contextStr,
        kernel.anthropicLlmClient
      )

      // add to salient memory
      kernel.salientMemory.push("Assistant: " + response.response)
      // add to milvus memory
      await addToConversationMemory(scope, userDoc, kernel.userId,
        kernel.language, kernel.milvusCollectionName, kernel.modelClient,
        kernel.embeddingClient, kernel.milvusClient, [formatDbMessage(assistantName, response.response)])

      if (kernel.listening) {
        const responseAudio = await azureTextToSpeech(
          scope,
          response.response,
          kernel.language,
          speaker
        )
        console.log("responseAudio.duration: ", responseAudio.duration)
        kernel.serverMessageQueue.pushBack({
          kind: "json",
          value: {
            kernel: {
              assistantResponse: response.response,
            },
          },
        })
        kernel.serverMessageQueue.pushBack({
          kind: "binary",
          value: responseAudio.data,
        })
        await sleepSeconds(scope, responseAudio.duration / 10000000)
      } else {
        kernel.serverMessageQueue.pushBack({
          kind: "json",
          value: {
            kernel: {
              assistantResponse: response.response,
            },
          },
        })
      }
      const searchParameter = await determineSearchParameters(
        scope,
        response.city,
        kernel.language
      )
      console.log("searchParameter: ", searchParameter)
      if (userDoc != undefined) {
        const userDoc_ = {
          _id: userDoc._id,
          search_config: searchParameter,
        }
        await kernel.modelClient.userStorageCollections
          .get(kernel.language)
          ?.bulkMergeFields(scope, [userDoc_])
      }
    } catch (e) {
      log.info(`greeting failed: [${String(e)}]`)
    }
    kernel.isGreeting = false
  })
}

