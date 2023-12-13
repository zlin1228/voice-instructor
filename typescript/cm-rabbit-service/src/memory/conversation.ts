import { EmbeddingClient } from "base-nli/lib/embedding/client.js"
import { MilvusClient, InsertReq, DataType } from "@zilliz/milvus2-sdk-node"
import {
    Scope,
    launchBackgroundScope,
    ScopeAttachment,
    HandlingQueue,
} from "base-core/lib/scope.js"
import { UserStorage } from "../model.js"
import { ModelClient } from "../model.js"
import {
    sleepSeconds,
    TimeoutError,
    checkAndGetCancelToken,
} from "base-core/lib/scope.js"

export type MemoryRecord = {
    text: string,
    id: string,
    timestamp: number,
}

export async function addToConversationMemory(
    scope: Scope, userDoc: UserStorage, userId: string,
    language: string, milvusCollectionName: string, modelClient: ModelClient,
    embeddingClient: EmbeddingClient | null, vectorDBClient: MilvusClient | null, memory: Array<string>): Promise<void> {

    while (vectorDBClient == null || embeddingClient == null) {
        console.log("vectorDBClient or embeddingClient is null, waiting for 0.2 seconds...")
        await sleepSeconds(scope, 0.2)
    }

    const embeddings = await embeddingClient.embed(scope, {
        input: memory,
        userId: userId,
    })
    if (embeddings?.embeddings[0] != undefined) {
        console.log("Adding to milvus...")
        // increase ord and write to DB
        const userDoc_ = {
            _id: userDoc._id,
            ord: userDoc?.ord + 1,
        }
        await modelClient.userStorageCollections
            .get(language)
            ?.bulkMergeFields(scope, [userDoc_])
        // add to milvus
        const insertReq: InsertReq = {
            collection_name: milvusCollectionName,
            fields_data: embeddings?.embeddings.map((embedding: any, i: number) => {
                return {
                    vector: embedding.embedding,
                    text: memory[i],
                    timestamp: Date.now(),
                    ord: userDoc?.ord ?? 0,
                    userId: userId,
                }
            })
        }
        const insertRes = await vectorDBClient?.insert(insertReq)
        // console.log("insertRes: ", insertRes)
    } else {
        console.log("embeddings is null or empty")
    }
}

export async function retrieveRecentConversationMemory(
    scope: Scope, userDoc: UserStorage, k: number,
    vectorDBClient: MilvusClient | null,
    userId: string, milvusCollectionName: string,
): Promise<Array<MemoryRecord>> {
    while (vectorDBClient == null) {
        console.log("vectorDBClient is null, waiting for 0.2 seconds...")
        await sleepSeconds(scope, 0.2)
    }

    var currentOrdinal = userDoc?.ord ?? 0
    var searchOrdinal = currentOrdinal - k > 0 ? currentOrdinal - k : 0
    const search = await vectorDBClient?.query({
        collection_name: milvusCollectionName,
        expr: `userId == "${userId}" && ord > ${searchOrdinal}`,
        output_fields: ["text", "timestamp", "id"],
        limit: k,
    });

    var context = search?.data.map((result) => {
        return {
            text: result['text'],
            id: result['id'],
            timestamp: result['timestamp'],
        }
    })

    return context ?? []
}


export async function retrieveConversationMemory(
    scope: Scope, query: string, k: number,
    embeddingClient: EmbeddingClient | null, vectorDBClient: MilvusClient | null,
    userId: string, milvusCollectionName: string,
): Promise<Array<MemoryRecord>> {
    while (vectorDBClient == null || embeddingClient == null) {
        console.log("vectorDBClient or embeddingClient is null, waiting for 0.2 seconds...")
        await sleepSeconds(scope, 0.2)
    }

    const startTime = Date.now()
    const embeddings = await embeddingClient?.embed(scope, {
        input: [query],
        userId: userId,
    })
    const endTime = Date.now()
    console.log("Embedding created, time elapsed: ", endTime - startTime)

    if (embeddings?.embeddings[0] != undefined) {
        // search in vector DB
        const queryEmbedding = [...embeddings?.embeddings[0].embedding];
        console.log("Searching in milvus...")
        const search = await vectorDBClient?.search({
            collection_name: milvusCollectionName,
            vector: queryEmbedding,
            filter: `userId == "${userId}"`,
            output_fields: ["text", "timestamp", "id"],
            limit: k,
        });
        console.log("vector DB search: ", search.results.length);

        var context = search?.results.map((result) => {
            return {
                text: result['text'],
                id: result['id'],
                timestamp: result['timestamp'],
            }
        })

        const endTime2 = Date.now()
        console.log("Search completed, time elapsed: ", endTime2 - endTime)

        return context ?? []
    } else {
        console.log("embeddings is null or empty")
        return []
    }
    
}