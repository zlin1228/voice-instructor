import { mongodb } from "base-mongodb/lib/deps.js"
import { CookType, objectType, stringType } from "base-core/lib/types.js"
import { Scope } from "base-core/lib/scope.js"
import {
  MongoCollection,
  MongoDbClient,
  withStringIdType,
} from "base-mongodb/lib/mongodb.js"
import {
  appAccountType,
  appProfileType,
  presetBunnyDefinitionType,
} from "cm-bunny-host-common/lib/bunny/bunny.js"
import {
  presetBunnyBuildStateType,
  presetBunnyBuildTaskType,
  presetBunnyTaskMetricsType,
  presetBunnyWorkerType,
} from "cm-preset-bunny-builder-common/lib/service/task.js"

export const appProfileDocType = withStringIdType(appProfileType)
export type AppProfileDoc = CookType<typeof appProfileDocType>

export const appAccountDocType = withStringIdType(
  objectType([
    { name: "appId", type: stringType },
    {
      name: "account",
      type: appAccountType,
    },
  ])
)
export type AppAccountDoc = CookType<typeof appAccountDocType>

export const presetBunnyDocType = withStringIdType(
  objectType([
    { name: "appId", type: stringType },
    { name: "definition", type: presetBunnyDefinitionType },
  ])
)
export type PresetBunnyDoc = CookType<typeof presetBunnyDocType>

export const presetBunnyBuildStateDocType = withStringIdType(
  presetBunnyBuildStateType
)
export type PresetBunnyBuildStateDoc = CookType<
  typeof presetBunnyBuildStateDocType
>

export const presetBunnyBuildTaskDocType = withStringIdType(
  presetBunnyBuildTaskType
)
export type PresetBunnyBuildTaskDoc = CookType<
  typeof presetBunnyBuildTaskDocType
>

export const presetBunnyWorkerDocType = withStringIdType(presetBunnyWorkerType)

export type PresetBunnyWorkerDoc = CookType<typeof presetBunnyWorkerDocType>

export const presetBunnyTaskMetricsDocType = withStringIdType(presetBunnyTaskMetricsType)

export type PresetBunnyTaskMetricsDoc = CookType<typeof presetBunnyTaskMetricsDocType>

export class ModelClient {
  readonly mongoClient: mongodb.MongoClient
  readonly mongoDbClient: MongoDbClient

  private constructor(
    mongoClient: mongodb.MongoClient,
    mongoDbClient: MongoDbClient,
    readonly appProfileCollection: MongoCollection<AppProfileDoc>,
    readonly appAccountCollection: MongoCollection<AppAccountDoc>,
    readonly presetBunnyCollection: MongoCollection<PresetBunnyDoc>,
    readonly presetBunnyBuildStateCollection: MongoCollection<PresetBunnyBuildStateDoc>,
    readonly presetBunnyBuildTaskCollection: MongoCollection<PresetBunnyBuildTaskDoc>,
    readonly presetBunnyWorkerCollection: MongoCollection<PresetBunnyWorkerDoc>,
    readonly presetBunnyTaskMetricsCollection: MongoCollection<PresetBunnyTaskMetricsDoc>
  ) {
    this.mongoClient = mongoClient
    this.mongoDbClient = mongoDbClient
  }

  static async build(
    scope: Scope,
    mongoAddress: string,
    database: string
  ): Promise<ModelClient> {
    const mongoClient = await new mongodb.MongoClient(mongoAddress, {
      appName: "cm-preset-bunny-builder-service",
    }).connect()
    scope.onLeave(async () => {
      await mongoClient.close()
    })
    const mongoDbClient = new MongoDbClient(mongoClient, database, "")
    const appProfileCollection = mongoDbClient.accessCollection(
      "appProfile",
      appProfileDocType
    )
    const appAccountCollection = mongoDbClient.accessCollection(
      "appAccount",
      appAccountDocType
    )
    const presetBunnyCollection = mongoDbClient.accessCollection(
      "presetBunny",
      presetBunnyDocType
    )
    const presetBunnyBuildStateCollection = mongoDbClient.accessCollection(
      "presetBunnyBuildState",
      presetBunnyBuildStateDocType
    )
    const presetBunnyBuildTaskCollection = mongoDbClient.accessCollection(
      "presetBunnyBuildTask",
      presetBunnyBuildTaskDocType
    )
    const presetBunnyWorkerCollection = mongoDbClient.accessCollection(
      "presetBunnyWorker",
      presetBunnyWorkerDocType
    )
    const presetBunnyTaskMetricsCollection = mongoDbClient.accessCollection(
      "presetBunnyTaskMetrics",
      presetBunnyTaskMetricsDocType
    )
    return new ModelClient(
      mongoClient,
      mongoDbClient,
      appProfileCollection,
      appAccountCollection,
      presetBunnyCollection,
      presetBunnyBuildStateCollection,
      presetBunnyBuildTaskCollection,
      presetBunnyWorkerCollection,
      presetBunnyTaskMetricsCollection,
    )
  }
}
