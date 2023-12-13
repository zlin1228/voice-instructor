import {
    InstructClient,
} from "base-nli/lib/instruct/client.js"
import { ChatFragment, ChatMessage } from "./chat.js"
import {
    Scope,
    launchBackgroundScope,
    sleepSeconds,
} from "base-core/lib/scope.js"
import { ModelClient } from "../model.js"

export async function clearOutstandingIntention(scope: Scope,
    modelClient: ModelClient, userId: string): Promise<void> {
    const userDoc = await modelClient.userStorageCollections
        .get("en")
        ?.getById(scope, userId)
    if (userDoc === undefined) {
        console.log("Warning: userDoc is null")
        return
    }
    const newUserDoc = {
        _id: userDoc._id,
        current_intention: "",
    }
    await modelClient.userStorageCollections
        .get("en")
        ?.bulkMergeFields(scope, [newUserDoc])
    console.log("clearOutstandingIntention: cleared.")
    return
}

export async function updateIntentionByUserUtterance(scope: Scope,
    modelClient: ModelClient, llmClient: InstructClient,
    userId: string, utterance: string, salientMemory: string[]): Promise<string> {
    const userDoc = await modelClient.userStorageCollections
        .get("en")
        ?.getById(scope, userId)
    if (userDoc === undefined) {
        console.log("Warning: userDoc is null")
        return ""
    }

    const currentIntention = userDoc.current_intention ?? ""

    const prompt = `You are an algorithm analyzing human intentions. User reports the current intention (could be empty) and a natural language query. 
You need to assess whether the new query alters the intention, enriches it, or replaces it with a new one. Respond directly with the updated intention. 

Here are some guidelines:
1. If the new query lacks the context or is irrelevant, and cannot be deduced even from past conversations, do not alter the intention.
2. If the new query is dramatically different from the current intention, replace the intention with the new query.
3. If the new query is an additional request, enrich the intention with the new query.
4. New Intention should be from a first-person perspective of the user, such as "I ...". 
5. Current intention could be empty.

Here are some relevant past conversations between the user and the assistant to help you better understand the user's intention in case the query may be ambiguous:
${salientMemory.join("\n")}

You must ignore the satisfied intention in the past conversations, and only focus on the unsatisfied intention.

Current intention: ${currentIntention}.
Query: ${utterance}

New Intention:`

    const response: string = "New Intention:" + (await llmClient.completion(scope, {
        prompt: prompt,
        stopSequences: [],
        temperature0to1: 0,
        maxTokens: 512,
    }))

    var newIntention = ""
    console.log("updateIntentionByUserUtterance: ", response)
    // find the string after "New Intention: "
    try {
        newIntention = response.split("New Intention:")[1]?.trimStart() ?? ""
        // write back to userDoc
        if (newIntention !== "") {
            const newUserDoc = {
                _id: userDoc._id,
                current_intention: newIntention,
            }
            await modelClient.userStorageCollections
                .get("en")
                ?.bulkMergeFields(scope, [newUserDoc])
        }
    }
    catch (error) {
        console.log("Error: ", error)
    }

    return newIntention
}

export async function updateIntentionByAssistantResponse(
    scope: Scope, modelClient: ModelClient, llmClient: InstructClient,
    userId: string, assistantResponse: string, salientMemory: string[]): Promise<string> {
    const userDoc = await modelClient.userStorageCollections
        .get("en")
        ?.getById(scope, userId)
    if (userDoc === undefined) {
        console.log("Warning: userDoc is null")
        return ""
    }

    const currentIntention = userDoc.current_intention ?? ""

    const prompt = `You are an algorithm analyzing human intentions. User reports the current intention (could be empty) and an assistant response attempting to satisfy part of, or the entirety of the intention. 
You need to assess which part of the user intention, if any, is removed by the assistant response, and prune the intention by returning only the outstanding, unsatisfied parts. 

Here are some guidelines:
1. User's intention is either fully satisfied, partially satisfied, or unsatisfied. It is never altered.
2. If the assistant response fully satisfies the intention, return EMPTY. If it partially satisfies the intention, return the unsatisfied part of the intention. If it does not satisfy the intention, return the entire intention.
3. If the assistant response is purely conversational or irrelevant, do not alter the intention.
4. Do not assume user's intention, and do not produce vague intentions. For example, your new intention should never be "I want assistance with something else".
5. New Intention, if not empty, should be from a first-person perspective of the user, such as "I ...".
6. Make clear distiction between the assistant's intention and the user's intention. For example, if the assistant asks a question, do not include the question in the new intention. 
7. Your job is not to speculate on the user's intention, so do not fill in with intentions that are follow-up questions. If the answer appears to satisfy the user's intention, try using EMPTY more often.

Here are some relevant past conversations between the user and the assistant to help you better understand the user's intention in case the query may be ambiguous:
${salientMemory.join("\n")}

You must ignore the satisfied intention in the past conversations, and only focus on the unsatisfied intention.

Current intention: ${currentIntention}.
Assistant response: ${assistantResponse}

New Intention:`

    const response: string = "New Intention:" + (await llmClient.completion(scope, {
        prompt: prompt,
        stopSequences: [],
        temperature0to1: 0,
        maxTokens: 512,
    }))

    var newIntention = ""
    console.log("updateIntentionByAssistantResponse: ", response)
    // find the string after "New Intention: "
    try {
        newIntention = response.split("New Intention:")[1]?.trimStart() ?? ""
        // write back to userDoc
        if (newIntention !== "") {
            const newUserDoc = {
                _id: userDoc._id,
                current_intention: newIntention,
            }
            await modelClient.userStorageCollections
                .get("en")
                ?.bulkMergeFields(scope, [newUserDoc])
        }
    }
    catch (error) {
        console.log("Error: ", error)
    }

    return newIntention
}

export async function updateIntentionByRabbitResponse(
    scope: Scope, modelClient: ModelClient, llmClient: InstructClient,
    userId: string, rabbitResponse: string): Promise<string> {
    const userDoc = await modelClient.userStorageCollections
        .get("en")
        ?.getById(scope, userId)
    if (userDoc === undefined) {
        console.log("Warning: userDoc is null")
        return ""
    }

    const currentIntention = userDoc.current_intention ?? ""

    const prompt = `You are an algorithm analyzing human intentions. User reports the current intention (could be empty) and an algorithmic response attempting to satisfy part of, or the entirety of the intention. 
You need to assess which part of the user intention is removed by the algorithmic response, and return the new intention containing only the remaining parts. 

Here are some guidelines:
1. User's intention is either fully satisfied or partially satisfied. You need to at least remove some part of the intention.
2. If the algorithmic response fully satisfies the intention, return EMPTY. If it partially satisfies the intention, return the unsatisfied part of the intention.
3. Do not assume user's intention, and do not produce vague intentions. For example, your new intention should never be "I want assistance with something else".
4. New Intention, if not empty, should be from a first-person perspective of the user, such as "I ...".
5. Your job is not to change on the user's intention, so do not fill in with intentions that are follow-up questions, and do not change the intention into "I want to know more." 
6. If the answer appears to satisfy the user's intention, try using EMPTY more often.

Example:
Current intention: I want to know more about rabbit.
Algorithmic response: rabbit is a startup based in LA, with a mission of revolutionizing human-machine interaction. Their CEO is Jesse Lyu and their CTO is Peiyuan Liao. rabbit os is their first product.
New intention: EMPTY

Reply in the format: 
New Intention:

Current intention: ${currentIntention}.
Algorithmic response: ${rabbitResponse}

New Intention:`

    const response: string = "New Intention:" + (await llmClient.completion(scope, {
        prompt: prompt,
        stopSequences: [],
        temperature0to1: 0,
        maxTokens: 512,
    }))

    var newIntention = ""
    console.log("updateIntentionByRabbitResponse: ", response)
    // find the string after "New Intention: "
    try {
        newIntention = response.split("New Intention:")[1]?.trimStart() ?? ""
        // write back to userDoc
        if (newIntention !== "") {
            const newUserDoc = {
                _id: userDoc._id,
                current_intention: newIntention,
            }
            await modelClient.userStorageCollections
                .get("en")
                ?.bulkMergeFields(scope, [newUserDoc])
        }
    }
    catch (error) {
        console.log("Error: ", error)
    }

    return newIntention
}