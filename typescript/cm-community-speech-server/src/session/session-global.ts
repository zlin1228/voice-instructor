import {
  objectType,
  stringType,
  booleanType,
  CookType,
  timestampType,
} from "base-core/lib/types.js"

export const CmClientMessageGlobalInitializeType = objectType([
  { name: "token", type: stringType },
] as const)

export type CmClientMessageGlobalInitialize = CookType<
  typeof CmClientMessageGlobalInitializeType
>

export const CmClientMessageGlobalLogType = objectType([
  { name: "message", type: stringType },
] as const)

export type CmClientMessageGlobalLog = CookType<
  typeof CmClientMessageGlobalLogType
>

export const cmClientMessageGlobalType = objectType([
  {
    name: "debugLog",
    type: CmClientMessageGlobalLogType,
    optional: true,
  },
  {
    name: "initialize",
    type: CmClientMessageGlobalInitializeType,
    optional: true,
  },
] as const)

export type CmClientMessageGlobal = CookType<typeof cmClientMessageGlobalType>

export const CmServerMessageGlobalLogType = objectType([
  { name: "message", type: stringType },
] as const)

export type CmServerMessageGlobalLog = CookType<
  typeof CmServerMessageGlobalLogType
>

export const CmServerMessageGlobalInitializeType = objectType([
  { name: "currentTime", type: timestampType },
  { name: "clientIp", type: stringType },
  { name: "logged_in", type: booleanType },
] as const)

export type CmServerMessageGlobalInitialize = CookType<
  typeof CmServerMessageGlobalInitializeType
>

export const cmServerMessageGlobalType = objectType([
  {
    name: "debugLog",
    type: CmServerMessageGlobalLogType,
    optional: true,
  },
  {
    name: "initialize",
    type: CmServerMessageGlobalInitializeType,
    optional: true,
  },
] as const)

export type CmServerMessageGlobal = CookType<typeof cmServerMessageGlobalType>
