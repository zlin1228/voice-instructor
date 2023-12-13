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

export const userStorageType = objectType([
  { name: "_id", type: stringType },
  { name: "conversation_context", type: arrayType(stringType) },
  {
    name: "history", type: arrayType(
      objectType([
        { name: "character", type: stringType },
        { name: "conversation", type: arrayType(stringType) },
      ] as const)
    )
  },
  { name: "conversation_summary", type: stringType },
  { name: "last_summarized_length", type: int32Type },
  { name: "listening", type: booleanType },
  { name: "user_name", type: stringType },
  {
    name: "search_config",
    type: objectType([
      { name: "location", type: stringType },
      { name: "hl", type: stringType },
      { name: "google_domain", type: stringType },
    ] as const),
    optional: true,
  },
  // TODO: Add more fields here
] as const)

export const apiStorageType = objectType([
  { name: "_id", type: stringType },
  {
    name: "user",
    type: objectType([
      { name: "email", type: stringType },
    ]),
  }
] as const)

export const characterStorageType = objectType([
  { name: "_id", type: stringType },
  { name: "classification", type: stringType },
  { name: "name", type: stringType },
  { name: "description", type: stringType },
  { name: "voice_id", type: stringType },
] as const)

export const characterBankType = objectType([
  { name: "_id", type: stringType },
  { name: "classification", type: stringType },
  { name: "name", type: stringType },
  { name: "description", type: stringType },
  { name: "selected", type: booleanType },
] as const)

export const voiceBankType = objectType([
  { name: "_id", type: stringType },
  { name: "classification", type: stringType },
  { name: "name", type: stringType },
  { name: "classification", type: stringType },
  { name: "voice_id", type: stringType },
  { name: "provider", type: stringType },
  { name: "selected", type: booleanType },
] as const)

export const apiKeyStorageType = objectType([
  { name: "_id", type: stringType },
  { name: "user", type: objectType([
    { name: "email", type: stringType },
  ]) },
] as const)

export type UserStorage = CookType<typeof userStorageType>
export type ApiStorage = CookType<typeof apiStorageType>
export type CharacterStorage = CookType<typeof characterStorageType>
export type CharacterBank = CookType<typeof characterBankType>
export type VoiceBank = CookType<typeof voiceBankType>
export type ApiKeyStorage = CookType<typeof apiKeyStorageType>

export class ModelClient {
  readonly mongoClient: mongodb.MongoClient
  readonly mongoDbClient: MongoDbClient
  readonly scope: Scope

  readonly userStorageCollections: Map<string, MongoCollection<UserStorage>>
  readonly apiStorageCollection: MongoCollection<ApiStorage>
  readonly characterStorageCollection: MongoCollection<CharacterStorage>
  readonly characterBankCollection: MongoCollection<CharacterBank>
  readonly voiceBankCollection: MongoCollection<VoiceBank>
  readonly apiKeyStorageCollection: MongoCollection<ApiKeyStorage>

  private constructor(
    mongoClient: mongodb.MongoClient,
    mongoDbClient: MongoDbClient,
    userStorageCollections: Map<string, MongoCollection<UserStorage>>,
    apiStorageCollection: MongoCollection<ApiStorage>,
    characterStorageCollection: MongoCollection<CharacterStorage>,
    characterBankCollection: MongoCollection<CharacterBank>,
    voiceBankCollection: MongoCollection<VoiceBank>,
    apiKeyStorageCollection: MongoCollection<ApiKeyStorage>,
    scope: Scope
  ) {
    this.mongoClient = mongoClient
    this.mongoDbClient = mongoDbClient
    this.userStorageCollections = userStorageCollections
    this.apiStorageCollection = apiStorageCollection
    this.characterStorageCollection = characterStorageCollection
    this.characterBankCollection = characterBankCollection
    this.voiceBankCollection = voiceBankCollection
    this.apiKeyStorageCollection = apiKeyStorageCollection
    this.scope = scope
  }

  static async build(
    scope: Scope,
    mongoAddress: string,
    database: string
  ): Promise<ModelClient> {
    const mongoClient = await new mongodb.MongoClient(mongoAddress, {
      appName: "cm-cyberpunk-service",
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
    const apiStorageCollection = mongoDbClient.accessCollection(
      "apikey",
      apiStorageType
    )
    const characterStorageCollection = mongoDbClient.accessCollection(
      "character",
      characterStorageType
    )
    const characterBankCollection = mongoDbClient.accessCollection(
      "character-bank",
      characterBankType
    )
    const voiceBankCollection = mongoDbClient.accessCollection(
      "voice-bank",
      voiceBankType
    )
    const apiKeyStorageCollection = mongoDbClient.accessCollection(
      "apikey",
      apiKeyStorageType
    )

    return new ModelClient(
      mongoClient,
      mongoDbClient,
      userStorageCollections,
      apiStorageCollection,
      characterStorageCollection,
      characterBankCollection,
      voiceBankCollection,
      apiKeyStorageCollection,
      scope
    )
  }
}
