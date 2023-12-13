import { mongodb } from "base-mongodb/lib/deps.js"
import { CookType, objectType, stringType } from "base-core/lib/types.js"
import { Scope } from "base-core/lib/scope.js"
import { MongoCollection, MongoDbClient } from "base-mongodb/lib/mongodb.js"
import {
  speechInputType,
  speechOutputType,
} from "cm-community-common/lib/community/apis/speech.js"
import { throwError } from "base-core/lib/exception.js"
import { withIdType } from "cm-community-common/lib/community/types/common.js"
import {
  communitySnapshotType,
  communityActionType,
  CommunityAction,
  communityOperationType,
  CommunitySnapshot,
} from "cm-community-common/lib/community/types/engine.js"
import { worldOperationType } from "cm-community-common/lib/community/types/operation.js"
import { buildRandomId } from "cm-community-common/lib/community/types/utils.js"

export const communitySnapshotDocType = withIdType(communitySnapshotType)
export type CommunitySnapshotDoc = CookType<typeof communitySnapshotDocType>

export const communityActionDocType = withIdType(communityActionType)
export type CommunityActionDoc = CookType<typeof communityActionDocType>

export const communityOperationDocType = withIdType(communityOperationType)
export type CommunityOperationDoc = CookType<typeof communityOperationDocType>

export const speechInputDocType = withIdType(speechInputType)
export type SpeechInputDoc = CookType<typeof speechInputDocType>

export const speechOutputDocType = withIdType(speechOutputType)
export type SpeechOutputDoc = CookType<typeof speechOutputDocType>

export class ModelClient {
  readonly mongoClient: mongodb.MongoClient
  readonly mongoDbClient: MongoDbClient
  readonly communitySnapshotCollection: MongoCollection<CommunitySnapshotDoc>
  readonly communityActionCollection: MongoCollection<CommunityActionDoc>
  readonly communityOperationCollection: MongoCollection<CommunityOperationDoc>
  readonly speechInputCollection: MongoCollection<SpeechInputDoc>
  readonly speechOutputCollection: MongoCollection<SpeechOutputDoc>

  private constructor(
    mongoClient: mongodb.MongoClient,
    mongoDbClient: MongoDbClient,
    communitySnapshotCollection: MongoCollection<CommunitySnapshotDoc>,
    communityActionCollection: MongoCollection<CommunityActionDoc>,
    communityOperationCollection: MongoCollection<CommunityOperationDoc>,
    speechInputCollection: MongoCollection<SpeechInputDoc>,
    speechOutputCollection: MongoCollection<SpeechOutputDoc>
  ) {
    this.mongoClient = mongoClient
    this.mongoDbClient = mongoDbClient
    this.communitySnapshotCollection = communitySnapshotCollection
    this.communityActionCollection = communityActionCollection
    this.communityOperationCollection = communityOperationCollection
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
    const communitySnapshotCollection = mongoDbClient.accessCollection(
      "snapshot",
      communitySnapshotDocType
    )
    const communityActionCollection = mongoDbClient.accessCollection(
      "action",
      communityActionDocType
    )
    const communityOperationCollection = mongoDbClient.accessCollection(
      "operation",
      communityOperationDocType
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
      communitySnapshotCollection,
      communityActionCollection,
      communityOperationCollection,
      speechInputCollection,
      speechOutputCollection
    )
  }

  async readSnapshotByWorldId(
    scope: Scope,
    worldId: string
  ): Promise<CommunitySnapshot> {
    return (
      (await this.communitySnapshotCollection.getById(scope, worldId)) ??
      throwError("World not found")
    )
  }

  async writeSnapshot(
    scope: Scope,
    snapshot: CommunitySnapshot
  ): Promise<void> {
    await this.communitySnapshotCollection.createOrReplace(scope, {
      _id: snapshot.worldId,
      ...snapshot,
    })
  }

  async writeAction(
    scope: Scope,
    communityAction: CommunityAction
  ): Promise<void> {
    const communityActionDoc = {
      ...communityAction,
      _id: buildRandomId(),
    }
    const created = await this.communityActionCollection.createIfNotExists(
      scope,
      communityActionDoc
    )
    if (!created) {
      throw new Error("Action already exists")
    }
  }
}
