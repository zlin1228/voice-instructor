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
import { speechInputType, speechOutputType } from "cm-community-common/lib/schema/speech.js"
import { WithId, withIdType } from "cm-community-common/lib/schema/common.js"

export const speechInputDocType = withIdType(speechInputType)
export type SpeechInputDoc = CookType<typeof speechInputDocType>

export const speechOutputDocType = withIdType(speechOutputType)
export type SpeechOutputDoc = CookType<typeof speechOutputDocType>

export class ModelClient {
  readonly mongoClient: mongodb.MongoClient
  readonly mongoDbClient: MongoDbClient
  readonly scope: Scope

  readonly speechInputCollection: MongoCollection<SpeechInputDoc>
  readonly speechOutputCollection: MongoCollection<SpeechOutputDoc>

  private constructor(
    mongoClient: mongodb.MongoClient,
    mongoDbClient: MongoDbClient,
    speechInputCollection: MongoCollection<SpeechInputDoc>,
    speechOutputCollection: MongoCollection<SpeechOutputDoc>,
    scope: Scope
  ) {
    this.mongoClient = mongoClient
    this.mongoDbClient = mongoDbClient

    this.speechInputCollection = speechInputCollection
    this.speechOutputCollection = speechOutputCollection
    this.scope = scope
  }

  static async build(
    scope: Scope,
    mongoAddress: string,
    database: string
  ): Promise<ModelClient> {
    const mongoClient = await new mongodb.MongoClient(mongoAddress, {
      appName: "cm-speech-server",
    }).connect()
    scope.onLeave(async () => {
      await mongoClient.close()
    })
    const mongoDbClient = new MongoDbClient(mongoClient, database, "")
   

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
      speechInputCollection,
      speechOutputCollection,
      scope
    )
  }
}
