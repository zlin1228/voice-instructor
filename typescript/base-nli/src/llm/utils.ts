import { arrayConcat } from "base-core/lib/array.js"
import { catchErrorSync } from "base-core/lib/one-of.js"
import { stringExtractByBound } from "base-core/lib/string.js"
import { Type } from "base-core/lib/types.js"
import {
  CommonClosure,
  typeToTypeScriptDefinition,
  commonNormalizer,
  Normalizer,
  arrayFromJsonNormalizerBuilder,
  arrayFromNullNormalizerBuilder,
  arrayFromObjectNormalizerBuilder,
  arrayNormalizerBuilder,
  binaryFromBase64NormalizerBuilder,
  binaryNormalizerBuilder,
  booleanFromStringNormalizerBuilder,
  booleanNormalizerBuilder,
  buildNormalizer,
  doubleFromStringNormalizerBuilder,
  doubleNormalizerBuilder,
  int32FromStringNormalizerBuilder,
  int32NormalizerBuilder,
  mapNormalizerBuilder,
  nullableNormalizerBuilder,
  objectFromJsonNormalizerBuilder,
  objectNormalizerBuilder,
  stringFromNumberNormalizerBuilder,
  stringFromStringArrayNormalizerBuilder,
  stringNormalizerBuilder,
  timestampFromNumberNormalizerBuilder,
  timestampFromStringNormalizerBuilder,
  timestampNormalizerBuilder,
  unionNormalizerBuilder,
} from "base-core/lib/types-common.js"
import { forceGetProperty, isNotUndefined } from "base-core/lib/utils.js"
import { abortIfUndefined } from "base-core/lib/debug.js"
import { log } from "base-core/lib/logging.js"

export const jsonNormalizer: Normalizer<CommonClosure> = buildNormalizer([
  stringNormalizerBuilder(),
  doubleNormalizerBuilder(),
  int32NormalizerBuilder(),
  booleanNormalizerBuilder(),
  timestampNormalizerBuilder(),
  objectNormalizerBuilder({ extraObjectProperties: "strip" }),
  binaryNormalizerBuilder(),
  mapNormalizerBuilder(),
  arrayNormalizerBuilder(),
  nullableNormalizerBuilder(),
  unionNormalizerBuilder(),

  stringFromStringArrayNormalizerBuilder(),
  stringFromNumberNormalizerBuilder(),
  doubleFromStringNormalizerBuilder(),
  int32FromStringNormalizerBuilder(),
  booleanFromStringNormalizerBuilder(),
  timestampFromNumberNormalizerBuilder(),
  timestampFromStringNormalizerBuilder(),
  binaryFromBase64NormalizerBuilder(),
  arrayFromObjectNormalizerBuilder(),
  arrayFromJsonNormalizerBuilder(),
  objectFromJsonNormalizerBuilder(),
])

export function renderCodeBlock(langauge: string, code: string): string {
  return `\`\`\`${langauge}\n${code}\n\`\`\``
}

export function renderTypeDefinition<T>(type: Type<CommonClosure, T>): string {
  return renderCodeBlock("typescript", typeToTypeScriptDefinition(type))
}

export function renderValueAsJsonCodeBlock<T>(
  type: Type<CommonClosure, T>,
  value: T
): string {
  return renderCodeBlock("json", JSON.stringify(jsonNormalizer(type, value)))
}

export function renderTextLines(texts: string[]): string {
  return texts.join("\n")
}

export function renderTextList(texts: string[]): string {
  return renderTextLines(texts.map((text) => ` - ${text}`))
}

export function extractJsonBlocks(content: string): string[] {
  let s = content.replace(/\\\n\s*/m, "").replace(/},?\n{/m, "}\n\n{")
  return [
    s,
    ...stringExtractByBound(s, "```json", "```"),
    ...stringExtractByBound(s, "``` json", "```"),
    ...stringExtractByBound(s, "```md", "```"),
    ...stringExtractByBound(s, "```typescript", "```"),
    ...stringExtractByBound(s, "\n{\n", "\n}").map((s) => `{ ${s} }`),
    ...[...s.matchAll(/(?<=^\s*){.*}(?=\s*$)/g)].map((r) => r[0]),
  ]
}

export function extractTypedResponses<Resp>(
  responseType: Type<CommonClosure, Resp>,
  content: string
): Resp[] {
  const jsonBlocks = extractJsonBlocks(content)
  return arrayConcat(
    jsonBlocks.map((jsonBlock) => {
      const jsonObject = catchErrorSync(Error, () => JSON.parse(jsonBlock))
      if (jsonObject.kind === "error") return []
      const respOrError = catchErrorSync(Error, () =>
        jsonNormalizer(responseType, jsonObject.value)
      )
      if (respOrError.kind === "value") return [respOrError.value]
      const keys = Object.keys(jsonObject.value)
      if (keys.length === 1) {
        const key = abortIfUndefined(keys[0])
        const respOrError = catchErrorSync(Error, () =>
          jsonNormalizer(responseType, forceGetProperty(jsonObject.value, key))
        )
        if (respOrError.kind === "value") return [respOrError.value]
      }
      log.info("extractTypedResponse")
      console.log(respOrError.value)
      return []
    })
  )
}
