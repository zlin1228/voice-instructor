import {
  objectType,
  stringType,
  CookType,
  booleanType,
} from "base-core/lib/types.js"
import * as cldrSegmentation from 'cldr-segmentation'

export const chatMessageType = objectType([
  { name: "role", type: stringType },
  {
    name: "function_call", type: objectType([
      { name: "name", type: stringType },
      { name: "arguments", type: stringType },
    ] as const), optional: true
  },
  { name: "content", type: stringType, optional: true },
  { name: "name", type: stringType, optional: true },
] as const)

export type ChatMessage = CookType<typeof chatMessageType>

export const chatFragmentType = objectType([
  { name: "fragment", type: stringType, optional: true },
  { name: "claude2ExpertAccumulator", type: stringType, optional: true },
  { name: "truncated", type: booleanType, optional: true },
] as const)

export type ChatFragment = CookType<typeof chatFragmentType>

export const supp = cldrSegmentation.suppressions.en;

export type utteranceAccumulator = {
  fragment: string,
  fragmentLookAhead: string,
  expertAccumulator?: string,
}

// TODO(Peiyuan): Probably need actual sentence segmentation here, like SpaCy.
export async function* chatFragmentIterToChatPieceIter(
  chatFragmentIter: AsyncGenerator<ChatFragment>
): AsyncGenerator<utteranceAccumulator> {
  let buf = ""
  let segments : string[] = []
  let lastSegmentLength = 0
  let accumulatedFragment = ""
  let firstFragmentYielded = false
  let expertAccumulator = ""
  for await (const chatFragment of chatFragmentIter) {
    buf += chatFragment.fragment
    accumulatedFragment += chatFragment.fragment
    segments = cldrSegmentation.sentenceSplit(buf, supp);
    if (segments.length > 1 && !firstFragmentYielded) {
      if (segments.length > lastSegmentLength && segments[0] != undefined) {
        // pop the first segment
        const sentenceFragment : string = segments[0]
        segments = segments.slice(1)
        // make the buffer the rest of the segments
        buf = segments.join("")
        lastSegmentLength = segments.length
        // yield the first segment
        if (!firstFragmentYielded) {
          firstFragmentYielded = true
          yield {
            fragment: sentenceFragment,
            fragmentLookAhead: accumulatedFragment,
            expertAccumulator: chatFragment.claude2ExpertAccumulator ?? "",
          }
        }
      }
    }
    if (chatFragment.truncated) {
      console.log("!!! OpenAI returned truncated text !!!")
      // throw new Error("Truncated")
    }
    expertAccumulator = chatFragment.claude2ExpertAccumulator ?? ""
  }
  // yield the remaining segments
  for (const segment of segments) {
    yield {
      fragment: segment,
      fragmentLookAhead: accumulatedFragment,
      expertAccumulator: expertAccumulator,
    }
  }
}
