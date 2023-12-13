import {
  objectType,
  stringType,
  CookType,
  emptyObjectType,
  booleanType,
} from "base-core/lib/types.js"
import {
  os2SpotifyPlayerControlType,
  os2SpotifyPlayerStatusType,
} from "../spotify/spotify.js"

export const os2ClientMessageSpotifyLogInStatusType = objectType([
  { name: "storageAvailable", type: booleanType },
] as const)
export type Os2ClientMessageSpotifyLogInStatus = CookType<
  typeof os2ClientMessageSpotifyLogInStatusType
>

export const os2ClientMessageSpotifyLoginInitiateType = objectType([
  { name: "debugEnabled", type: booleanType },
] as const)
export type Os2ClientMessageSpotifyLoginInitiate = CookType<
  typeof os2ClientMessageSpotifyLoginInitiateType
>

export const os2ClientMessageSpotifyPlayerConnectType = objectType([
  { name: "storage", type: stringType },
  { name: "debugEnabled", type: booleanType },
] as const)
export type Os2ClientMessageSpotifyPlayerConnect = CookType<
  typeof os2ClientMessageSpotifyPlayerConnectType
>

export const os2ClientMessageSpotifyType = objectType([
  {
    name: "logInStatus",
    type: os2ClientMessageSpotifyLogInStatusType,
    optional: true,
  },
  {
    name: "logInInitiate",
    type: os2ClientMessageSpotifyLoginInitiateType,
    optional: true,
  },
  {
    name: "logInCancel",
    type: emptyObjectType,
    optional: true,
  },
  {
    name: "playerConnect",
    type: os2ClientMessageSpotifyPlayerConnectType,
    optional: true,
  },
  {
    name: "playerDisconnect",
    type: emptyObjectType,
    optional: true,
  },
  {
    name: "playerControl",
    type: os2SpotifyPlayerControlType,
    optional: true,
  },
] as const)

export type Os2ClientMessageSpotify = CookType<
  typeof os2ClientMessageSpotifyType
>

export const os2ServerMessageSpotifyLogInReadyType = objectType([
  {
    name: "noVncUrl",
    type: stringType,
  },
  {
    name: "debugNoVncUrl",
    type: stringType,
  },
] as const)
export type Os2ServerMessageSpotifyLogInReady = CookType<
  typeof os2ServerMessageSpotifyLogInReadyType
>

export const os2ServerMessageSpotifyLogInCompleteType = objectType([
  {
    name: "storage",
    type: stringType,
    optional: true, // exists only if succeeded
  },
] as const)
export type Os2ServerMessageSpotifyLogInComplete = CookType<
  typeof os2ServerMessageSpotifyLogInCompleteType
>

export const os2ServerMessageSpotifyPlayerReadyType = objectType([
  { name: "iceServersJson", type: stringType },
  {
    name: "serviceUrl",
    type: stringType,
  },
  {
    name: "debugNoVncUrl",
    type: stringType,
  },
] as const)
export type Os2ServerMessageSpotifyPlayerReady = CookType<
  typeof os2ServerMessageSpotifyPlayerReadyType
>

export const os2ServerMessageSpotifyType = objectType([
  {
    name: "logInReady",
    type: os2ServerMessageSpotifyLogInReadyType,
    optional: true,
  },
  {
    name: "logInComplete",
    type: os2ServerMessageSpotifyLogInCompleteType,
    optional: true,
  },
  {
    name: "playerReady",
    type: os2ServerMessageSpotifyPlayerReadyType,
    optional: true,
  },
  {
    name: "playerStatus",
    type: os2SpotifyPlayerStatusType,
    optional: true,
  },
] as const)

export type Os2ServerMessageSpotify = CookType<
  typeof os2ServerMessageSpotifyType
>
