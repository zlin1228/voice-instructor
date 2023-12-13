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

export const callgraphNodeType = objectType([
  { name: "nodeId", type: int32Type },
  { name: "bunnyName", type: stringType },
  { name: "bunnyId", type: stringType },
  { name: "bunnyArgs", type: stringType },
])

export const callgraphScheduleStep = arrayType(int32Type)

export const sharedCallgraphOutputType = objectType([
  { name: "nodeId", type: int32Type },
  { name: "bunnyName", type: stringType },
  { name: "bunnyId", type: stringType },
  { name: "bunnyArgs", type: stringType },
  { name: "output", type: stringType },
] as const)

export type sharedCallgraphOutput = CookType<typeof sharedCallgraphOutputType>

export const userStorageType = objectType([
  { name: "_id", type: stringType },
  { name: "current_intention", type: stringType },
  {
    name: "current_callgraph", type: objectType([
      {
        name: "nodes", type: arrayType(callgraphNodeType)
      },
      {
        name: "edges", type: arrayType(objectType([
          { name: "from", type: int32Type },
          { name: "to", type: int32Type },
        ]))
      },
      {
        name: "schedule", type: arrayType(callgraphScheduleStep)
      },
      {
        name: "current_step", type: int32Type
      }
    ])
  },
  {
    name: "shared_callgraph_output", type: arrayType(
      sharedCallgraphOutputType
    )
  },
  {
    name: "bunny_mailbox", type: arrayType(
      objectType([
        { name: "bunnyId", type: stringType },
        { name: "result", type: stringType },
        { name: "flush", type: booleanType}
      ] as const)
    )
  },
  { name: "history", type: arrayType(stringType) },
  { name: "conversation_summary", type: stringType },
  { name: "ord", type: int32Type },
  { name: "listening", type: booleanType },
  { name: "speaker", type: stringType },
  { name: "user_name", type: stringType },
  { name: "assistant_name", type: stringType },
  {
    name: "search_config",
    type: objectType([
      { name: "location", type: stringType },
      { name: "hl", type: stringType },
      { name: "google_domain", type: stringType },
    ]),
    optional: true,
  },
  // TODO: Add more fields here
] as const)

export const bunnyStorageType = objectType([
  { name: "_id", type: stringType },
  { name: "userId", type: stringType },
  { name: "bunnyId", type: stringType },
  { name: "bunnyName", type: stringType },
  { name: "bunnyArgs", type: stringType },
  { name: "bunnyResult", type: stringType },
  { name: "bunnyTimestamp", type: int32Type },
] as const)

export type UserStorage = CookType<typeof userStorageType>
export type BunnyStorage = CookType<typeof bunnyStorageType>

export class ModelClient {
  readonly mongoClient: mongodb.MongoClient
  readonly mongoDbClient: MongoDbClient
  readonly scope: Scope

  readonly userStorageCollections: Map<string, MongoCollection<UserStorage>>
  readonly bunnyStorageCollection: Map<string, MongoCollection<BunnyStorage>>

  private constructor(
    mongoClient: mongodb.MongoClient,
    mongoDbClient: MongoDbClient,
    userStorageCollections: Map<string, MongoCollection<UserStorage>>,
    bunnyStorageCollection: Map<string, MongoCollection<BunnyStorage>>,
    scope: Scope
  ) {
    this.mongoClient = mongoClient
    this.mongoDbClient = mongoDbClient
    this.userStorageCollections = userStorageCollections
    this.bunnyStorageCollection = bunnyStorageCollection
    this.scope = scope
  }

  static async build(
    scope: Scope,
    mongoAddress: string,
    database: string
  ): Promise<ModelClient> {
    const mongoClient = await new mongodb.MongoClient(mongoAddress, {
      appName: "cm-rabbit-service",
    }).connect()
    scope.onLeave(async () => {
      await mongoClient.close()
    })
    const mongoDbClient = new MongoDbClient(mongoClient, database, "")
    const userStorageEnCollection = mongoDbClient.accessCollection(
      "en",
      userStorageType
    )
    const userStorageJaCollection = mongoDbClient.accessCollection(
      "ja",
      userStorageType
    )
    const userStorageKoCollection = mongoDbClient.accessCollection(
      "ko",
      userStorageType
    )
    const userStorageCnCollection = mongoDbClient.accessCollection(
      "cn",
      userStorageType
    )
    const userStorageCollections = new Map([
      ["en", userStorageEnCollection],
      ["jp", userStorageJaCollection],
      ["kr", userStorageKoCollection],
      ["cn", userStorageCnCollection],
    ])

    const bunnyStorageEnCollection = mongoDbClient.accessCollection(
      "en-bunny-calls",
      bunnyStorageType
    )

    const bunnyStorageCollections = new Map([
      ["en", bunnyStorageEnCollection],
    ])

    return new ModelClient(
      mongoClient,
      mongoDbClient,
      userStorageCollections,
      bunnyStorageCollections,
      scope
    )
  }
}
