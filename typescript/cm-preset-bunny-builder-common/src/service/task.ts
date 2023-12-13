import {
  objectType,
  stringType,
  CookType,
  arrayType,
  emptyObjectType,
  booleanType,
  int32Type,
  timestampType,
  doubleType,
} from "base-core/lib/types.js"
import { bunnyArgumentType } from "cm-bunny-host-common/lib/bunny/bunny.js"
import { presetRecordType } from "cm-bunny-host-web-common/lib/preset/preset.js"

export const presetBunnyBuildStateSampleType = objectType([
  { name: "argumentList", type: arrayType(bunnyArgumentType) },
])

export type PresetBunnyBuildStateSample = CookType<
  typeof presetBunnyBuildStateSampleType
>

export const presetBunnyBuildStateRecordType = objectType([
  { name: "buildTaskId", type: stringType },
  { name: "workerId", type: stringType },
  { name: "time", type: timestampType },
  { name: "succeeded", type: booleanType },
  { name: "failureReason", type: stringType },
  { name: "timeSpentSeconds", type: doubleType, optional: true },
  { name: "record", type: presetRecordType },
])

export type PresetBunnyBuildStateRecord = CookType<
  typeof presetBunnyBuildStateRecordType
>

export const presetBunnyBuildStateReviewType = objectType([
  { name: "buildTaskId", type: stringType },
  { name: "workerId", type: stringType },
  { name: "time", type: timestampType },
  { name: "succeeded", type: booleanType },
  { name: "timeSpentSeconds", type: doubleType, optional: true },
  { name: "failureReason", type: stringType },
])

export type PresetBunnyBuildStateReview = CookType<
  typeof presetBunnyBuildStateReviewType
>

export const presetBunnyBuildStateType = objectType([
  { name: "appId", type: stringType },
  { name: "appAccountId", type: stringType, optional: true },
  { name: "presetBunnyId", type: stringType },
  { name: "samples", type: arrayType(presetBunnyBuildStateSampleType) },
  {
    name: "openHoursUtc",
    type: objectType([
      // 0 <= openHour < closeHour <= 24
      { name: "openHour", type: int32Type },
      { name: "closeHour", type: int32Type },
    ]),
    optional: true,
  },
  { name: "recordTasks", type: arrayType(presetBunnyBuildStateRecordType) },
  { name: "reviewTasks", type: arrayType(presetBunnyBuildStateReviewType) },
])

export type PresetBunnyBuildState = CookType<typeof presetBunnyBuildStateType>

export const presetBunnyBuildTaskType = objectType([
  { name: "presetBunnyBuildStateId", type: stringType },
  { name: "organizationName", type: stringType },
  { name: "record", type: emptyObjectType, optional: true },
  { name: "review", type: emptyObjectType, optional: true },
])

export type PresetBunnyBuildTask = CookType<typeof presetBunnyBuildTaskType>

export const presetBunnyWorkerLoginType = objectType([
  { name: "time", type: timestampType },
])

export type PresetBunnyWorkerLogin = CookType<typeof presetBunnyWorkerLoginType>

export const presetBunnyWorkerType = objectType([
  { name: "createdAt", type: timestampType },
  { name: "note", type: stringType },
  { name: "logins", type: arrayType(presetBunnyWorkerLoginType) },
])

export type PresetBunnyWorker = CookType<typeof presetBunnyWorkerType>

export const presetBunnyTaskMetricsType = objectType([
  { name: "organizationName", type: stringType },
  { name: "workerId", type: stringType },
  { name: "taskId", type: stringType },
  { name: "submitTime", type: timestampType },
  { name: "spentSeconds", type: doubleType },
  { name: "succeeded", type: booleanType },
])

export type PresetBunnyTaskMetrics = CookType<typeof presetBunnyTaskMetricsType>