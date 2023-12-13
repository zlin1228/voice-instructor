import {
  CookType,
  ObjectType,
  doubleType,
  binaryType,
  emptyObjectType,
  int32Type,
  objectType,
  stringType,
  timestampType,
  booleanType,
  arrayType,
} from "base-core/lib/types.js"
import { CookServiceHttpSchema } from "base-core/lib/http-schema.js"
import {
  cmClientMessageGlobalType,
  cmServerMessageGlobalType,
} from "../session/session-global.js"
import {
  cmClientMessageKernelType,
  cmServerMessageKernelType,
} from "../session/session-kernel.js"

export const testRequestType = objectType([
  { name: "token", type: stringType },
] as const)

export type TestRequest = CookType<typeof testRequestType>

export const testResponseType = objectType([
  { name: "what", type: stringType },
] as const)

export type TestResponse = CookType<typeof testResponseType>

export const cmHttpServiceSchema = [
  {
    kind: "post",
    value: {
      name: "test",
      request: {
        kind: "json",
        value: testRequestType,
      },
      response: {
        kind: "json",
        value: testResponseType,
      },
    },
  },
] as const

export type CmHttpService = CookServiceHttpSchema<typeof cmHttpServiceSchema>

export const cmClientMessageType = objectType([
  {
    name: "global",
    type: cmClientMessageGlobalType,
    optional: true,
  },
  {
    name: "kernel",
    type: cmClientMessageKernelType,
    optional: true,
  },
] as const)

export type CmClientMessage = CookType<typeof cmClientMessageType>

export const cmServerMessageType = objectType([
  {
    name: "global",
    type: cmServerMessageGlobalType,
    optional: true,
  },
  {
    name: "kernel",
    type: cmServerMessageKernelType,
    optional: true,
  },
  {
    name: "speechRecognizing",
    type: objectType([
      { name: "speechId", type: int32Type },
      { name: "recognizationId", type: int32Type },
      { name: "text", type: stringType },
    ] as const),
    optional: true,
  },
  {
    name: "speechRecognized",
    type: objectType([
      { name: "speechId", type: int32Type },
      { name: "recognizationId", type: int32Type },
      { name: "text", type: stringType },
    ] as const),
    optional: true,
  },
  {
    name: "latencyProfile",
    type: objectType([
      { name: "speechId", type: int32Type },
      { name: "requestText", type: stringType },
      { name: "interimRecognizedText", type: stringType }, // last time stt recognized the text but not finalized yet
      { name: "interimRecognizedTimeOffset", type: doubleType }, // when stt recognized the correct text but not finalized yet
      { name: "recognizedTime", type: timestampType }, // when stt recognized the correct text and finalized
      { name: "chatFragmentTimeOffset", type: doubleType }, // when the first chat token generated
      { name: "chatPieceTimeOffset", type: doubleType }, // when the first chat piece which can be converted to speech generated
      { name: "audioChunkTimeOffset", type: doubleType }, // when the first chunk of audio being generated
      { name: "audioResponseTimeOffset", type: doubleType }, // when the first audio response being generated
    ] as const),
    optional: true,
  },
] as const)

export type CmServerMessage = CookType<typeof cmServerMessageType>

export const metaRequestType = objectType([] as const)

export type MetaRequest = CookType<typeof metaRequestType>

export const metaResponseType = objectType([
  { name: "clientIp", type: stringType, optional: true },
  { name: "serviceUp", type: booleanType },
  { name: "currentTime", type: timestampType },
] as const)

export type MetaResponse = CookType<typeof metaResponseType>

export const cmMetaHttpServiceSchema = [
  {
    kind: "get",
    value: {
      name: "meta",
      query: metaRequestType,
      response: {
        kind: "json",
        value: metaResponseType,
      },
    },
  },
] as const

export type CmMetaHttpService = CookServiceHttpSchema<
  typeof cmMetaHttpServiceSchema
>

export const metaConfigType = objectType([
  { name: "serviceUp", type: booleanType },
] as const)

export type MetaConfig = CookType<typeof metaConfigType>
