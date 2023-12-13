import { CookServiceHttpSchema } from "base-core/lib/http-schema.js"
import {
  CookType,
  arrayType,
  emptyObjectType,
  objectType,
  stringType,
} from "base-core/lib/types.js"

export const testRequestType = objectType([
  { name: "requestData", type: stringType },
])

export type TestRequest = CookType<typeof testRequestType>

export const testResponseType = objectType([
  { name: "responseData", type: stringType },
])

export type TestResponse = CookType<typeof testResponseType>

export const rabbitCompanionHttpServiceSchema = [
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

export type RabbitCompanionHttpService = CookServiceHttpSchema<
  typeof rabbitCompanionHttpServiceSchema
>
