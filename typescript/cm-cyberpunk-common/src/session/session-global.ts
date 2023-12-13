import {
  objectType,
  stringType,
  booleanType,
  CookType,
  timestampType,
} from "base-core/lib/types.js"

export const Os2ClientMessageGlobalInitializeType = objectType([
  { name: "token", type: stringType },
  { name: "language", type: stringType },
] as const)

export type Os2ClientMessageGlobalInitialize = CookType<
  typeof Os2ClientMessageGlobalInitializeType
>

export const Os2ClientMessageGlobalLogType = objectType([
  { name: "message", type: stringType },
] as const)

export type Os2ClientMessageGlobalLog = CookType<
  typeof Os2ClientMessageGlobalLogType
>

export const os2ClientMessageGlobalType = objectType([
  {
    name: "debugLog",
    type: Os2ClientMessageGlobalLogType,
    optional: true,
  },
  {
    name: "initialize",
    type: Os2ClientMessageGlobalInitializeType,
    optional: true,
  },
] as const)

export type Os2ClientMessageGlobal = CookType<typeof os2ClientMessageGlobalType>

export const Os2ServerMessageGlobalLogType = objectType([
  { name: "message", type: stringType },
] as const)

export type Os2ServerMessageGlobalLog = CookType<
  typeof Os2ServerMessageGlobalLogType
>

export const Os2ServerMessageGlobalInitializeType = objectType([
  { name: "currentTime", type: timestampType },
  { name: "clientIp", type: stringType },
  { name: "logged_in", type: booleanType },
] as const)

export type Os2ServerMessageGlobalInitialize = CookType<
  typeof Os2ServerMessageGlobalInitializeType
>

export const os2ServerMessageGlobalType = objectType([
  {
    name: "debugLog",
    type: Os2ServerMessageGlobalLogType,
    optional: true,
  },
  {
    name: "initialize",
    type: Os2ServerMessageGlobalInitializeType,
    optional: true,
  },
] as const)

export type Os2ServerMessageGlobal = CookType<typeof os2ServerMessageGlobalType>
