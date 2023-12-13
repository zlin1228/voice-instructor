import azureSpeechSdk, {
  SpeechSynthesisOutputFormat,
} from "microsoft-cognitiveservices-speech-sdk"

import { buildPromise } from "base-core/lib/utils.js"
import { Scope, launchBackgroundScope } from "base-core/lib/scope.js"
import { azure_to_oculus } from "./viseme.js"

const azureSubscriptionKey = "fce543c254dd46fe97fbdc6f2e515ed0"
const azureRegion = "westus"

const azureSpeechConfig = azureSpeechSdk.SpeechConfig.fromSubscription(
  azureSubscriptionKey,
  azureRegion
)
azureSpeechConfig.speechSynthesisOutputFormat =
  SpeechSynthesisOutputFormat.Raw16Khz16BitMonoPcm
azureSpeechConfig.speechSynthesisVoiceName = "en-US-SaraNeural"

const synthesizer = new azureSpeechSdk.SpeechSynthesizer(
  azureSpeechConfig,
  undefined
)

export interface SpeechSegment {
  data: string
  duration: number
  visemeAudioOffsets: number[]
  visemeIds: string[]
}

// It fails if we set Error.stackTraceLimit (???)

export async function azureTextToSpeech(
  scope: Scope,
  text: string,
  language: string,
  speaker: string,
): Promise<SpeechSegment> {
  // examples: https://github.com/Azure-Samples/cognitive-services-speech-sdk/issues/1351#issuecomment-1016010915

  const stream = azureSpeechSdk.AudioOutputStream.createPullStream()
  const buf = new ArrayBuffer(1024 * 256)
  const chunks: ArrayBuffer[] = []

  const languageMap : Record<string, string> = {
    "en": "en-US",
    "jp": "ja-JP",
    "kr": "ko-KR",
    "cn": "zh-CN",
  }

  const ttsLanguage = languageMap[language] ?? "en-US"

  const prosodyStubBegin = language == "en" ? "<prosody rate=\"+20.00%\">" : ""
  const prosodyStubEnd = language == "en" ? "</prosody>" : ""

  // escape & in text
  text = text.replace(/&/g, "&amp;")

  const ssmlText = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${ttsLanguage}">
  <voice name="${speaker}">
  <mstts:express-as style="whispering">
  ${prosodyStubBegin}
  ${text}
  ${prosodyStubEnd}
  </mstts:express-as>
  </voice>
  </speak>`

  var visemeAudioOffsets: number[] = []
  var visemeIds: string[] = []

  // Subscribes to viseme received event
  synthesizer.visemeReceived = function (s, e) {
    visemeAudioOffsets.push(e.audioOffset / (1000 * 10000))
    const visemeId = azure_to_oculus[e.visemeId] ?? "STOP"
    visemeIds.push(visemeId)
    // console.log("(Viseme), Audio offset: " + e.audioOffset / 10000 + "ms. Viseme ID: " + e.visemeId);
  }

  console.log(ssmlText)

  const resultPromise = new Promise<azureSpeechSdk.SpeechSynthesisResult>(
    (resolve, reject) => {
      synthesizer.speakSsmlAsync(
        ssmlText,
        (result) => {
          resolve(result)
        },
        (e) => {
          reject(new Error(e))
        },
        stream
      )
    }
  )
  const { promise: cancelPromise, resolve } = buildPromise<number>()
  let errorString = ""
  launchBackgroundScope(scope, async (scope) => {
    const result = await resultPromise
    if (
      result.reason !== azureSpeechSdk.ResultReason.SynthesizingAudioCompleted
    ) {
      errorString = result.errorDetails
      resolve(-1)
    }
  })

  let totalLen = 0
  for (;;) {
    const len = await Promise.race([stream.read(buf), cancelPromise])
    if (len === -1) {
      throw new Error(`Azure TTS failed due to: [${errorString}]`)
    }
    chunks.push(buf.slice(0, len))
    totalLen += len
    if (len === 0) break
  }
  const result = await resultPromise
  const responseBytes = new Uint8Array(totalLen)
  let offset = 0
  for (const chunk of chunks) {
    responseBytes.set(new Uint8Array(chunk), offset)
    offset += chunk.byteLength
  }
  // encode as base64
  const responseBase64 = Buffer.from(responseBytes).toString("base64")

  return {
    data: responseBase64,
    duration: result.audioDuration / (1000 * 10000),
    visemeAudioOffsets: visemeAudioOffsets,
    visemeIds: visemeIds,
  }
}
