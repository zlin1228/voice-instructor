import {
  objectType,
  booleanType,
  stringType,
  CookType,
  arrayType,
  doubleType,
} from "base-core/lib/types.js"

export const cmClientMessageKernelType = objectType([
  {
    name: "audio",
    type: stringType,
    optional: true,
  },
  {
    name: "listening",
    type: booleanType,
    optional: true,
  }
] as const)

export type CmClientMessageKernel = CookType<typeof cmClientMessageKernelType>

export const cmServerMessageKernelType = objectType([
  {
    name: "utterance",
    type: stringType,
  },
  {
    name: "duration",
    type: doubleType,
  },
  {
    name: "audio",
    type: stringType,
  },
  {
    name: "worldId",
    type: stringType,
  },
  {
    name: "npcId",
    type: stringType,
  },
  {
    name: "visemeAudioOffsets",
    type: arrayType(doubleType),
  },
  {
    name: "visemeIds",
    type: arrayType(stringType),
  }
] as const)

export type CmServerMessageKernel = CookType<typeof cmServerMessageKernelType>
