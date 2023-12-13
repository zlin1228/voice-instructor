import * as mongodb from "base-mongodb/node_modules/mongodb"

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

export const apiKeyDocType = objectType([
  { name: "_id", type: stringType },
  {
    name: "user",
    type: objectType([{ name: "email", type: stringType }] as const),
  },
] as const)

export type ApiKeyDoc = CookType<typeof apiKeyDocType>

export class ModelClient {
  readonly mongoClient: mongodb.MongoClient
  readonly mongoDbClient: MongoDbClient
  readonly apiKeyCollection: MongoCollection<ApiKeyDoc>

  private constructor(
    mongoClient: mongodb.MongoClient,
    mongoDbClient: MongoDbClient,
    apiKeyCollection: MongoCollection<ApiKeyDoc>
  ) {
    this.mongoClient = mongoClient
    this.mongoDbClient = mongoDbClient
    this.apiKeyCollection = apiKeyCollection
  }

  static async build(
    scope: Scope,
    mongoAddress: string,
    database: string
  ): Promise<ModelClient> {
    const mongoClient = await new mongodb.MongoClient(mongoAddress, {
      appName: "cm-cyberpunk-next",
    }).connect()
    scope.onLeave(async () => {
      await mongoClient.close()
    })
    const mongoDbClient = new MongoDbClient(mongoClient, database, "")
    const apiKeyCollection = mongoDbClient.accessCollection(
      "apikey",
      apiKeyDocType
    )
    return new ModelClient(mongoClient, mongoDbClient, apiKeyCollection)
  }
}
