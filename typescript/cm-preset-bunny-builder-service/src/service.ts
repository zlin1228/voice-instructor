import { OneOf } from "base-core/lib/one-of.js"
import { Scope, sleepUntilCancel } from "base-core/lib/scope.js"
import {
  HostControlClient,
  HostControlServer,
  PresetBunnyBuilderHttpService,
} from "cm-preset-bunny-builder-common/lib/service/schema.js"
import { BunnyHostClient } from "./bunny-host-client.js"
import { buildAsyncGenerator } from "base-core/lib/processing.js"
import { ModelClient } from "./model.js"
import { throwError } from "base-core/lib/exception.js"
import { buildRandomStringId } from "base-mongodb/lib/mongodb.js"

export type OrganizationKeyMap = Map<string, string>

export interface PresetBunnyBuilderService
  extends PresetBunnyBuilderHttpService {
  handleHostControl: (
    scope: Scope,
    clientMessageIter: AsyncIterable<
      OneOf<{ json: HostControlClient; binary: Uint8Array }>
    >
  ) => AsyncIterable<OneOf<{ json: HostControlServer; binary: Uint8Array }>>
}

export async function buildPresetBunnyBuilderService(
  scope: Scope,
  modelClient: ModelClient,
  bunnyHostClient: BunnyHostClient,
  organizationKeyMap: OrganizationKeyMap
): Promise<PresetBunnyBuilderService> {
  return {
    post_fetchTask: async (scope, request) => {
      const worker = await modelClient.presetBunnyWorkerCollection.getById(
        scope,
        request.workerId
      )
      if (worker === undefined) {
        throw new Error("Worker not found")
      }
      await modelClient.presetBunnyWorkerCollection.createOrReplace(scope, {
        ...worker,
        logins: [
          ...worker.logins,
          {
            time: new Date(),
          },
        ],
      })
      const buildTask =
        await modelClient.presetBunnyBuildTaskCollection.getById(
          scope,
          request.taskId
        )
      if (buildTask === undefined) {
        throw new Error("Task not found")
      }
      const buildState =
        (await modelClient.presetBunnyBuildStateCollection.getById(
          scope,
          buildTask.presetBunnyBuildStateId
        )) ?? throwError("No associated build state")
      const appProfile =
        (await modelClient.appProfileCollection.getById(
          scope,
          buildState.appId
        )) ?? throwError("Linked app profile not found")
      const presetBunny =
        (await modelClient.presetBunnyCollection.getById(
          scope,
          buildState.presetBunnyId
        )) ?? throwError("Linked preset bunny not found")
      const appAccount =
        buildState.appAccountId === undefined
          ? undefined
          : (await modelClient.appAccountCollection.getById(
            scope,
            buildState.appAccountId
          )) ?? throwError("Linked app account not found")
      const succeededRecord = buildState.recordTasks.find(
        (record) => record.succeeded
      )
      if (succeededRecord !== undefined && buildTask.record !== undefined) {
        throw new Error("Task already succeeded")
      }
      if (buildTask.review !== undefined) {
        if (buildState.reviewTasks.length !== 0) {
          throw new Error("Task already succeeded")
        }
      }
      return {
        organizationName: buildTask.organizationName,
        appProfile,
        account: appAccount?.account,
        bunnyDefinition: presetBunny.definition,
        samples: buildState.samples,
        record: buildTask.record,
        review:
          buildTask.review === undefined
            ? undefined
            : {
              record:
                succeededRecord ??
                throwError("No succeeded record to review"),
            },
      }
    },
    post_submitRecordTask: async (scope, request) => {
      const { recordTask } = request
      const buildTask =
        (await modelClient.presetBunnyBuildTaskCollection.getById(
          scope,
          recordTask.buildTaskId
        )) ?? throwError("Task not found")
      const buildState =
        (await modelClient.presetBunnyBuildStateCollection.getById(
          scope,
          buildTask.presetBunnyBuildStateId
        )) ?? throwError("No associated build state")
      const newBuildState = {
        ...buildState,
        recordTasks: [
          ...buildState.recordTasks,
          {
            ...recordTask,
            time: new Date(),
          },
        ],
      }
      await modelClient.presetBunnyBuildStateCollection.createOrReplace(
        scope,
        newBuildState
      )
      await modelClient.presetBunnyTaskMetricsCollection.createOrReplace(scope, {
        _id: buildRandomStringId(),
        organizationName: buildTask.organizationName,
        workerId: recordTask.workerId,
        taskId: buildTask._id,
        submitTime: new Date(),
        spentSeconds: recordTask.timeSpentSeconds ?? -1,
        succeeded: recordTask.succeeded,
      })
      return {}
    },
    post_submitReviewTask: async (scope, request) => {
      const { reviewTask } = request
      const buildTask =
        (await modelClient.presetBunnyBuildTaskCollection.getById(
          scope,
          reviewTask.buildTaskId
        )) ?? throwError("Task not found")
      const buildState =
        (await modelClient.presetBunnyBuildStateCollection.getById(
          scope,
          buildTask.presetBunnyBuildStateId
        )) ?? throwError("No associated build state")
      const newBuildState = {
        ...buildState,
        reviewTasks: [
          ...buildState.reviewTasks,
          {
            ...reviewTask,
            time: new Date(),
          },
        ],
      }
      await modelClient.presetBunnyBuildStateCollection.createOrReplace(
        scope,
        newBuildState
      )
      await modelClient.presetBunnyTaskMetricsCollection.createOrReplace(scope, {
        _id: buildRandomStringId(),
        organizationName: buildTask.organizationName,
        workerId: reviewTask.workerId,
        taskId: buildTask._id,
        submitTime: new Date(),
        spentSeconds: reviewTask.timeSpentSeconds ?? -1,
        succeeded: reviewTask.succeeded,
      })
      return {}
    },
    post_fetchAllTaskMetrics: async (scope, request) => {
      const { key } = request
      const organizationName = organizationKeyMap.get(key)
      if (organizationName === undefined) {
        throw new Error("Invalid key")
      }
      const metricsList = await modelClient.presetBunnyTaskMetricsCollection.find(scope, {
        organizationName,
      }).toArray()
      return {
        submittedTasks: metricsList,
      }
    },
    handleHostControl: function (
      scope,
      clientMessageIter: AsyncIterable<
        OneOf<{ json: HostControlClient; binary: Uint8Array }>
      >
    ): AsyncGenerator<OneOf<{ json: HostControlServer; binary: Uint8Array }>> {
      return buildAsyncGenerator(async (push) => {
        const { sessionName, browser } = await bunnyHostClient.allocateBrowser(
          scope
        )
        const noVncUrl = bunnyHostClient.getNoVncUrl(sessionName)
        const debugNoVncUrl = bunnyHostClient.getDebugNoVncUrl(sessionName)
        const serviceUrl = bunnyHostClient.getServiceUrl(sessionName)
        await push({
          kind: "json",
          value: {
            bunnyHostWebReady: {
              serviceUrl,
              noVncUrl,
              debugNoVncUrl,
            },
          },
        })
        await sleepUntilCancel(scope)
      })
    },
  }
}
