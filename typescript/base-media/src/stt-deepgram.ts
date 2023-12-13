import { Readable } from "node:stream"

import DeepgramSdk from "@deepgram/sdk"

import { log } from "base-core/lib/logging.js"
import {
  Scope,
  SignalController,
  checkAndGetCancelToken,
  forceAbandonWhenCancel,
} from "base-core/lib/scope.js"
import { buildAsyncGenerator } from "base-core/lib/processing.js"
import {
  arrayType,
  booleanType,
  doubleType,
  objectType,
  stringType,
} from "base-core/lib/types.js"
import { commonNormalizer } from "base-core/lib/types-common.js"
import { throwError } from "base-core/lib/exception.js"

import { SttClient, SttOptions, SttRecognizedFragment } from "./stt.js"
import { flyingPromise } from "base-core/lib/utils.js"

// [Deepgram] Live Streaming Audio Transcription:
// https://developers.deepgram.com/docs/node-sdk-streaming-transcription
//
// [Deepgram] Streaming API reference:
// https://developers.deepgram.com/reference/streaming
//
// [Deepgram] Measuring Streaming Latency
// https://developers.deepgram.com/docs/measuring-streaming-latency

const deepgramApiWordType = objectType([
  { name: "word", type: stringType },
  { name: "start", type: doubleType },
  { name: "end", type: doubleType },
  { name: "confidence", type: doubleType },
  { name: "punctuated_word", type: stringType },
] as const)

const deepgramApiAlternativeType = objectType([
  { name: "transcript", type: stringType },
  { name: "confidence", type: doubleType },
  { name: "words", type: arrayType(deepgramApiWordType) },
] as const)

const deepgramApiStreamTranscriptionType = objectType([
  { name: "duration", type: doubleType },
  { name: "start", type: doubleType, optional: true },
  { name: "is_final", type: booleanType, optional: true },
  { name: "speech_final", type: booleanType, optional: true },
  {
    name: "channel",
    type: objectType([
      { name: "alternatives", type: arrayType(deepgramApiAlternativeType) },
    ] as const),
    optional: true,
  },
] as const)

const deepgramApiRecordedTranscriptionType = objectType([
  {
    name: "results",
    type: objectType([
      {
        name: "channels",
        type: arrayType(
          objectType([
            {
              name: "alternatives",
              type: arrayType(deepgramApiAlternativeType),
            },
          ] as const)
        ),
      },
    ] as const),
  },
] as const)

export const modelNova = "nova"

export class DeepgramSttClient implements SttClient {
  readonly #deepgram: DeepgramSdk.Deepgram
  constructor(deepgram: DeepgramSdk.Deepgram) {
    this.#deepgram = deepgram
  }
  static async build(scope: Scope, apiKey: string): Promise<DeepgramSttClient> {
    const deepgram = new DeepgramSdk.Deepgram(apiKey)
    return new DeepgramSttClient(deepgram)
  }

  recognizeStream(
    scope: Scope,
    bytesIter: AsyncIterable<Uint8Array>,
    options: SttOptions
  ): AsyncIterable<SttRecognizedFragment> {
    return buildAsyncGenerator(async (push) => {
      const cancelToken = checkAndGetCancelToken(scope)
      const deepgramLive = this.#deepgram.transcription.live({
        smart_format: true,
        interim_results: true,
        language: options.language,
        model: options.model,
        ...(options.mimeType !== "auto" && { encoding: options.mimeType }),
      })
      const openSignal = new SignalController<void>()
      deepgramLive.on("open", () => {
        log.info("Deepgram Open")
        openSignal.emit()
      })
      const closeSignal = new SignalController<void>()
      deepgramLive.on("close", () => {
        log.info("Deepgram Close")
        closeSignal.emit()
      })
      deepgramLive.on("error", (e) => {
        log.info(`Deepgram Error: ${String(e)}`)
        console.log(e)
      })
      deepgramLive.on("transcriptReceived", (transcriptionRaw: unknown) => {
        log.info(`Deepgram transcriptReceived`)
        flyingPromise(async () => {
          try {
            const transcription = commonNormalizer(
              deepgramApiStreamTranscriptionType,
              transcriptionRaw
            )
            const alternative = transcription.channel?.alternatives[0]
            if (
              transcription.is_final === undefined ||
              alternative === undefined
            ) {
              return
            }
            await push({
              transcript: alternative.transcript,
              final: transcription.is_final,
              stability: alternative.confidence,
            })
          } catch (e) {
            log.info(`Deepgram transcriptReceived handling error: ${String(e)}`)
            console.log(e)
          }
        })
      })
      try {
        await openSignal.waitUntilReady(scope)
        for await (const bytes of bytesIter) {
          if (cancelToken.cancelReason !== undefined) {
            break
          }
          deepgramLive.send(bytes)
        }
      } finally {
        deepgramLive.finish()
      }
      await closeSignal.waitUntilReady(scope)
    })
  }

  async recognizeRecorded(
    scope: Scope,
    bytesIter: AsyncIterable<Uint8Array>,
    options: SttOptions
  ): Promise<string> {
    return await forceAbandonWhenCancel(scope, async () => {
      const resp = await this.#deepgram.transcription.preRecorded(
        {
          stream: Readable.from(bytesIter),
          mimetype: options.mimeType,
        },
        {
          smart_format: true,
          model: options.model,
          language: options.language,
        }
      )
      const transcription = commonNormalizer(
        deepgramApiRecordedTranscriptionType,
        resp
      )
      return (
        transcription.results.channels[0]?.alternatives[0]?.transcript ??
        throwError("Invalid response from Deepgram")
      )
    })
  }
}
