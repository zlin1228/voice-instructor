import {
  objectType,
  stringType,
  booleanType,
  doubleType,
  CookType,
} from "base-core/lib/types.js"

export const sttRecognizedFragmentType = objectType([
  { name: "text", type: stringType },
  { name: "final", type: booleanType },
  { name: "stability", type: doubleType },
  { name: "confidence", type: doubleType, optional: true },
] as const)

export type SttRecognizedFragment = CookType<typeof sttRecognizedFragmentType>
