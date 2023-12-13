import { Scope } from "base-core/lib/scope.js"
import {
  objectType,
  stringType,
  booleanType,
  doubleType,
  CookType,
} from "base-core/lib/types.js"

export const sttRecognizedFragmentType = objectType([
  { name: "transcript", type: stringType },
  { name: "final", type: booleanType },
  { name: "stability", type: doubleType },
] as const)

export type SttRecognizedFragment = CookType<typeof sttRecognizedFragmentType>

export const mimeTypeAuto = "auto"
export const mimeTypeLinear16Rate44100 = "audio/L16;rate=44100"
export const mimeTypeLinear16Rate16000 = "audio/L16;rate=16000"
export const mimeTypeWebmOpusRate16000 = "audio/webm;codecs=opus;rate=16000"

export const languageUs = "en-US"
export const languageJp = "ja-JP"
export const languageKorean = "ko-KR"
export const languageChinese = "cmn-Hans-CN"

export interface SttOptions {
  mimeType: string
  language: string // BCP-47 language tag, see https://www.techonthenet.com/js/language_tags.php
  model: string
}

export interface SttClient {
  recognizeStream(
    this: SttClient,
    scope: Scope,
    bytesIter: AsyncIterable<Uint8Array>,
    options: SttOptions
  ): AsyncIterable<SttRecognizedFragment>

  recognizeRecorded(
    this: SttClient,
    scope: Scope,
    bytesIter: AsyncIterable<Uint8Array>,
    options: SttOptions
  ): Promise<string>
}
