import {
  arrayType,
  booleanType,
  CookType,
  doubleType,
  int32Type,
  mapType,
  nullableType,
  objectType,
  stringType,
  timestampType,
} from "base-core/lib/types.js"
import { CookServiceHttpSchema } from "base-core/lib/http-schema.js"

export const echoV1RequestType = objectType([
  { name: "id", type: stringType },
  { name: "audio", type: stringType },
  { name: "character", type: stringType, optional: true },
] as const)

export type EchoV1Request = CookType<typeof echoV1RequestType>

export const echoV1ResponseType = objectType([
  { name: "utterance", type: stringType },
  { name: "person", type: stringType },
  { name: "message", type: stringType },
  { name: "flagged", type: booleanType },
  { name: "audio", type: stringType },
] as const)

export type EchoV1Response = CookType<typeof echoV1ResponseType>

export const radioPopularityV1RequestType = objectType([
  { name: "keywords", type: stringType },
] as const)

export type RadioPopularityV1Request = CookType<
  typeof radioPopularityV1RequestType
>

export const radioPopularityV1ResponseType = objectType([
  { name: "exec_time_ms", type: int32Type },
  { name: "message", type: stringType },
  { name: "data", type: mapType(doubleType) },
  { name: "code", type: int32Type },
  { name: "server_time", type: doubleType },
] as const)

export type RadioPopularityV1Response = CookType<
  typeof radioPopularityV1ResponseType
>

export const radioAudioV1RequestType = objectType([
  {
    name: "subjects",
    type: nullableType(arrayType(stringType)),
    optional: true,
  },
  { name: "question", type: nullableType(stringType), optional: true },
  { name: "next_id", type: nullableType(stringType), optional: true },
] as const)

export type RadioAudioV1Request = CookType<typeof radioAudioV1RequestType>

export const radioAudioV1ResponseDataType = objectType([
  { name: "next_id", type: stringType },
  { name: "question_text", type: stringType, optional: true },
  { name: "answer_audio_url", type: stringType },
  {
    name: "answer_audio_texts",
    type: arrayType(
      objectType([
        { name: "offset_ms", type: doubleType },
        { name: "text", type: stringType },
      ] as const)
    ),
  },
] as const)

export const radioAudioV1ResponseType = objectType([
  { name: "exec_time_ms", type: int32Type },
  { name: "message", type: stringType },
  { name: "data", type: radioAudioV1ResponseDataType },
  { name: "code", type: int32Type },
  { name: "server_time", type: doubleType },
] as const)

export const quantumMockHttpServiceSchema = [
  {
    kind: "post",
    value: {
      name: "mockEchoV1",
      request: {
        kind: "json",
        value: echoV1RequestType,
      },
      response: {
        kind: "json",
        value: echoV1ResponseType,
      },
    },
  },
  {
    kind: "get",
    value: {
      name: "mockRadioPopularityV1",
      query: radioPopularityV1RequestType,
      response: {
        kind: "json",
        value: radioPopularityV1ResponseType,
      },
    },
  },
  {
    kind: "post",
    value: {
      name: "mockRadioAudioV1",
      request: {
        kind: "json",
        value: radioAudioV1RequestType,
      },
      response: {
        kind: "json",
        value: radioAudioV1ResponseType,
      },
    },
  },
  {
    kind: "post",
    value: {
      name: "mockRadioAudioV11",
      request: {
        kind: "json",
        value: radioAudioV1RequestType,
      },
      response: {
        kind: "json",
        value: radioAudioV1ResponseType,
      },
    },
  },
  {
    kind: "post",
    value: {
      name: "mockRadioAudioV12",
      request: {
        kind: "json",
        value: radioAudioV1RequestType,
      },
      response: {
        kind: "json",
        value: radioAudioV1ResponseType,
      },
    },
  },
] as const

export type QuantumMockHttpService = CookServiceHttpSchema<
  typeof quantumMockHttpServiceSchema
>
