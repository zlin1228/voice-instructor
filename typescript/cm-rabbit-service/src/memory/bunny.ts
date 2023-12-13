import {
    Scope,
    launchBackgroundScope,
    ScopeAttachment,
    HandlingQueue,
} from "base-core/lib/scope.js"
import { ModelClient, BunnyStorage } from "../model.js"
import { randomUUID } from "crypto"

export type MemoryRecord = {
    text: string,
    id: string,
    timestamp: number,
}

export async function addToBunnyCallMemory(
    scope: Scope, userId: string,
    modelClient: ModelClient,
    bunnyId: string,
    bunnyName: string,
    bunnyArgs: string,
    bunnyResult: string,
    language: string): Promise<void> {

    await modelClient.bunnyStorageCollection
        .get(language)
        ?.createIfNotExists(scope, {
            _id: randomUUID().toString(),
            userId: userId,
            bunnyId: bunnyId,
            bunnyName: bunnyName,
            bunnyArgs: bunnyArgs,
            bunnyResult: bunnyResult,
            bunnyTimestamp: Date.now(),
        })
}


export async function retrieveRecentBunnyCallMemory(
    scope: Scope, userId: string, modelClient: ModelClient,
): Promise<BunnyStorage[]> {
    const results = await modelClient.bunnyStorageCollection.get("en")?.find(scope, {
        userId: userId,
    })

    if (results == undefined) {
        return []
    }

    console.log("results: ", results);
    
    return [];
}