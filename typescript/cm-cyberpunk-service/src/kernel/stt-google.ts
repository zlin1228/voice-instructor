// API reference: https://googleapis.dev/nodejs/speech/latest/
import { pipeline } from "node:stream/promises"

import speech from "@google-cloud/speech"
import Pumpify from "pumpify"
import { log } from "base-core/lib/logging.js"
import {
  arrayType,
  booleanType,
  doubleType,
  objectType,
  stringType,
} from "base-core/lib/types.js"
import { commonNormalizer } from "base-core/lib/types-common.js"
import { Scope } from "base-core/lib/scope.js"

import { SttRecognizedFragment } from "./stt.js"

const googleSpeechStreamingRecognizeResponseType = objectType([
  {
    name: "results",
    type: arrayType(
      objectType([
        {
          name: "alternatives",
          type: arrayType(
            objectType([{ name: "transcript", type: stringType }, { name: "confidence", type: doubleType, optional: true },
            ] as const)
          ),
        },
        { name: "isFinal", type: booleanType },
        { name: "stability", type: doubleType },
      ] as const)
    ),
  },
] as const)

export function googleSpeechStream(language: string, mimeType: string):
  Pumpify {

  const speechClient = new speech.SpeechClient()

  const languageMapping: Record<string, string> = {
    "en": "en-US",
    "jp": "ja-JP",
    "kr": "ko-KR",
    "cn": "cmn-Hans-CN",
  }

  const modelMapping: Record<string, string> = {
    "en": "latest_long",
    "jp": "latest_long",
    "kr": "latest_long",
    "cn": "default",
  }

  const encodingMapping: Record<string, "ENCODING_UNSPECIFIED" | "LINEAR16" | "FLAC" | "MULAW" | "AMR" | "AMR_WB" | "OGG_OPUS" | "SPEEX_WITH_HEADER_BYTE" | "WEBM_OPUS" | "MP3"> = {
    "wav": "LINEAR16",
    "opus": "WEBM_OPUS",
  }

  var encoding = encodingMapping[mimeType] as "ENCODING_UNSPECIFIED" | "LINEAR16" | "FLAC" | "MULAW" | "AMR" | "AMR_WB" | "OGG_OPUS" | "SPEEX_WITH_HEADER_BYTE" | "WEBM_OPUS" | "MP3" | undefined
  var languageCode = languageMapping[language] as "en-US" | "ja-JP" | "ko-KR" | "cmn-Hans-CN" | undefined
  var modelChoice = modelMapping[language] as "latest_long" | "latest_short" | "default" | undefined

  if (encoding === undefined) {
    log.info(`Unknown mimeType: ${mimeType}`);
    encoding = "LINEAR16";
  }
  if (languageCode === undefined) {
    log.info(`Unknown language: ${language}`);
    languageCode = "en-US";
  }
  if (modelChoice === undefined) {
    log.info(`Unknown model`);
    modelChoice = "default";
  }


  const recognizeStream = speechClient.streamingRecognize({
    config: {
      encoding: "LINEAR16",
      sampleRateHertz: 16000,
      languageCode: languageCode,
      model: "latest_long",
      enableAutomaticPunctuation: true,
      maxAlternatives: 1,
      //alternativeLanguageCodes: ["cmn-Hans-CN", "fr-FR"],
    },
    interimResults: true,
  });
  return recognizeStream;
}

export async function* googleSpeechStreamIterateResult(recognizeStream: Pumpify
): AsyncIterable<SttRecognizedFragment> {
  for await (const data of recognizeStream) {
    const resp = commonNormalizer(
      googleSpeechStreamingRecognizeResponseType,
      data
    )
    const result = resp.results[0]
    if (result === undefined) {
      continue
    }
    const transcript = result.alternatives[0]?.transcript
    const confidence = result.alternatives[0]?.confidence
    if (transcript !== undefined) {
      yield {
        text: transcript,
        final: result.isFinal,
        stability: result.stability,
        confidence: confidence,
      }
    }
  }
}

export async function* googleSpeechStreamingRecognize(
  scope: Scope,
  bytesIter: AsyncIterable<Uint8Array>
): AsyncIterable<SttRecognizedFragment> {
  const speechClient = new speech.SpeechClient()
  const recognizeStream = speechClient.streamingRecognize({
    config: {
      encoding: "WEBM_OPUS",
      // encoding: "LINEAR16",
      sampleRateHertz: 16000,
      languageCode: "en-US",
      model: "latest_short",
      enableAutomaticPunctuation: true,
      maxAlternatives: 1,
    },
    interimResults: true,
  })
  const pipelinePromise = pipeline(bytesIter, recognizeStream)
  try {
    for await (const data of recognizeStream) {
      const resp = commonNormalizer(
        googleSpeechStreamingRecognizeResponseType,
        data
      )
      const result = resp.results[0]
      if (result === undefined) {
        continue
      }
      const transcript = result.alternatives[0]?.transcript
      if (transcript !== undefined) {
        yield {
          text: transcript,
          final: result.isFinal,
          stability: result.stability,
        }
      }
    }
  } finally {
    try {
      await pipelinePromise
    } catch (e) {
      log.info(`Encounter pipeline error: ${String(e)}`)
    }
  }
}
