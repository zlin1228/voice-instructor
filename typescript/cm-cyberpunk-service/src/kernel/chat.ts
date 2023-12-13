import {
  objectType,
  stringType,
  CookType,
  booleanType,
} from "base-core/lib/types.js"

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
  { name: "truncated", type: booleanType, optional: true },
] as const)

export type ChatFragment = CookType<typeof chatFragmentType>

export async function* chatFragmentIterToChatPieceIter(
  chatFragmentIter: AsyncGenerator<ChatFragment>
): AsyncGenerator<string> {
  let buf = ""
  for await (const chatFragment of chatFragmentIter) {
    buf += chatFragment.fragment
    for (; ;) {
      const idx = buf.search(/(?<=[,.?!。，])/)
      if (idx === -1) break
      const piece = buf.substring(0, idx).trim()
      if (piece !== "") {
        yield piece
      }
      buf = buf.substring(idx)
    }
    if (chatFragment.truncated) {
      console.log("!!! OpenAI returned truncated text !!!")
      // throw new Error("Truncated")
    }
  }
  const piece = buf.trim()
  if (piece !== "") {
    yield piece
  }
}
