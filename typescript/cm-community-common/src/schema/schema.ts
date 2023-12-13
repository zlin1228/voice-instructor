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

export const testRequestType = objectType([
  { name: "token", type: stringType },
] as const)

export type TestRequest = CookType<typeof testRequestType>

export const testResponseType = objectType([
  { name: "what", type: stringType },
] as const)

export type TestResponse = CookType<typeof testResponseType>

export const communityHttpServiceSchema = [
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

export type CommunityHttpService = CookServiceHttpSchema<
  typeof communityHttpServiceSchema
>

export const characterBackgroundType = objectType([] as const)
