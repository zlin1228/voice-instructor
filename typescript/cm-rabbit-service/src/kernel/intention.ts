import {
    InstructClient,
} from "base-nli/lib/instruct/client.js"
import { ChatFragment, ChatMessage } from "../conversation/chat.js"
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

    const prompt = `Analyze human intentions: User reports the current intention (could be empty) and a natural language query. 
Assess whether the new query alters the intention, enriches it, or replaces it with a new one. Respond directly with the updated intention. 

Guidelines:
1. If the new query lacks the context or is irrelevant, and cannot be deduced even from past conversations, do not alter the intention.
2. If the new query is dramatically different from the current intention, replace the intention with the new query.
3. If the new query is an additional request, enrich the intention with the new query.
4. New Intention should be from a first-person perspective of the user, such as "I ...". 
5. Current intention could be empty.

Relevant past conversations between the user and the assistant to help better understand the user's intention in case the query may be ambiguous:
${salientMemory.join("\n")}

Ignore the satisfied intention in the past conversations, and only focus on the unsatisfied intention.

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

    const prompt = `Analyze human intentions and how they are satisfied. 
    
Step 1. User reports the current intention (could be empty) and an assistant response that satisfies part of, or the entirety of the intention. 
Step 2. Determine which part of the user intention, if any, is currently satisfied by the assistant response, and remove the intention by returning only the outstanding parts. 
Step 3. If the assistant response does not satisfy any part of the intention, return NOT_CHANGED.

Guidelines:
1. User's intention is either fully satisfied, partially satisfied, or unsatisfied. It is never altered.
2. Only assess the assistant response's immediate effect on the intention. Do not speculate on the future.
3. If the assistant response fully satisfies the intention, return EMPTY. If it partially satisfies the intention, return the unsatisfied part of the intention. If it does not satisfy the intention, return the entire intention.
4. Do not assume user's intention, and do not produce vague intentions. For example, new intention should never be "I want assistance with something else".
5. When the assistant response is similar to one of the following, use NOT_CHANGED:

    - Purely conversational or irrelevant.
    - Thinking. Example: Current intention: I want to know more about the Fermi paradox. Assistant response: I am thinking. New intention: NOT_CHANGED
    - Working on it. Example: Current intention: I want to know more about the Fermi paradox. Assistant response: I am working on it. New intention: NOT_CHANGED
    - Finding an answer. Example: Current intention: I want to know more about the Fermi paradox. Assistant response: Let me look it up for you. New intention: NOT_CHANGED
    - Uncertainty or asks for permission. Example: Current intention: I want to know more about the Fermi paradox. Assistant response: I am not sure, would you like me to look it up for you? New intention: NOT_CHANGED
    - Says explicitly "I am working on it," "I will look it up," or a variation of it. Example: Current intention: I want to know more about the Fermi paradox. Assistant response: I will look it up for you. New intention: NOT_CHANGED

6. New Intention, if not empty, should be from a first-person perspective of the user, such as "I ...".
7. Make clear distiction between the assistant's intention and the user's intention. For example, if the assistant asks a question, do not include the question in the new intention. 
8. DO NOT INFER MORE INTENTION FROM THE USER if the assistant's response fully satisfies the intention. Output EMPTY. DO NOT SPECULATE.
9. User intention is never changed into "I want to know more." Example: Current intention: I want to know more about the Fermi paradox. Assistant response: The Fermi paradox is the apparent contradiction between the lack of evidence for extraterrestrial civilizations and various high estimates for their probability. New intention: EMPTY

Relevant past conversations between the user and the assistant to help better understand the user's intention in case the query may be ambiguous:
${salientMemory.join("\n")}

Ignore the satisfied intention in the past conversations, and only focus on the unsatisfied intention.

Current intention: ${currentIntention}.
Assistant response: ${assistantResponse}

Think step by step:
1. Does it match one of the NOT_CHANGED cases? If so, return NOT_CHANGED.
2. Does the assistant say "I will" or "I'm working on it," or something similar? If so, return NOT_CHANGED.
3. Does it fully satisfy the intention? If so, return EMPTY.
4. Does it partially satisfy the intention? If so, return the unsatisfied part of the intention.
5. If it does not satisfy the intention? If so, return NOT_CHANGED.

Return your thinking, step by step, first in Reflection, then return the new intention in New Intention.


Reflection:

1. `

    const response: string = (await llmClient.completion(scope, {
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

        if (newIntention === "NOT_CHANGED") {
            console.log("Intention not changed.")
            newIntention = currentIntention
        } else {
            console.log("Intention changed, writing back to userDoc.")
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

    const prompt = `Analyze human intentions: User reports the current intention (could be empty) and an algorithmic response attempting to satisfy part of, or the entirety of the intention. 
Assess which part of the user intention is removed by the algorithmic response, and return the new intention containing only the remaining parts. 

Guidelines:
1. User's intention is either fully satisfied or partially satisfied. At least remove some part of the intention.
2. If the algorithmic response fully satisfies the intention, return EMPTY. If it partially satisfies the intention, return the unsatisfied part of the intention.
3. Do not assume user's intention, and do not produce vague intentions. For example, new intention should never be "I want assistance with something else".
4. New Intention, if not empty, should be from a first-person perspective of the user, such as "I ...".
5. Do not change on the user's intention, so do not fill in with intentions that are follow-up questions, and do not change the intention into "I want to know more." 
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