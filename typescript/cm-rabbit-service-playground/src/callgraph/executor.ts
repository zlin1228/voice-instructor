import { ModelClient } from "../model.js"
import {
    Scope,
    ScopeAttachment,
    runParallelScopes,
    launchBackgroundScope,
} from "base-core/lib/scope.js"
import {
    OpenAiLlmClient
} from "base-nli/lib/llm/openai.js"
import { CallgraphNode, CallgraphExecutionStep, CallgraphSharedParameter } from "./graph.js"
import { randomUUID } from "crypto"
import { runCoreBunny } from "./bunnies/core.js";
import { runNonExecutableBunny } from "./bunnies/non-executable.js";
import { InstructClient } from "base-nli/lib/instruct/client.js"
import { MilvusClient } from "@zilliz/milvus2-sdk-node"
import { Kernel } from "../kernel/kernel.js";
import { runSpotifyBunny } from "./bunnies/spotify.js";
import { retrieveRecentBunnyCallMemory } from "../memory/bunny.js";
import {
    getUserDocCreateIfNotExist,
    wavToRaw,
} from "../kernel/kernel-common.js"

const coreBunny = [
    "internal_reasoning",
    "conversation",
    "search",
    "play_music",
    "play_liked_song"
];

const nonExecutableBunny = [
    "change_voice",
    "change_user_name",
    "change_assistant_name",
    "change_assistant_prompt",
    "clear_history",
]


export async function executeCallgraphSingleton(
    node: CallgraphNode, language: string, modelClient: ModelClient,
    salientMemory: { current: string[] }, GPT4llmClient: OpenAiLlmClient, GPT35llmClient: OpenAiLlmClient,
    instructClient: InstructClient, vectorDBClient: MilvusClient, milvusCollectionName: string,
    attachment: ScopeAttachment, userId: string, sharedParameter: CallgraphSharedParameter,
): Promise<void> {

    await Scope.with(undefined, [attachment], async (_scope: Scope) => {

        const recentBunnyCalls = await retrieveRecentBunnyCallMemory(_scope, userId, modelClient)

        if (coreBunny.includes(node.action)) {
            await runCoreBunny(
                randomUUID().toString(),
                node.action,
                node.value,
                modelClient,
                userId,
                _scope,
                language,
                GPT4llmClient,
                GPT35llmClient,
                instructClient,
                sharedParameter,
                node._id
            )
        }
        else if (nonExecutableBunny.includes(node.action)) {
            await runNonExecutableBunny(
                randomUUID().toString(),
                node.action,
                node.value,
                modelClient,
                userId,
                _scope,
                language,
                instructClient,
                vectorDBClient,
                milvusCollectionName,
            )
        } else {
            console.log("Error: unknown bunny: ", node.action)
        }
        return
    })
}

export async function executeCallgraphScheduleStep(
    step: CallgraphExecutionStep, language: string, modelClient: ModelClient,
    salientMemory: { current: string[] }, GPT4llmClient: OpenAiLlmClient, GPT35llmClient: OpenAiLlmClient,
    instructClient: InstructClient, vectorDBClient: MilvusClient, milvusCollectionName: string,
    attachment: ScopeAttachment, userId: string,
    sharedParameter: CallgraphSharedParameter, kernel: Kernel,
): Promise<void> {
    try {
        await Scope.with(undefined, [], async (_scope: Scope) => {
            try {
                await runParallelScopes(
                    _scope,
                    step.nodes.map((node) => async (scope: Scope) => {
                        if (node.action === "play_music" || node.action === "play_liked_song") {
                            await runSpotifyBunny(kernel, node, scope)
                        }
                        else if (coreBunny.includes(node.action)) {
                            await runCoreBunny(
                                randomUUID().toString(),
                                node.action,
                                node.value,
                                modelClient,
                                userId,
                                _scope,
                                language,
                                GPT4llmClient,
                                GPT35llmClient,
                                instructClient,
                                sharedParameter,
                                node._id
                            )
                        }
                        else if (nonExecutableBunny.includes(node.action)) {
                            await runNonExecutableBunny(
                                randomUUID().toString(),
                                node.action,
                                node.value,
                                modelClient,
                                userId,
                                _scope,
                                language,
                                instructClient,
                                vectorDBClient,
                                milvusCollectionName,
                            )
                        } else {
                            console.log("Error: unknown bunny: ", node.action)
                        }
                        return
                    })
                )
            } catch (error) {
                console.log("Error: ", error)
            }
            return
        })
    } catch (error) {
        console.log("Error: ", error)
    }

}


export function kernelRunCallgraphScheduleStep(scope: Scope, attachment: ScopeAttachment, step: CallgraphExecutionStep, kernel: Kernel) {
    launchBackgroundScope(scope, async (scope: Scope) => {

        if (kernel.milvusClient === null || kernel.sharedParameter === null || kernel.openAiGPT4LlmClient === null || kernel.openAiInstructClient === null || kernel.openAillmClient === null) {
            console.log("kernel not ready. Skipping...")
            return
        }

        try {
            await executeCallgraphScheduleStep(
                step, kernel.language, kernel.modelClient,
                { current: kernel.salientMemory }, kernel.openAiGPT4LlmClient, kernel.openAillmClient,
                kernel.openAiInstructClient, kernel.milvusClient, kernel.milvusCollectionName,
                attachment, kernel.userId, kernel.sharedParameter, kernel
            )
        } catch (error) {
            console.log("Error: ", error)
        }

        // advance step by 1
        const userDoc = await getUserDocCreateIfNotExist(
            scope,
            kernel.modelClient,
            kernel.language,
            kernel.userId
        )
        const userDoc_ = {
            _id: userDoc._id,
            current_callgraph: {
                ...userDoc.current_callgraph,
                current_step: userDoc.current_callgraph.current_step + 1
            }
        }
        await kernel.modelClient.userStorageCollections
            .get(kernel.language)
            ?.bulkMergeFields(scope, [userDoc_])

    })
}