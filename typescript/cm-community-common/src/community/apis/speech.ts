import {
  CookType,
  objectType,
  stringType,
  timestampType,
} from "base-core/lib/types.js"

export const speechInputType = objectType([
  { name: "worldId", type: stringType },
  { name: "playerId", type: stringType },

  // When the content was recognized.
  { name: "time", type: timestampType },

  // The content of the speech.
  { name: "content", type: stringType },
] as const)

export type SpeechInput = CookType<typeof speechInputType>

export const speechProfileType = objectType([
  { name: "worldId", type: stringType },
  { name: "npcId", type: stringType },
  { name: "provider", type: stringType },
  { name: "voiceId", type: stringType },
  { name: "worldId", type: stringType },
  { name: "npcId", type: stringType },
])

export type SpeechProfile = CookType<typeof speechProfileType>

export const speechOutputType = objectType([
  // An opaque fixed string from the application.
  { name: "key", type: stringType },

  // How the speech should be generated.
  { name: "speechProfile", type: speechProfileType },

  // When the content was produced.
  { name: "time", type: timestampType },

  // The content of the speech.
  { name: "content", type: stringType },
] as const)

export type SpeechOutput = CookType<typeof speechOutputType>
