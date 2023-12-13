import fetch from "node-fetch"
import { format } from "date-fns"
import { openAiCompleteChatNonStreaming } from "./openai.js"
import { ChatMessage } from "./chat.js"
import { getLanguageNameFallback } from "./language.js"
import {
  Scope,
  buildAttachmentForTimeout,
  checkAndGetAbortSignal,
} from "base-core/lib/scope.js"
import { log } from "base-core/lib/logging.js"

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
  timeZone: string
): Promise<IntroResponse> {
  let data: WeatherLocationData
  let weather: string
  let city: string

  const attachment = buildAttachmentForTimeout(1)
  return await Scope.with(scope, [attachment], async (scope) => {
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

    const formattedTime = new Date().toLocaleDateString("en-US", {
      timeZone: timeZone,
      hour: "numeric",
      minute: "numeric",
      hour12: true,
    })

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
      Math.random() < 0.5 ? "Bring up concrete numbers." : ""
    const beFunny = Math.random() < 0.2 ? "Be funny." : ""
    const weatherMsg =
      weather === "not available"
        ? "not available"
        : `Weather (all numbers are in Fahrenheit): ${weather}`

    const messages: ChatMessage[] = [
      {
        role: "user",
        content:
          `Generate a intro greeting from a friend based on the current time and user's name. Do not bring up any specifics.
Be kind, personal and sweet. Also be quite terse. Two sentences max. Anticipate a follow-up long conversation between the user and the assistant, so don't say something like "Have a nice day!".
Do not bring up any particular task. Do not reference any particular numbers apart from the current time or weather.
DO NOT CHANGE THE CURRENT TIME.
${bringUpNumbers}${beFunny}
You have to respond in the following language: ${languageName}, including the location itself. You know all langauges.
${weatherMsg}
Current time: ${formattedTime}
User's name: ${userName}
Start directly, no quotes.
`.trim(),
      },
    ]

    return {
      response: await openAiCompleteChatNonStreaming(messages, 0.1),
      city: city,
    }
  })
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
  return await Scope.with(scope, [attachment], async (scope) => {
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
}
