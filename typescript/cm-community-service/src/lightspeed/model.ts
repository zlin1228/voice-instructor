import { mongodb } from "base-mongodb/lib/deps.js"

import {
  CookType,
  arrayType,
  booleanType,
  int32Type,
  objectType,
  stringType,
} from "base-core/lib/types.js"
import { Scope } from "base-core/lib/scope.js"
import { MongoCollection, MongoDbClient } from "base-mongodb/lib/mongodb.js"
import { WithId, withIdType } from "cm-community-common/lib/schema/common.js"
import {
  SpeechInput,
  SpeechOutput,
  speechInputType,
  speechOutputType,
} from "cm-community-common/lib/schema/speech.js"
import { stringRandomSimpleName } from "base-core/lib/string.js"
import { throwError } from "base-core/lib/exception.js"
import {
  WorldEvent,
  gameOperationType,
  npcRuntimeType,
  playerOperationType,
  worldEventType,
  worldType,
} from "cm-community-common/lib/schema/lightspeed.js"

export const worldDocType = withIdType(worldType)
export type WorldDoc = CookType<typeof worldDocType>

export const worldEventDocType = withIdType(worldEventType)
export type WorldEventDoc = CookType<typeof worldEventDocType>

export const playerOperationDocType = withIdType(
  objectType([
    { name: "worldId", type: stringType },
    { name: "operation", type: playerOperationType, optional: true },
    { name: "gameOperation", type: gameOperationType, optional: true },
  ])
)
export type PlayerOperationDoc = CookType<typeof playerOperationDocType>

export const speechInputDocType = withIdType(speechInputType)
export type SpeechInputDoc = CookType<typeof speechInputDocType>

export const speechOutputDocType = withIdType(speechOutputType)
export type SpeechOutputDoc = CookType<typeof speechOutputDocType>

export class ModelClient {
  readonly mongoClient: mongodb.MongoClient
  readonly mongoDbClient: MongoDbClient
  readonly worldCollection: MongoCollection<WorldDoc>
  readonly worldEventCollection: MongoCollection<WorldEventDoc>
  readonly playerOperationCollection: MongoCollection<PlayerOperationDoc>
  readonly speechInputCollection: MongoCollection<SpeechInputDoc>
  readonly speechOutputCollection: MongoCollection<SpeechOutputDoc>

  private constructor(
    mongoClient: mongodb.MongoClient,
    mongoDbClient: MongoDbClient,
    worldCollection: MongoCollection<WorldDoc>,
    worldEventCollection: MongoCollection<WorldEventDoc>,
    playerOperationCollection: MongoCollection<PlayerOperationDoc>,
    speechInputCollection: MongoCollection<SpeechInputDoc>,
    speechOutputCollection: MongoCollection<SpeechOutputDoc>
  ) {
    this.mongoClient = mongoClient
    this.mongoDbClient = mongoDbClient
    this.worldCollection = worldCollection
    this.worldEventCollection = worldEventCollection
    this.playerOperationCollection = playerOperationCollection
    this.speechInputCollection = speechInputCollection
    this.speechOutputCollection = speechOutputCollection
  }

  static async build(
    scope: Scope,
    mongoAddress: string,
    database: string
  ): Promise<ModelClient> {
    const mongoClient = await new mongodb.MongoClient(mongoAddress, {
      appName: "cm-community-service",
    }).connect()
    scope.onLeave(async () => {
      await mongoClient.close()
    })
    const mongoDbClient = new MongoDbClient(mongoClient, database, "")
    const worldCollection = mongoDbClient.accessCollection(
      "world",
      worldDocType
    )
    const worldEventCollection = mongoDbClient.accessCollection(
      "event",
      worldEventDocType
    )
    const playerOperationCollection = mongoDbClient.accessCollection(
      "operation",
      playerOperationDocType
    )
    const speechInputCollection = mongoDbClient.accessCollection(
      "speechInput",
      speechInputDocType
    )
    const speechOutputCollection = mongoDbClient.accessCollection(
      "speechOutput",
      speechOutputDocType
    )
    return new ModelClient(
      mongoClient,
      mongoDbClient,
      worldCollection,
      worldEventCollection,
      playerOperationCollection,
      speechInputCollection,
      speechOutputCollection
    )
  }

  async getWorldById(scope: Scope, worldId: string): Promise<WithId<WorldDoc>> {
    return (
      (await this.worldCollection.getById(scope, worldId)) ??
      throwError("World not found")
    )
  }

  async writeWorldEvent(scope: Scope, worldEvent: WorldEvent): Promise<void> {
    const worldEventDoc = {
      ...worldEvent,
      _id: stringRandomSimpleName(16),
    }
    await this.worldEventCollection.createIfNotExists(scope, worldEventDoc)
  }
}
