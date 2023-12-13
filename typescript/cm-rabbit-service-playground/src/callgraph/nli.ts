import { ChatFragment, ChatMessage } from "../kernel/chat.js"
import { getLanguageNameFallback } from "../kernel/language.js"
import {
    Scope,
    launchBackgroundScope,
    sleepSeconds,
} from "base-core/lib/scope.js"
import { internalKnowledge } from "../kernel/internal-knowledge.js";
import {
    OpenAiLlmClient
} from "base-nli/lib/llm/openai.js"
import { formatDateTime } from "../utils/time.js";

export const conversationalSystemPrompt = (languageCode: string, query: string) => `You are an intelligent reasoning computer assisting to user needs expressed as natural language requests.

You also have a conversational plugin that you don't have access to, so user needs may be handled by that plugin already. Therefore, you only work with requests that need a function to be satisfied.

You understand many languages.

----------------- IMPORTANT -----------------
Here are the internal knowledge you have:
${internalKnowledge(query)}
If the the Message relates to information contained in the internal knowledge, you MUST not search for it. Instead, you should use No-op().
----------------- IMPORTANT -----------------
`

const languageStubs: Record<string, string> = {
    "en": "I searched and found out that...",
    "ja": "調べたところ...",
    "ko": "조사해보니...",
    "zh": "我查了一下...",
}

export async function* runInternalReasoning(
    scope: Scope,
    question: string,
    previousResponse: string,
    context: string,
    action: string,
    value: string,
    languageCode: string,
    llmClient: OpenAiLlmClient,
    timeZone: string
): AsyncGenerator<ChatFragment> {

    const formattedTime = formatDateTime(timeZone);

    const messages: ChatMessage[] = [
        { role: 'system', content: conversationalSystemPrompt(languageCode, question) },
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

3. Function: The system has determined to use the tool [${action}] with arguments (${value}).

4. Conversational Plugin Preliminary Response (from memory, may be inaccurate or outdated): ${previousResponse}

Before you attempt to answer, reflect: is there additional information that you've observed from action that contradicts or does not contain in Conversational Plugin Preliminary Response? Only use those in your response, as your response should not repeat information.
You should absolutely not repeat any information from the Conversational Plugin Preliminary Response. If there's nothing new that you want to add, reply with NONE.

After analysis and combined with the information above, return your conversational answer with fresh information, solely in ${getLanguageNameFallback(languageCode)}:`,
        },
    ];

    for await (const result of llmClient.openAichatCompletionStream(scope, {
        messages: messages,
        stopSequences: ["NONE"],
        temperature0to1: 0.0,
        maxTokens: 256,
    })) {
        // console.log("LLM result: ", result)
        yield { fragment: result };
    }
}

export async function synthesizeSERPResponse(
    scope: Scope,
    result: string,
    question: string,
    previousResponse: string,
    context: string,
    action: string,
    value: string,
    languageCode: string,
    llmClient: OpenAiLlmClient,
    timeZone: string
): Promise<string> {

    const formattedTime = formatDateTime(timeZone);

    const messages: ChatMessage[] = [
        { role: 'system', content: conversationalSystemPrompt(languageCode, question) },
        {
            role: 'user',
            content: `
Now, the Function has returned an observation. You now would need to formualte a conversational response to the user.

Here are some general rules to follow:

1. If there are inconsistencies between the observation and the conversational plugin preliminary response, clearly indicate that the preliminary resposne is incorrect, and apologize.
2. If your conversational plugin preliminary response is correct, you can simply say something along the line of "I think what I said is correct." Do not repeat information.
3. It is ${formattedTime}. Remember that.
4. The relevant context may contain outdated or inaccurate information. If the observation exists in the relevant context but not in the conversational plugin preliminary response, you may still say it.
5. If the result is long, summarize it. For numbers, round to the nearest integer.
6. For stock prices, convert the price from dollar sign and decimal points to dollars and cents format. Say the name of the company, not the symbol. E.g. AMZN -> Amazon, $1,234.56 -> 1234 dollars and 56 cents.
7. For weather, say the temperature in Fahrenheit and Celsius, and round everything to the nearest integer. 
8. Don't mention that you've searched with Google or any other search engine. Don't bring up latitude or longitude.
9. Important! Answer solely in ${getLanguageNameFallback(languageCode)}. Do not use any other language.
10. Do not include any citations or references. Do not include any links.
11. Limit your response to three sentences maximum. Do not repeat information.

Here is the information you have:

1. Relevant Context: 
------ Begins Relevant Context ------
${context}
------ Ends Relevant Context ------

2. Function: The system has determined to use the tool [${action}] with arguments (${value}).

3. Observation: 
------ Begins Observation from Function ------
${result}
------ Ends Observation from Function ------

4. Conversational Plugin Preliminary Response (from memory, may be inaccurate or outdated): ${previousResponse}

Before you attempt to answer, reflect: is there additional information that you've observed from action that contradicts or does not contain in Conversational Plugin Preliminary Response? Only use those in your response, as your response should not repeat information.
You should absolutely not repeat any information from the Conversational Plugin Preliminary Response. If there's nothing new that you want to add, reply with NONE.

After analysis and combined with the information above, return your conversational answer with fresh information, solely in ${getLanguageNameFallback(languageCode)}:`,
        },
    ];

    return await llmClient.openAiChatCompletion(scope, {
        messages: messages,
        stopSequences: ["NONE"],
        temperature0to1: 0.0,
        maxTokens: 256,
    })
}


export async function* synthesizeBunnyFlushResponse(
    scope: Scope,
    bunnyString: string,
    context: string,
    languageCode: string,
    llmClient: OpenAiLlmClient,
    timeZone: string
): AsyncGenerator<ChatFragment> {

    const formattedTime = formatDateTime(timeZone);

    const messages: ChatMessage[] = [
        { role: 'system', content: conversationalSystemPrompt(languageCode, "") },
        {
            role: 'user',
            content: `
Now, multiple Functions have returned observations. You now would need to formualte a conversational response to the user.

Here are some general rules to follow:

1. It is ${formattedTime}. Remember that.
2. Eaach of the observation will include outputs regarding things the function is certain of, and things the function is uncertain of. You should only include and combine the things the function is certain of in your response.
  - For example, here's how two functions may return observations:
        1. I know about A but I'm unsure about B.
        2. I know about B but I'm unsure about A.
    You should only include the following in your response:
        Here's A and B.
    Note how you don't talk about how 1. is unsure about B, and 2. is unsure about A.   
2. The relevant context may contain outdated or inaccurate information. If the observation exists in the relevant context but not in the conversational plugin preliminary response, you may still say it.
3. If the result is long, summarize it. For numbers, round to the nearest integer.
4. For stock prices, convert the price from dollar sign and decimal points to dollars and cents format. Say the name of the company, not the symbol. E.g. AMZN -> Amazon, $1,234.56 -> 1234 dollars and 56 cents.
5. For weather, say the temperature in Fahrenheit and Celsius, and round everything to the nearest integer. 
6. Don't mention that you've searched with Google or any other search engine. Don't bring up latitude or longitude.
7. Important! Answer solely in ${getLanguageNameFallback(languageCode)}. Do not use any other language.
8. Do not include any citations or references. Do not include any links.
9. Limit your response to three sentences maximum. Do not repeat information. If something in user's message cannot be determined, don't mention it.

Here is the information you have:

1. Relevant Context: 
------ Begins Relevant Context ------
${context}
------ Ends Relevant Context ------

2. Observation: 
------ Begins Observation from Function ------
${bunnyString}
------ Ends Observation from Function ------

After analysis and combined with the information above, return your conversational answer with fresh information, solely in ${getLanguageNameFallback(languageCode)}:`,
        },
    ];

    for await (const result of llmClient.openAichatCompletionStream(scope, {
        messages: messages,
        stopSequences: ["NONE"],
        temperature0to1: 0.0,
        maxTokens: 256,
    })) {
        yield { fragment: result };
    }
}