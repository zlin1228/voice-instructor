import { CookServiceHttpSchema } from "base-core/lib/http-schema.js"
import {
  CookType,
  arrayType,
  booleanType,
  emptyObjectType,
  objectType,
  stringType,
} from "base-core/lib/types.js"
import {
  webActionRequestType,
  webActionResponseType,
} from "../action/web-action.js"
import { presetStepType } from "../preset/preset.js"
import { bunnyArgumentType } from "cm-bunny-host-common/lib/bunny/bunny.js"

export const presetStepRequestType = objectType([
  { name: "presetStep", type: presetStepType },
  { name: "argumentList", type: arrayType(bunnyArgumentType) },
])

export type PresetStepRequest = CookType<typeof presetStepRequestType>

export const presetStepResponseType = objectType([
  { name: "report", type: stringType, optional: true },
])

export type PresetStepResponse = CookType<typeof presetStepResponseType>

export const bunnyHostWebHttpServiceSchema = [
  {
    kind: "get",
    value: {
      name: "healthz",
      query: emptyObjectType,
      response: {
        kind: "json",
        value: emptyObjectType,
      },
    },
  },
  {
    kind: "post",
    value: {
      name: "webAction",
      request: {
        kind: "json",
        value: webActionRequestType,
      },
      response: {
        kind: "json",
        value: webActionResponseType,
      },
    },
  },
  {
    kind: "post",
    value: {
      name: "presetStep",
      request: {
        kind: "json",
        value: presetStepRequestType,
      },
      response: {
        kind: "json",
        value: presetStepResponseType,
      },
    },
  },
] as const

export type BunnyHostWebHttpService = CookServiceHttpSchema<
  typeof bunnyHostWebHttpServiceSchema
>
