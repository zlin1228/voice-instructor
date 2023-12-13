import { CookServiceHttpSchema } from "base-core/lib/http-schema.js"
import {
  CookType,
  arrayType,
  emptyObjectType,
  objectType,
  stringType,
} from "base-core/lib/types.js"
import {
  appAccountType,
  presetBunnyDefinitionType,
  appProfileType,
} from "cm-bunny-host-common/lib/bunny/bunny.js"
import {
  presetBunnyBuildStateRecordType,
  presetBunnyBuildStateReviewType,
  presetBunnyBuildStateSampleType,
  presetBunnyTaskMetricsType,
} from "./task.js"

export const fetchTaskRequestType = objectType([
  { name: "taskId", type: stringType },
  { name: "workerId", type: stringType },
])

export type FetchTaskRequest = CookType<typeof fetchTaskRequestType>

export const fetchTaskResponseType = objectType([
  { name: "organizationName", type: stringType },
  { name: "appProfile", type: appProfileType },
  { name: "account", type: appAccountType, optional: true },
  { name: "bunnyDefinition", type: presetBunnyDefinitionType },
  { name: "samples", type: arrayType(presetBunnyBuildStateSampleType) },
  { name: "record", type: objectType([]), optional: true },
  {
    name: "review",
    type: objectType([
      { name: "record", type: presetBunnyBuildStateRecordType },
    ]),
    optional: true,
  },
])

export type FetchTaskResponse = CookType<typeof fetchTaskResponseType>

export const submitRecordTaskRequestType = objectType([
  { name: "recordTask", type: presetBunnyBuildStateRecordType },
])

export type SubmitRecordTaskRequest = CookType<
  typeof submitRecordTaskRequestType
>

export const submitReviewTaskRequestType = objectType([
  { name: "reviewTask", type: presetBunnyBuildStateReviewType },
])

export type SubmitReviewTaskRequest = CookType<
  typeof submitReviewTaskRequestType
>

export const fetchAllTaskMetricsRequestType = objectType([
  { name: "key", type: stringType },
])

export type FetchAllTaskMetricsRequest = CookType<typeof fetchAllTaskMetricsRequestType>

export const fetchAllTaskMetricsResponseType = objectType([
  { name: "submittedTasks", type: arrayType(presetBunnyTaskMetricsType) }
])

export type FetchAllTaskMetricsResponse = CookType<typeof fetchAllTaskMetricsResponseType>


export const presetBunnyBuilderHttpServiceSchema = [
  {
    kind: "post",
    value: {
      name: "fetchTask",
      request: {
        kind: "json",
        value: fetchTaskRequestType,
      },
      response: {
        kind: "json",
        value: fetchTaskResponseType,
      },
    },
  },
  {
    kind: "post",
    value: {
      name: "submitRecordTask",
      request: {
        kind: "json",
        value: submitRecordTaskRequestType,
      },
      response: {
        kind: "json",
        value: emptyObjectType,
      },
    },
  },
  {
    kind: "post",
    value: {
      name: "submitReviewTask",
      request: {
        kind: "json",
        value: submitReviewTaskRequestType,
      },
      response: {
        kind: "json",
        value: emptyObjectType,
      },
    },
  },
  {
    kind: "post",
    value: {
      name: "fetchAllTaskMetrics",
      request: {
        kind: "json",
        value: fetchAllTaskMetricsRequestType,
      },
      response: {
        kind: "json",
        value: fetchAllTaskMetricsResponseType,
      },
    }
  }
] as const

export type PresetBunnyBuilderHttpService = CookServiceHttpSchema<
  typeof presetBunnyBuilderHttpServiceSchema
>

export const hostControlConnectType = objectType([])

export type HostControlConnect = CookType<typeof hostControlConnectType>

export const hostControlClientType = objectType([])

export type HostControlClient = CookType<typeof hostControlClientType>

export const hostControlServerBunnyHostWebReadyType = objectType([
  { name: "serviceUrl", type: stringType },
  { name: "noVncUrl", type: stringType },
  { name: "debugNoVncUrl", type: stringType },
])

export type HostControlServerBunnyHostWebReady = CookType<
  typeof hostControlServerBunnyHostWebReadyType
>

export const hostControlServerType = objectType([
  { name: "bunnyHostWebReady", type: hostControlServerBunnyHostWebReadyType },
])

export type HostControlServer = CookType<typeof hostControlServerType>
