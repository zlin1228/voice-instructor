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
  os2ClientMessageGlobalType,
  os2ServerMessageGlobalType,
} from "../session/session-global.js"
import {
  os2ClientMessageSpotifyType,
  os2ServerMessageSpotifyType,
} from "../session/session-spotify.js"
import {
  os2ClientMessageKernelType,
  os2ServerMessageKernelType,
} from "../session/session-kernel.js"

export const testRequestType = objectType([
  { name: "token", type: stringType },
] as const)

export type TestRequest = CookType<typeof testRequestType>

export const testResponseType = objectType([
  { name: "what", type: stringType },
] as const)

export type TestResponse = CookType<typeof testResponseType>

export const os2HttpServiceSchema = [
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

export type Os2HttpService = CookServiceHttpSchema<typeof os2HttpServiceSchema>

export const os2ClientMessageType = objectType([
  {
    name: "global",
    type: os2ClientMessageGlobalType,
    optional: true,
  },
  {
    name: "kernel",
    type: os2ClientMessageKernelType,
    optional: true,
  },
  {
    name: "spotify",
    type: os2ClientMessageSpotifyType,
    optional: true,
  },
] as const)

export type Os2ClientMessage = CookType<typeof os2ClientMessageType>

export const os2ServerMessageType = objectType([
  {
    name: "global",
    type: os2ServerMessageGlobalType,
    optional: true,
  },
  {
    name: "kernel",
    type: os2ServerMessageKernelType,
    optional: true,
  },
  {
    name: "spotify",
    type: os2ServerMessageSpotifyType,
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

export type Os2ServerMessage = CookType<typeof os2ServerMessageType>

export const metaRequestType = objectType([] as const)

export type MetaRequest = CookType<typeof metaRequestType>

export const metaResponseType = objectType([
  { name: "clientIp", type: stringType, optional: true },
  { name: "serviceUp", type: booleanType },
  { name: "currentTime", type: timestampType },
] as const)

export type MetaResponse = CookType<typeof metaResponseType>

export const os2MetaHttpServiceSchema = [
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

export type Os2MetaHttpService = CookServiceHttpSchema<
  typeof os2MetaHttpServiceSchema
>

export const metaConfigType = objectType([
  { name: "serviceUp", type: booleanType },
] as const)

export type MetaConfig = CookType<typeof metaConfigType>
