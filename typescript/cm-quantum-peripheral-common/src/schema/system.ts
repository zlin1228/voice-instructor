import {
  arrayType,
  int32Type,
  objectType,
  stringType,
} from "base-core/lib/types.js"
import { emptyResponseType } from "./common.js"

// https://developer.android.com/guide/components/intents-common#CreateAlarm
export const systemCreateAlarmRequestType = objectType([
  { name: "hour", type: int32Type },
  { name: "minutes", type: int32Type },
  { name: "message", type: stringType },

  // Week days on which this alarm should be repeated.
  // Do not specify this for a one-time alarm.
  // 1=Sunday, 2=Monday, 7=Saturday
  { name: "days", type: arrayType(int32Type), optional: true },
] as const)

// https://developer.android.com/guide/components/intents-common#CreateTimer
export const systemCreateTimerRequestType = objectType([
  { name: "lengthSeconds", type: int32Type },
  { name: "message", type: stringType },
] as const)

// https://developer.android.com/guide/components/intents-common#SendMessage
export const systemSendMessageRequestType = objectType([
  { name: "phoneNumber", type: stringType },
  { name: "smsBody", type: stringType },
] as const)

export const systemEndpoints = [
  {
    kind: "post",
    value: {
      name: "systemCreateAlarm",
      request: {
        kind: "json",
        value: systemCreateAlarmRequestType,
      },
      response: {
        kind: "json",
        value: emptyResponseType,
      },
    },
  },
  {
    kind: "post",
    value: {
      name: "systemCreateTimer",
      request: {
        kind: "json",
        value: systemCreateTimerRequestType,
      },
      response: {
        kind: "json",
        value: emptyResponseType,
      },
    },
  },
  {
    kind: "post",
    value: {
      name: "systemSendMessage",
      request: {
        kind: "json",
        value: systemSendMessageRequestType,
      },
      response: {
        kind: "json",
        value: emptyResponseType,
      },
    },
  },
] as const
