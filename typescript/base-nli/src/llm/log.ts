import { throwError } from "base-core/lib/exception.js"
import { Scope } from "base-core/lib/scope.js"
import { objectType, stringType, CookType } from "base-core/lib/types.js"
import { mongodb } from "base-mongodb/lib/deps.js"
import { MongoCollection, MongoDbClient } from "base-mongodb/lib/mongodb.js"
import { LlmCompletionLog, llmCompletionLogType } from "./client.js"
import { stringRandomSimpleName } from "base-core/lib/string.js"

export const llmLogDocType = objectType([
  { name: "_id", type: stringType },
  {
    name: "model",
    type: stringType,
  },
  {
    name: "completion",
    type: llmCompletionLogType,
    optional: true,
  },
] as const)

export type LlmLogDoc = CookType<typeof llmLogDocType>

export class LlmModelClient {
  readonly mongoClient: mongodb.MongoClient
  readonly mongoDbClient: MongoDbClient
  readonly llmLogCollection: MongoCollection<LlmLogDoc>

  private constructor(
    mongoClient: mongodb.MongoClient,
    mongoDbClient: MongoDbClient,
    llmLogCollection: MongoCollection<LlmLogDoc>
  ) {
    this.mongoClient = mongoClient
    this.mongoDbClient = mongoDbClient
    this.llmLogCollection = llmLogCollection
  }

  static async build(
    scope: Scope,
    mongoAddress: string,
    database: string
  ): Promise<LlmModelClient> {
    const mongoClient = await new mongodb.MongoClient(mongoAddress, {
      appName: "base-nli",
    }).connect()
    scope.onLeave(async () => {
      await mongoClient.close()
    })
    const mongoDbClient = new MongoDbClient(mongoClient, database, "")
    const llmLogCollection = mongoDbClient.accessCollection(
      "llm-log",
      llmLogDocType
    )
    return new LlmModelClient(mongoClient, mongoDbClient, llmLogCollection)
  }
}

export async function buildLlmCompletionLogger(
  modelClient: LlmModelClient,
  model: string
): Promise<(scope: Scope, completionLog: LlmCompletionLog) => Promise<void>> {
  return async (scope: Scope, completionLog) => {
    await modelClient.llmLogCollection.createIfNotExists(scope, {
      _id: stringRandomSimpleName(16),
      model,
      completion: completionLog,
    })
  }
}
