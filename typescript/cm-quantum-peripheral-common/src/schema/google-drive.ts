import {
  objectType,
  stringType,
  booleanType,
  int32Type,
  doubleType,
  arrayType,
  CookType,
} from "base-core/lib/types.js"

export const googleDriveCreateNoteRequestType = objectType([
  { name: "title", type: stringType },
  { name: "content", type: stringType },
] as const)

export type GoogleDriveCreateNoteRequest = CookType<
  typeof googleDriveCreateNoteRequestType
>

export const googleDriveCreateNoteResponseType = objectType([
  { name: "name", type: stringType },
  { name: "url", type: stringType },
] as const)

export type GoogleDriveCreateNoteResponse = CookType<
  typeof googleDriveCreateNoteResponseType
>

export const googleDriveEndpoints = [
  {
    kind: "post",
    value: {
      name: "googleDriveCreateNote",
      request: {
        kind: "json",
        value: googleDriveCreateNoteRequestType,
      },
      response: {
        kind: "json",
        value: googleDriveCreateNoteResponseType,
      },
    },
  },
] as const
