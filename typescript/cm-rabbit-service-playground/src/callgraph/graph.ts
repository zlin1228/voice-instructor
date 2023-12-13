import { ChatMessage } from "../kernel/chat.js"
import { ModelClient } from "../model.js"
import {
    Scope,
    launchBackgroundScope,
} from "base-core/lib/scope.js"
import { internalKnowledge } from "../kernel/internal-knowledge.js";
import {
    OpenAiLlmClient
} from "base-nli/lib/llm/openai.js"
import { retrieveRelevantBunnies } from "./registry.js"
import { InstructClient } from "base-nli/lib/instruct/client.js"
import { randomUUID } from "node:crypto";
import { UserStorage } from "../model.js";
import { getUserDocCreateIfNotExist } from "../kernel/kernel-common.js";
export interface CallgraphNode {
    _id: number;
    action: string;
    value: string;
}

export interface CallgraphEdge {
    _id: number;
    from: number;
    to: number;
}

export interface CallgraphExecutionStep {
    nodes: CallgraphNode[];
}

export interface CallgraphExecutionSchedule {
    steps: CallgraphExecutionStep[];
}

export interface CallgraphSharedParameter {
    languageCode: string;
    question: string;
    context: string;
    previousResponse: string;
    timeZone: string;
}

export interface CallgraphInitialConfig {
    languageCode: string;
    context: string;
}

export const callgraphPrompt = (languageCode: string, query: string) => `You are an intelligent reasoning computer assisting to user needs expressed as natural language requests.

You also have a conversational plugin that you don't have access to, so user needs may be handled by that plugin already. Therefore, you only work with requests that need functions to be satisfied.

You understand many languages.

Call a function given Context, Message, and Conversational Plugin Response. YOU MUST CALL A FUNCTION.

If the Conversational Plugin Response indicates that the assistant agrees to perform certain actions, you MUST do so. Your result must be consistent with the Conversational Plugin Response.

If the Conversational Plugin Response is empty or contains irrelevant information, you MUST rely on Message to determine what to do.

If the user asks for arithmetic or mathematical operations, use search.

If no functions suits the scenario, simply use No-op().

Try to use search instead of referring to context.

When the user wants to listen to something or asks for something, don't use search. Use play_music instead.

When the user wants to pause, resume, or skip, or play the next or previous song, do not use No-op().

When the user has not provided sufficient context for their query, do not fill in with identifiers such as "[location]", instead, use No-op().

When the user asks for the current time, do not search for the weather instead. Your conversational plugin has access to the current time and it has already handled that. Therefore, use No-op().

However, if the user would like to know the time in a different location, or time zone, you should use search instead. Do not use search if the user is just asking for the current time with no location or time zone specified.

If the Conversational Plugin Response merely asks for permission to perform an action, do not perform the action. For example, if the user says an irrelevant message and the Conversational Plugin Response is "I'm not sure, what do you want to have for dinner?", you should not perform the action "change_voice" or "change_user_name" or "change_assistant_name" or "clear_history" or "play_music" or "play_liked_song" or "search". Instead, you should use No-op().

----------------- IMPORTANT -----------------
Here are the internal knowledge you have:
${internalKnowledge(query)}
If the the Message relates to information contained in the internal knowledge, you MUST not search for it. Instead, you should use No-op().
----------------- IMPORTANT -----------------
`.trim()

const emptyCallgraphExecutionSchedule: CallgraphExecutionSchedule = {
    steps: [],
};

export function isScheduleSingleton(schedule: CallgraphExecutionSchedule): boolean {
    return schedule.steps.length === 1 && schedule.steps[0] !== undefined && schedule.steps[0].nodes.length === 1;
}

export function extractSingetonNode(schedule: CallgraphExecutionSchedule): CallgraphNode {
    if (isScheduleSingleton(schedule)) {
        if (schedule.steps[0] !== undefined && schedule.steps[0].nodes[0] !== undefined) {
            return schedule.steps[0].nodes[0];
        } else {
            throw new Error("Schedule is not a singleton");
        }
    } else {
        throw new Error("Schedule is not a singleton");
    }
}

function parseFunctionCall(functionCall: string): { _id: number, action: string, value: string } {
    // extract the function number, function name, and function arguments
    // function_number. function_name(arguments)
    console.log(
        "Parsing function call: ",
        functionCall
    )
    const responseMatch: any = functionCall.match(/(?<id>\d+)\.\s*(?<name>\w+)\((?<arguments>.*)\)/i)?.groups ?? null;
    console.log("Response match: ", responseMatch)
    const response = {
        _id: parseInt(responseMatch?.id.trim() ?? "-1"),
        action: responseMatch?.name.trim() ?? "",
        value: responseMatch?.arguments.trim() ?? ""
    }

    return response;
}

function parseFunctionDeps(deps: string): CallgraphEdge[] {
    const edges: CallgraphEdge[] = [];
    const lines = deps.split("\n");
    for (const line of lines) {
        const edgeMatch: any = line.match(/(?<from>\w+)\s*->\s*(?<to>\w+)/i)?.groups ?? null;
        const edge = {
            _id: edges.length + 1,
            from: parseInt(edgeMatch?.from.trim() ?? "-1"),
            to: parseInt(edgeMatch?.to.trim() ?? "-1"),
        }
        edges.push(edge);
    }
    return edges;
}

export async function synthesizeCallgraph(
    question: string,
    previousResponse: string,
    modelClient: ModelClient,
    userId: string,
    scope: Scope,
    language: string,
    llmClient: OpenAiLlmClient,
    instructClient: InstructClient,
    config: CallgraphInitialConfig,
): Promise<CallgraphExecutionSchedule> {
    if (question.length < 2) {
        return emptyCallgraphExecutionSchedule;
    }

    const functionBank = retrieveRelevantBunnies(question, language);
    const determineReflection = `
Here is the relationship between your actions and the Conversational Plugin Response:

Remember, the Conversational Plugin Response is not capable of doing anything. Therefore, when it says that it is doing something, it is actually asking you to do it.
 - For example, if the Conversational Plugin Response says "I'm playing music", it is asking you to play music.
 - Another example is if the Conversational Plugin Response says "let me look it up for you", it is asking you to use search, even if it is common sense.
 - Similarly, when the Conversational Plugin Response says "I'm thinking", it is asking you to use internal_reasoning.
 - If the Conversational Plugin Response already answers the question or refuses to answer the question, that's when you should use No-op().

There are two types of user requests: ephemeral ones and persistent ones.

Ephemeral requests are requests that needs to be executed every time the user asks, regardless of what's in the context. If the Conversational Plugin Response indicates that the action is being performed, what is implied is for you to call the action. Therefore, you must call the action instead of a no-op.
 - For example, if the user asks to play music, you should play music every single time, even if the user has already asked to play music before.
Recurrent requests are requests whose answers can be re-used up to a day. If the answer is already in the context and Conversational Plugin Response and is fresh enough, you should not execute the request again unless the user strongly indicates that they want to do so.

Here are some examples of ephemeral requests:

play_music, play_liked_song, change_voice, change_user_name, change_assistant_name, change_assistant_prompt, clear_history, internal_reasoning

Here are some examples of recurrent requests:

weather, stock_price, search

1. Search is only used then the user explicity asks a question and the Conversational Plugin Response explicitly says that it is working on finding an answer. This works both ways: if the Conversational Plugin Response indicates that it is working on finding an answer, you must use search, even if the user has already asked the same question before. On the flipside, if the user asks a question and the Conversational Plugin Response does not indicate that it is working on finding an answer, or says that it doesn't know, or doesn't have access to certain information, you must not use search.  
2. Is the user message even a question or an request? If it's not, and the user is just chatting with the assistant, you shouldn't use a function.
3. If the user is explicily making a command, you should consider one of the non-search functions.
4. If the Conversational Plugin Response has already referenced internal knowledge or come up with an answer, you shouldn't use search.
5. Is the user asking to clear history? If so, you should use clear_history every single time, even if the Conversational Plugin Response confirms that it is cleared. 
6. A user message that starts with "play ..." or "listen to ..." should use play_music, as the user is issuing a command to play music.
7. Is the user message containing obscure references like "what about him", "what is that"? If so, your arguments should combine information from both the context and the message. Remember, the functions you call has no access to the context or the Conversational Plugin Response.
8. If the arguments in the search function cannot be determined before hand, use a natural language description to describe what it needs to depend on.
 - For example, if the user request is "Search for the weather in New York, and search for a similar movie to the weather," the arguments for the search function should be "weather in new york" and "similar movie to [the return value of the search function with id 1. of weather in new york]".
`.trim()

    const determineMessages: ChatMessage[] = [
        { role: 'system', content: callgraphPrompt(config.languageCode, question) },
        {
            role: 'user',
            content: `
Here are the functions you can use:

------ Begins Function Bank ------            
${JSON.stringify(functionBank, null, 2)}
------ Ends Function Bank ------

Now, the user has posted a message. You now would need to determine what action to take.
Here are the information you have:

1. Relevant Context: 
------ Begins Relevant Context ------            
${config.context}
------ Ends Relevant Context ------

2. Message /* This is user's message */ : ${question}
3. Conversational Plugin Response /* This is what the weak conversational engine responded to the user shortly before. You need to reconcile with this. */ : ${previousResponse}

Before you attempt to answer, reflect (from most important to least important):

------ Begins Reflection ------
${determineReflection}
------ Ends Reflection ------

Overall, be very conservative in using any function calls, especially search.

Post your reflections first, in two sentences, and determine if you need to call a function at all. Answer true if you need to call a function, and false if you don't need to call a function. If the answer is true, continue with the function calls and dependencies. If the answer is false, you can skip the function calls and dependencies.

First, list all functions you need to call, each with the format of function_number. function_name(arguments), one per line.
Then, list out the dependencies between the functions, each with the format of function_number1 -> function_number2, one per line. There should be no cycles in the dependency graph.

Here's an example of a valid response, with two function calls and one dependency:

Reflection: [reflection]
Answer: [true/false]
Function calls:
1. function_name1(arguments)
2. function_name2(arguments)
Function dependencies:
1 -> 2`
        },
    ];

    const synthesisResponse = await llmClient.openAiChatCompletion(scope, {
        messages: determineMessages,
        stopSequences: [],
        temperature0to1: 0,
        maxTokens: 1024,
    })

    console.log("Synthesized callgraph: ", synthesisResponse)

    if (!synthesisResponse.match(/true/i)) {
        console.log("WARNING: No function calls needed, returning empty callgraph")
        return emptyCallgraphExecutionSchedule;
    }

    // functionCalls is the string between "Function calls:" and "Function dependencies:"
    var functionCalls = synthesisResponse.match(/Function calls:(.|\n)*Function dependencies:*/)?.[0] ?? "";
    // functionDeps is the string after "Function dependencies:"
    var functionDeps = synthesisResponse.match(/Function dependencies:\s*([\s\S]+)/)?.[0] ?? "";

    if (functionCalls === "") {
        functionCalls = synthesisResponse.match(/Function calls:\s*([\s\S]+)/)?.[0] ?? "";
    }

    // remove "Function calls:" and "Function dependencies:"
    functionCalls = functionCalls.replace("Function calls:", "").replace("Function dependencies:", "");
    functionDeps = functionDeps.replace("Function calls:", "").replace("Function dependencies:", "");

    console.log("---------------------")
    console.log("Function calls: ", functionCalls)
    console.log("Function deps: ", functionDeps)
    console.log("---------------------")

    var nodes = functionCalls.split("\n").map((x) => x.trim()).filter((x) => x !== "").map((x) => parseFunctionCall(x));
    var edges = parseFunctionDeps(functionDeps);

    //console.log("Nodes: ", nodes)
    //console.log("Edges: ", edges)

    // filter out nodes that are equal to -1, or not in the function bank
    nodes = nodes.filter((node) => node._id !== -1 && functionBank.map((x) => x.name).includes(node.action));

    // make sure that edges start with a node that is in nodes and end with a node that is in nodes
    edges = edges.filter((edge) => nodes.map((x) => x._id).includes(edge.from) && nodes.map((x) => x._id).includes(edge.to));

    // create graph from nodes and edges
    const graph = {
        nodes: nodes,
        edges: edges,
    }

    console.log("Graph: ", graph)

    // if there are no nodes, return empty callgraph
    if (nodes.length === 0 || graph.nodes[0] === undefined) {
        console.log("WARNING: No nodes in callgraph");
        return emptyCallgraphExecutionSchedule;
    }

    var schedule: CallgraphExecutionStep[] = [];

    // Case 1: there are no edges, just schedule all nodes in parallel
    if (edges.length === 0) {
        console.log("WARNING: No edges in callgraph")
        // assume that there are no dependencies and schedule all nodes in parallel
        // for better performance, each schedule runs 3 nodes in parallel
        const steps = [];
        for (var i = 0; i < graph.nodes.length; i += 3) {
            steps.push({
                nodes: graph.nodes.slice(i, i + 3)
            })
        }
        schedule = steps;
    }
    // Case 2: determine if the graph is a DAG
    else {
        var isDAG = true;
        // assert that the graph is a DAG
        const visited = new Set<number>();
        const stack = [graph.nodes[0]._id];
        while (stack.length > 0) {
            const node = stack.pop();
            if (node !== undefined) {
                visited.add(node);
                const children = graph.edges.filter((edge) => edge.from === node).map((edge) => edge.to);
                for (const child of children) {
                    if (visited.has(child)) {
                        console.log("WARNING: Graph is not a DAG");
                        isDAG = false;
                        break;
                    }
                    stack.push(child);
                }
            }
            if (!isDAG) {
                break;
            }
        }
        // if the graph is not a DAG, ignore the dependencies and schedule all nodes in parallel
        if (!isDAG) {
            console.log("WARNING: Graph is not a DAG")
            const steps = [];
            for (var i = 0; i < graph.nodes.length; i += 3) {
                steps.push({
                    nodes: graph.nodes.slice(i, i + 3)
                })
            }
            schedule = steps;
        } else {
            console.log("INFO: Graph is a DAG")
            // create the execution schedule: pop nodes that have zero in-degree, then update the in-degree of the children
            // repeat until all nodes are scheduled
            // TODO (Peiyuan): need to check if this is correct
            var inDegree = new Map<number, number>();
            for (const node of graph.nodes) {
                inDegree.set(node._id, 0);
            }
            for (const edge of graph.edges) {
                if (inDegree.get(edge.to) === undefined) {
                    inDegree.set(edge.to, 0);
                }
                var val = inDegree.get(edge.to) ?? 0;
                inDegree.set(edge.to, val + 1);
            }
            console.log("In-degree: ", inDegree)
            while (inDegree.size > 0) {
                const step: CallgraphExecutionStep = {
                    nodes: []
                }
                // obtain a copy of inDegree
                var inDegreeCopy = new Map<number, number>();
                for (const [key, value] of inDegree) {
                    inDegreeCopy.set(key, value);
                }
                for (const node of graph.nodes) {
                    if (inDegree.get(node._id) === 0) {
                        step.nodes.push(node);
                        inDegreeCopy.delete(node._id);
                        for (const edge of graph.edges) {
                            if (edge.from === node._id) {
                                var val = inDegreeCopy.get(edge.to) ?? 0;
                                inDegreeCopy.set(edge.to, val - 1);
                            }
                        }
                    }
                }
                schedule.push(step);
                inDegree = inDegreeCopy;
            }
        }
    }

    // Store the callgraph in the database
    `
    {
        name: "nodes", type: arrayType(callgraphNodeType)
    },
    {
        name: "edges", type: arrayType(objectType([
            { name: "from", type: int32Type },
            { name: "to", type: int32Type },
        ]))
    },
    export const callgraphNodeType = objectType([
        { name: "nodeId", type: int32Type },
        { name: "bunnyName", type: stringType },
        { name: "bunnyId", type: stringType },
        { name: "bunnyArgs", type: stringType },
    ])
    `
    const callgraphSchedule = {
        steps: schedule
    }

    console.log("Callgraph schedule: ", schedule.map((step) => step.nodes.map((node) => node._id)))

    const scheduleInDB = schedule.map((step) => step.nodes.map((node) => node._id));
    const callgraph = {
        nodes: nodes.map((node: any) => ({
            nodeId: node._id,
            bunnyName: node.action,
            bunnyId: randomUUID().toString(), // TODO (Peiyuan): Get bunny ID from registry
            bunnyArgs: node.value,
        })),
        edges: edges.map((edge) => ({
            from: edge.from,
            to: edge.to,
        })),
        schedule: scheduleInDB,
        current_step: 0,
    }
    var userDoc: UserStorage = await getUserDocCreateIfNotExist(scope, modelClient, language, userId);
    const userDoc_ = { _id: userDoc._id, current_callgraph: callgraph, shared_callgraph_output: [] }
    await modelClient.userStorageCollections
        .get(language)
        ?.bulkMergeFields(scope, [userDoc_])

    return callgraphSchedule;

}


export function clearCallgraph(
    scope: Scope, modelClient: ModelClient, userId: string, language: string
) {
    launchBackgroundScope(scope, async (scope: Scope) => {
        const callgraph = {
            nodes: [],
            edges: [],
            schedule: [],
            current_step: -1,
        }
        var userDoc: UserStorage = await getUserDocCreateIfNotExist(scope, modelClient, language, userId);
        const userDoc_ = { _id: userDoc._id, current_callgraph: callgraph, shared_callgraph_output: [] }
        await modelClient.userStorageCollections
            .get(language)
            ?.bulkMergeFields(scope, [userDoc_])
    })
}

export async function clearCallgraphAsync(
    scope: Scope, modelClient: ModelClient, userId: string, language: string
) {
    const callgraph = {
        nodes: [],
        edges: [],
        schedule: [],
        current_step: -1,
    }
    var userDoc: UserStorage = await getUserDocCreateIfNotExist(scope, modelClient, language, userId);
    const userDoc_ = { _id: userDoc._id, current_callgraph: callgraph, shared_callgraph_output: [] }
    await modelClient.userStorageCollections
        .get(language)
        ?.bulkMergeFields(scope, [userDoc_])
}