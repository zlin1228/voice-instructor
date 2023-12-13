import { Scope } from "base-core/lib/scope.js"
import {
  CookType,
  arrayType,
  booleanType,
  doubleType,
  int32Type,
  objectType,
  stringType,
} from "base-core/lib/types.js"

export const embeddingRequestType = objectType([
  {
    name: "input",
    type: arrayType(stringType),
  },
  {
    name: "userId",
    type: stringType,
    optional: true,
  },
  {
    // additional text for debugging
    name: "debugText",
    type: stringType,
    optional: true,
  },
] as const)

export type embeddingRequest = CookType<typeof embeddingRequestType>

export const embeddingResponseType = objectType([
  {
    name: "embeddings",
    type: arrayType(objectType([{ name: "embedding", type: arrayType(doubleType) }, {name: "index", type: int32Type}] as const)),
  }
] as const)

export type embeddingResponse = CookType<typeof embeddingResponseType>

export interface EmbeddingClient {
  embed(scope: Scope, request: embeddingRequest): Promise<embeddingResponse>
}

export const embeddingLogType = objectType([
  { name: "request", type: embeddingRequestType },
  { name: "date", type: stringType },
  { name: "elapsedSeconds", type: doubleType },
  {
    name: "responseComplete",
    type: embeddingResponseType,
    optional: true,
  },
  { name: "responseError", type: stringType, optional: true },
] as const)

export type embeddingLog = CookType<typeof embeddingLogType>
