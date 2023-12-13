// API reference: https://googleapis.dev/nodejs/speech/latest/

import fsPromises from "node:fs/promises"
import path from "node:path"
import { pipeline } from "node:stream/promises"

import speech, { SpeechClient } from "@google-cloud/speech"
import { google } from "@google-cloud/speech/build/protos/protos"
import Pumpify from "pumpify"
import { log } from "base-core/lib/logging.js"
import { forcedTimeout } from "base-core/lib/debug.js"
import {
  arrayType,
  booleanType,
  doubleType,
  objectType,
  stringType,
} from "base-core/lib/types.js"
import { commonNormalizer } from "base-core/lib/types-common.js"
import {
  Scope,
  checkAndGetCancelToken,
  forceAbandonWhenCancel,
} from "base-core/lib/scope.js"
import { isNotUndefined } from "base-core/lib/utils.js"
import { stringRandomSimpleName } from "base-core/lib/string.js"
import { deleteGcsFile, uploadGcsBytesIterFile } from "base-gcp/lib/gcs.js"

import {
  SttRecognizedFragment,
  mimeTypeLinear16Rate44100,
  mimeTypeLinear16Rate16000,
  SttOptions,
  SttClient,
  mimeTypeWebmOpusRate16000,
} from "./stt.js"

export const modelDefault = "default"
export const modelLatestLong = "latest_long"
export const modelLatestShort = "latest_short"

export interface GoogleSttClientOptions {
  readonly gcsPrefixForTemporary?: string
}

export class GoogleSttClient implements SttClient {
  readonly #options: GoogleSttClientOptions
  readonly #speechClient: SpeechClient

  constructor(options: GoogleSttClientOptions, speechClient: SpeechClient) {
    this.#options = options
    this.#speechClient = speechClient
  }

  static async build(
    scope: Scope,
    options: GoogleSttClientOptions
  ): Promise<GoogleSttClient> {
    const speechClient = new speech.SpeechClient()
    await speechClient.initialize()
    scope.onLeave(async () => {
      await speechClient.close()
    })
    return new GoogleSttClient(options, speechClient)
  }

  // async recognizeShort(
  //   scope: Scope,
  //   uri: string,
  //   config: google.cloud.speech.v1.IRecognitionConfig
  // ): Promise<google.cloud.speech.v1.ISpeechRecognitionAlternative[]> {
  //   const request: google.cloud.speech.v1.IRecognizeRequest = {
  //     audio: {
  //       uri,
  //     },
  //     config: config,
  //   }
  //   const [response] = await forceAbandonWhenCancel(scope, () =>
  //     this.#speechClient.recognize(request)
  //   )
  //   return (response.results ?? [])
  //     .map((result) => {
  //       return result.alternatives?.[0]
  //     })
  //     .filter(isNotUndefined)
  // }

  static #buildEncoding(
    mimeType: string
  ): keyof typeof google.cloud.speech.v1.RecognitionConfig.AudioEncoding {
    if (
      mimeType === mimeTypeLinear16Rate44100 ||
      mimeType === mimeTypeLinear16Rate16000
    ) {
      return "LINEAR16"
    } else if (mimeType === mimeTypeWebmOpusRate16000) {
      return "WEBM_OPUS"
    }
    throw new Error(`Cannot infer encoding from MIME type: ${mimeType}`)
  }

  static #buildSampleRateHertz(mimeType: string): number {
    if (mimeType === mimeTypeLinear16Rate44100) {
      return 44100
    } else if (mimeType === mimeTypeLinear16Rate16000) {
      return 16000
    } else if (mimeType === mimeTypeWebmOpusRate16000) {
      return 16000
    }
    throw new Error(`Cannot infer sample rate from MIME type: ${mimeType}`)
  }

  async recognizeRecorded(
    scope: Scope,
    bytesIter: AsyncIterable<Uint8Array>,
    config: SttOptions
  ): Promise<string> {
    return await Scope.with(scope, [], async (scope) => {
      if (this.#options.gcsPrefixForTemporary === undefined) {
        throw new Error(
          "Cannot use recognizeRecorded() without gcsPrefixForTemporary"
        )
      }
      const cancelToken = checkAndGetCancelToken(scope)

      const fileName = stringRandomSimpleName(8)
      const gcsPath = `${this.#options.gcsPrefixForTemporary}/${fileName}`
      await uploadGcsBytesIterFile(scope, bytesIter, gcsPath)
      scope.onLeave(async () => {
        await deleteGcsFile(scope, gcsPath)
      })
      const request: google.cloud.speech.v1.IRecognizeRequest = {
        audio: {
          uri: gcsPath,
        },
        config: {
          encoding: GoogleSttClient.#buildEncoding(config.mimeType),
          sampleRateHertz: GoogleSttClient.#buildSampleRateHertz(
            config.mimeType
          ),
          languageCode: config.language,
          model: config.model,
          enableAutomaticPunctuation: true,
          maxAlternatives: 1,
        },
      }
      const [operation] = await forceAbandonWhenCancel(scope, () =>
        this.#speechClient.longRunningRecognize(request)
      )
      cancelToken.onCancel(async () => {
        void operation.cancel()
      })
      const [response] = await operation.promise()
      return (response.results ?? [])
        .map((result) => {
          return result.alternatives?.[0]?.transcript
        })
        .filter(isNotUndefined)
        .join("")
    })
  }

  recognizeStream(
    scope: Scope,
    bytesIter: AsyncIterable<Uint8Array>,
    options: SttOptions
  ): AsyncIterable<SttRecognizedFragment> {
    throw new Error("Not implemented")
  }
}
