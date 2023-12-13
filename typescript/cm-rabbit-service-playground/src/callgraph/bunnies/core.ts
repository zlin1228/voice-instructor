import { ChatMessage } from "../../kernel/chat.js"
import { ModelClient, UserStorage } from "../../model.js"
import { LocationBasedGoogleSearchConfig } from "../../kernel/init.js"
import { getLanguageNameFallback } from "../../kernel/language.js"
import { SerpResponse, SerpClient } from "base-serp/lib/serp/client.js"
import { buildScratchSerpClient } from "base-serp/lib/serp/scratch.js"
import { buildSerpAPISerpClient } from "base-serp/lib/serp/serpapi.js"
import {
    Scope,
    launchBackgroundScope,
    sleepSeconds,
} from "base-core/lib/scope.js"
import { internalKnowledge } from "../../kernel/internal-knowledge.js";
import {
    OpenAiLlmClient
} from "base-nli/lib/llm/openai.js"
import { CallgraphSharedParameter } from "../graph.js"
import { synthesizeSERPResponse } from "../nli.js"
import { getUserDocCreateIfNotExist } from "../../kernel/kernel-common.js";
import { formatDateTime } from "../../utils/time.js"
import { InstructClient } from "base-nli/lib/instruct/client.js"
import { addToBunnyCallMemory } from "../../memory/bunny.js";

const serpClient: SerpClient = await buildScratchSerpClient({} as Scope);
const serpApiSerpClient: SerpClient = await buildSerpAPISerpClient({} as Scope);

const serpSearch = async (_scope: Scope, query: string, searchConfig: LocationBasedGoogleSearchConfig): Promise<string> => {

    console.log('Running serp router');

    var scratchResultRef: { current: SerpResponse | undefined } = { current: undefined };
    var serpApiResultRef: { current: SerpResponse | undefined } = { current: undefined };

    await Scope.with(undefined, [], async (scope) => {
        launchBackgroundScope(scope, async (scope) => {

            const scratchRequest = {
                query: query,
                location: searchConfig.location,
                hl: searchConfig.hl,
                google_domain: searchConfig.google_domain,
            };

            try {
                scratchResultRef.current = await serpClient.query(scope, scratchRequest);
            } catch (e) {
                console.log('SCRATCH ERROR: ', e);
            }

        })

        launchBackgroundScope(scope, async (scope) => {

            const serpApiRequest = {
                query: query,
                location: searchConfig.location,
                hl: searchConfig.hl,
                google_domain: searchConfig.google_domain,
            };

            try {
                serpApiResultRef.current = await serpApiSerpClient.query(scope, serpApiRequest);
            } catch (e) {
                console.log('SERP API ERROR: ', e);
            }

        })

        // wait for 3 seconds
        await sleepSeconds(scope, 3);
    })

    var result = "";

    if (scratchResultRef.current !== undefined) {
        var results = scratchResultRef.current.results as string;
        var about = scratchResultRef.current.about as string;
        result += `Result from the first search engine: 
Note: the following result is presented in JSON format.
--- Begin Result ---
${results}
--- End Result ---
Explanation about search engine: ${about}.\n`;
    }
    if (serpApiResultRef.current !== undefined) {
        var results = serpApiResultRef.current.results as string;
        var about = serpApiResultRef.current.about as string;
        result += `Result from the first search engine: 
Note: the following result is presented in JSON format.
--- Begin Result ---
${results}
--- End Result ---
Explanation about search engine: ${about}.`;
    }
    console.log("Returning...")
    return result;
}

export const internalReasoningSystemPrompt = (languageCode: string, query: string) => `You are an intelligent reasoning computer assisting to user needs expressed as natural language requests.

You also have a conversational plugin that you don't have access to, so user needs may be handled by that plugin already. Therefore, you only work with requests that need a function to be satisfied.

You understand many languages.

----------------- IMPORTANT -----------------
Here are the internal knowledge you have:
${internalKnowledge(query)}
If the the Message relates to information contained in the internal knowledge, you MUST not search for it. Instead, you should use No-op().
----------------- IMPORTANT -----------------
`

export async function runInternalReasoningBunny(
    scope: Scope,
    question: string,
    previousResponse: string,
    previousBunnyContext: string,
    context: string,
    action: string,
    value: string,
    languageCode: string,
    llmClient: OpenAiLlmClient,
    timeZone: string
): Promise<string> {

    const formattedTime = formatDateTime(timeZone);

    const messages: ChatMessage[] = [
        { role: 'system', content: internalReasoningSystemPrompt(languageCode, question) },
        {
            role: 'user',
            content: `
Now, you need to use your inherent reasoning capabilities to come up with an answer. You now would need to then formualte a conversational response to the user.

Here are some general rules to follow:

1. If your conversational plugin preliminary response is correct, you can simply say something along the line of "I think what I said is correct." Do not repeat information.
2. It is ${formattedTime}. Remember that.
3. The relevant context may contain outdated or inaccurate information.
4. If the result is long, summarize it. For numbers, round to the nearest integer.
5. For stock prices, convert the price from dollar sign and decimal points to dollars and cents format. Say the name of the company, not the symbol. E.g. AMZN -> Amazon, $1,234.56 -> 1234 dollars and 56 cents.
6. For weather, say the temperature in Fahrenheit and Celsius, and round everything to the nearest integer. 
7. Don't mention that you've searched with Google or any other search engine. Don't bring up latitude or longitude.
8. Important! Answer solely in ${getLanguageNameFallback(languageCode)}. Do not use any other language.
9. Do not include any citations or references. Do not include any links.
10. Limit your response to three sentences maximum. Do not repeat information.

Here is the information you have:

1. Relevant Context: 
------ Begins Relevant Context ------
${context}
------ Ends Relevant Context ------

2. Message: ${question}

3. Action: The system has determined to use the tool [${action}] with arguments (${value}).

4. Conversational Plugin Preliminary Response (from memory, may be inaccurate or outdated): ${previousResponse}

Before you attempt to answer, reflect: is there additional information that you've observed from action that contradicts or does not contain in Conversational Plugin Preliminary Response? Only use those in your response, as your response should not repeat information.
You should absolutely not repeat any information from the Conversational Plugin Preliminary Response. If there's nothing new that you want to add, reply with NONE.

After analysis and combined with the information above, return your conversational answer with fresh information, solely in ${getLanguageNameFallback(languageCode)}:`,
        },
    ];

    const result = llmClient.openAiChatCompletion(scope, {
        messages: messages,
        stopSequences: ["NONE"],
        temperature0to1: 0.0,
        maxTokens: 256,
    })

    return result;
}

export async function runConversationBunny(
    scope: Scope,
    question: string,
    previousResponse: string,
    previousBunnyContext: string,
    context: string,
    action: string,
    value: string,
    languageCode: string,
    llmClient: OpenAiLlmClient,
    timeZone: string
): Promise<string> {

    const formattedTime = formatDateTime(timeZone);

    const messages: ChatMessage[] = [
        { role: 'system', content: internalReasoningSystemPrompt(languageCode, question) },
        {
            role: 'user',
            content: `
Now, conversational plugin preliminary response is not complete, and you need to wrap up the conversation by formulating a conversational response to the user.

Here are some general rules to follow:

1. If your conversational plugin preliminary response is correct, you can simply say something along the line of "I think what I said is correct." Do not repeat information.
2. It is ${formattedTime}. Remember that.
3. The relevant context may contain outdated or inaccurate information.
4. Important! Answer solely in ${getLanguageNameFallback(languageCode)}. Do not use any other language.
5. Do not include any citations or references. Do not include any links.
6. Limit your response to three sentences maximum. Do not repeat information.

Here is the information you have:

1. Relevant Context: 
------ Begins Relevant Context ------
${context}
------ Ends Relevant Context ------

2. Message: ${question}

3. Conversational Plugin Preliminary Response (from memory, may be inaccurate or outdated): ${previousResponse}

Before you attempt to answer, reflect: is there additional information that you've observed from action that contradicts or does not contain in Conversational Plugin Preliminary Response? Only use those in your response, as your response should not repeat information.
You should absolutely not repeat any information from the Conversational Plugin Preliminary Response. If there's nothing new that you want to add, reply with NONE.

After analysis and combined with the information above, return your conversational answer with fresh information, solely in ${getLanguageNameFallback(languageCode)}:`,
        },
    ];

    const result = llmClient.openAiChatCompletion(scope, {
        messages: messages,
        stopSequences: ["NONE"],
        temperature0to1: 0.0,
        maxTokens: 256,
    })

    return result;
}

export async function runCoreBunny(
    bunnyId: string,
    action: string,
    value: string,
    modelClient: ModelClient,
    userId: string,
    scope: Scope,
    language: string,
    llmClient: OpenAiLlmClient,
    llmClientFast: OpenAiLlmClient,
    instructClient: InstructClient,
    config: CallgraphSharedParameter,
    nodeId: number,
): Promise<void> {
    console.log(
        "BUNNY: runCoreBunny: ", action, value
    )
    const question = config.question;
    const context = config.context;
    const previousResponse = config.previousResponse;

    const userDoc: UserStorage = await getUserDocCreateIfNotExist(scope, modelClient, language, userId);

    const sharedCallgraphOutput = userDoc?.shared_callgraph_output ?? [];
    const previousBunnyContext = sharedCallgraphOutput.map(
        (output) => { `Function: ${output.nodeId}${output.bunnyName}(${output.bunnyArgs}) -> ${output.output}` }).join("\n");

    const searchConfig: LocationBasedGoogleSearchConfig = userDoc?.search_config as unknown as LocationBasedGoogleSearchConfig ?? {
        location: "United States",
        hl: "en",
        google_domain: "google.com",
    } as LocationBasedGoogleSearchConfig;

    var result = "";

    console.log('[Running Core bunny]');
    if (action === 'search') {
        try {
            var qvalue: string = JSON.parse(value).query ?? value;
        } catch (e) {
            var qvalue = value;
        }
        qvalue = qvalue.replace(/['"]+/g, '');
        console.log("Search query: ", qvalue)

        const prompt = `You are an algorithm analyzing human intentions. User reports a natural language query that you are using to search on a search engine.
However, the original query might be ambiguous and incomplete, therefore you need to use your inherent reasoning capabilities to come up with a more complete query.
You have some additional context that you can use to help you formulate a better query. The query should still be SEO friendly, so not a question.
--- Begin Context ---
${previousBunnyContext}
--- End Context ---
Here's the query: ${qvalue}
Updated query:`;

        const query = await instructClient.completion(scope, {
            prompt: prompt,
            stopSequences: [],
            temperature0to1: 0,
            maxTokens: 512,
        });
        console.log("Updated query: ", query);
        const rawResult = await serpSearch(scope, query, searchConfig);
        console.log('SERP result: ', rawResult.length);

        result = await synthesizeSERPResponse(
            scope,
            rawResult,
            question,
            previousResponse,
            context,
            action,
            qvalue,
            config.languageCode,
            llmClientFast,
            config.timeZone,
        );

    } else if (action == 'internal_reasoning') {
        result = await runInternalReasoningBunny(
            scope,
            question,
            previousResponse,
            previousBunnyContext,
            context,
            action,
            value,
            config.languageCode,
            llmClient,
            config.timeZone,
        );
        console.log("Internal reasoning result: ", result);
    } else if (action == 'conversation') {
        result = await runConversationBunny(
            scope,
            question,
            previousResponse,
            previousBunnyContext,
            context,
            action,
            value,
            config.languageCode,
            llmClient,
            config.timeZone,
        );
        console.log("Conversation result: ", result);
    }

    // add bunny result to shared_callgraph_output, and bunny_mailbox
    const output = {
        nodeId: nodeId,
        bunnyName: action,
        bunnyId: bunnyId,
        bunnyArgs: value,
        output: result,
    }

    var userDoc_ = {
        ...userDoc,
        bunny_mailbox: [{ bunnyId: bunnyId, result: result, flush: false }],
    }

    await modelClient.userStorageCollections.get(language)?.createOrAppendArray(scope, userDoc_, "bunny_mailbox")

    var userDoc_2 = {
        ...userDoc,
        shared_callgraph_output: [output],
    }

    await modelClient.userStorageCollections.get(language)?.createOrAppendArray(scope, userDoc_2, "shared_callgraph_output")

    await addToBunnyCallMemory(scope, userId, modelClient, bunnyId, action, value, result, language)
    
}