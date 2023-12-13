import {
  objectType,
  booleanType,
  stringType,
  CookType,
  arrayType,
} from "base-core/lib/types.js"

export const os2ClientMessageKernelUserTextType = objectType([
  { name: "text", type: stringType },
] as const)

export type Os2ClientMessageKernelTextChat = CookType<
  typeof os2ClientMessageKernelUserTextType
>

export const os2ClientMessageKernelType = objectType([
  {
    name: "userText",
    type: os2ClientMessageKernelUserTextType,
    optional: true,
  },
  {
    name: "listening",
    type: booleanType,
    optional: true,
  },
  {
    name: "utteranceMark",
    type: booleanType,
    optional: true,
  }
] as const)

export type Os2ClientMessageKernel = CookType<typeof os2ClientMessageKernelType>

export const os2ServerMessageKernelSpotifyListItemType = objectType([
  { name: "name", type: stringType },
  { name: "uri", type: stringType },
  { name: "spotify_url", type: stringType },
  { name: "image", type: stringType },
  { name: "type", type: stringType },
] as const)

export type Os2ServerMessageKernelSpotifyListItem = CookType<
  typeof os2ServerMessageKernelSpotifyListItemType
>

export const os2ServerMessageKernelChatType = objectType([
  { name: "assistantName", type: stringType },
  { name: "assistantResponse", type: stringType },
] as const)

export type Os2ServerMessageKernelChat = CookType<
  typeof os2ServerMessageKernelChatType
>

export const os2ServerMessageKernelType = objectType([
  {
    name: "playSpotifyList",
    type: arrayType(os2ServerMessageKernelSpotifyListItemType),
    optional: true,
  },
  {
    name: "playSpotifyQuery",
    type: stringType,
    optional: true,
  },
  {
    name: "initializeSpotify",
    type: stringType,
    optional: true,
  },
  {
    name: "playSpotifyLikedSong",
    type: stringType,
    optional: true,
  },
  {
    name: "debugChat",
    type: os2ServerMessageKernelChatType,
    optional: true,
  },
  {
    name: "assistantResponse",
    type: stringType,
    optional: true,
  }
] as const)

export type Os2ServerMessageKernel = CookType<typeof os2ServerMessageKernelType>
