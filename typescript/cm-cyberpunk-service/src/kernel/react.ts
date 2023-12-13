import { openAiCompleteChatNonStreaming } from "./openai.js"
import { ChatFragment, ChatMessage } from "./chat.js"
import { format } from "date-fns"
import { ModelClient } from "../model.js"
import { weatherSearch, LocationBasedGoogleSearchConfig } from "./weather-location-agent.js"
import { getLanguageNameFallback } from "./language.js"
import { Scope } from "base-core/lib/scope.js"
import { enc } from "./conversation-prompt.js"
import fetch from 'node-fetch'

export interface ActionValue {
    action: string;
    value: string;
}

export interface ReactInitialConfig {
    languageCode: string;
    context: string;
}

export interface ReactActionConfig {
    languageCode: string;
    question: string;
    context: string;
    previousResponse: string;
    timeZone: string;
}

export interface StockQuote {
    c: number;
    h: number;
    l: number;
    o: number;
    pc: number;
    t: number;
}


export const reactPrompt = (languageCode: string) => `You run in a loop of Thought, Action, PAUSE, and Observation.
At the end of the loop, you output an Answer
Use Thought to describe your thoughts about the question you have been asked.
Use Action to run one of the actions available to you - then return PAUSE. You have to return PAUSE after Action.
Observation will be the result of running those actions.
You understand many languages.
Use Context only to formulate question in case the user question is incomplete. DO NOT USE TO FORMULATE QUESTION as Context contains many false information.
You will not ask for clarification.

If the Assistant Response indicates that the assistant agrees to perform certain actions, you MUST do so. Your result must be consistent with the assistant response.
If the Assistant Response is empty or contains irrelevant information, you MUST rely on Question to determine what to do, instead of just assuming that there's no action needed.
For example, upon observing 'Assistant Response: Sure, Playing OneRepublic's Counting Stars for you now, enjoy!', you MUST use play_music as the action.
Action values must be in the same language as the question and assistant response. For example, if the question is in English, the action value must be in English. If the assistant response is in Chinese, the action value must be in Chinese.

In Action, it MUST be in the format of action: value. DO NOT USE CONDITIONALS. DO NOT USE ANY OTHER FORMAT.

Your available actions are:

change_voice:
e.g. change_voice: male
e.g. change_voice: female
If the person EXPLICITLY says they require a male or a female voice. MUST NOT use this command unless the person EXPLICITLY says they want a different voice.

change_user_name:
e.g. change_user_name: Alex
If the person wants the assistant to call them a different name.

change_assistant_name:
e.g. change_assistant_name: Samantha
If the person wants to call the assistant by a different name.

search:
e.g. search: Los Angeles Lakers Roster
Returns a summary from searching Google. Used when the person asks a question that is not common knowledge, or is events after 2021. Rephrase the query to be SEO-friendly.
Additionally, use this action when user and the assistant are following up on previous questions. Don't search when it's personal, philosophical, emotional or common sense.
Use this action when the user wants to know more about a musician, a song, or album. If the user wants to listen to music, use play_music instead.
The search value must be in ${getLanguageNameFallback(languageCode)}.

weather:
e.g. weather: London,GB
If the person wants to know the weather in a specific location. The output has to be English.

stock_price:
e.g. stock_price: AAPL
If the person wants to know the stock price of a specific stock. The value must be a valid stock ticker. DO NOT USE for cryptocurrencies (Ethereum, Bitcoin, etc.), use search instead. The stock ticker is English only. Use search instead for other financial metrics, such as market capitalization, revenue, etc.

clear_history:
e.g. clear_history: true
If the person wants to clear the conversation history or make the assistant forget previous conversations.

play_music:
e.g. play_music: Warriors Imagine Dragons
If the person indicates that they want to listen to music or wants to play a music track, an artist, a genre or an album. You have to use this if the user wants to play or listen to music. Since this action will help the user log into Spotify before playing the music, use this EVEN IF the user is not logged into Spotify. If the question contains both the artist and the song name, the value must be in the format of [song name], [artist name]
The search value in play music must be in the same language as the one appearing in the Question.

play_liked_song:
e.g. play_liked_song: true
If the person indicates that they want to listen to their liked songs, or their list. For example, "play my list." Use this even if user repeatedly asks to play their liked songs. Do not use play_music for this.

If no action is needed, simply answer Action: None. Use sparringly.
Try to use search instead of searching from history.
When the user wants to listen to something or asks for something, don't use search. Use play_music instead.
When the user wants to pause, resume, or skip, or play the next or previous song, do not use any action.

Example session 1:

Question: User: What is the newest john wick movie?
Assistant Response: I'm working on it, please wait.
Thought: I should look up on Google.
Action: search: What is the newest john wick movie
PAUSE

You will be called again with this:
Observation: John Wick: Chapter 4

You then output:
Answer: The newest John Wick movie is John Wick: Chapter 4.

Example session 2:

Question: User: What do you want to have for dinner?
Assistant Response: I'm not sure, what do you want to have for dinner?
Thought: This doesn't match any of the existing actions.
Action: None
PAUSE

Example session 3:

Question: User: Play OneRepublic
Assistant Response: Playing OneRepublic for you now, enjoy!
Thought: Since the assistant agrees to play music, I must use play_music.
Action: play_music: OneRepublic Counting Stars
PAUSE

Example session 4:

Question: User: Play OneRepublic's Counting Stars
Assistant Response: Playing OneRepublic's Counting Stars. Note that you may need to log into Spotify.
Thought: Even though the user is not logged into Spotify, and the assistant said "Note that you may need to log into Spotify." I must still use play_music because this action will help the user log into Spotify first, then play the music.
Action: play_music: OneRepublic Counting Stars
PAUSE

Example session 5:

Question: User: Play OneRepublic's Counting Stars
Assistant Response: 
Thought: Even though the assistant did not reply, I must still use play_music.
Action: play_music: OneRepublic Counting Stars
PAUSE

Example session 6:

Question: User: Play OneRepublic's Counting Stars
Assistant Response: Is there anything else I can help you with?
Thought: Even though the assistant response is irrelevant, I must still use play_music.
Action: play_music: OneRepublic Counting Stars
PAUSE
`.trim()

const languageStubs: Record<string, string> = {
    "en": "I searched and found out that...",
    "ja": "調べたところ...",
    "ko": "조사해보니...",
    "zh": "我查了一下...",
}

export async function runReactActionLLM(
    result: string,
    question: string,
    previousResponse: string,
    context: string,
    action: string,
    value: string,
    languageCode: string,
    timeZone: string
): Promise<string> {
    const formattedTime = (new Date()).toLocaleDateString("en-US", { timeZone: timeZone, hour: 'numeric', minute: 'numeric', hour12: true })
    var language = languageStubs[languageCode];
    if (language === undefined) {
        language = "I searched and found out that...";
    }

    const messages: ChatMessage[] = [
        { role: 'user', content: reactPrompt(languageCode) },
        {
            role: 'user',
            content: `Relevant Context: ${context}
Question: ${question}
Action: ${action}: ${value}
Observation: ${result}
Preliminary Response (from your memory, may be inaccurate or outdated): ${previousResponse}
1. If there are inconsistencies between the observation and the preliminary response, clearly indicate that the preliminary resposne is incorrect, and apologize.
2. If your preliminary response is correct, you can simply say something along the line of "I did my research and confirmed my preliminary response is correct." Do not repeat information.
3. It is ${formattedTime}. Remember that.
4. Start your response with "${language}" or a variation of it, in ${getLanguageNameFallback(languageCode)}.
5. The relevant context may contain outdated or inaccurate information. If ther observation exists in the relevant context but not in the preliminary response, you may still say it.
6. If the result is long, summarize it. For numbers, round to the nearest integer.
7. For stock prices, convert the price from dollar sign and decimal points to dollars and cents format. Say the name of the company, not the symbol. E.g. AMZN -> Amazon, $1,234.56 -> 1234 dollars and 56 cents.
8. For weather, say the temperature in Fahrenheit and Celsius, and round everything to the nearest integer. 
9. Don't mention that you've searched with Google or any other search engine. Don't bring up latitude or longitude.
10. Important! Answer solely in ${getLanguageNameFallback(languageCode)}. Do not use any other language.
Answer (solely in ${getLanguageNameFallback(languageCode)}):`,
        },
    ];

    const resp = await openAiCompleteChatNonStreaming(messages, 0.0);
    return resp;
}


const observationActions = [
    "weather",
    "stock_price",
    "search",
    "play_music",
    "play_liked_song"
];

const observationlessActions = [
    "change_voice",
    "change_user_name",
    "change_assistant_name",
    "change_assistant_prompt",
    "clear_history",
]

function findSubstringAfter(str: string, s: string): string {
    const index = str.indexOf(s);

    if (index === -1) {
        return "";
    }

    return str.substring(index + s.length);
}

export async function reactInitial(
    question: string,
    previousResponse: string,
    modelClient: ModelClient,
    userId: string,
    scope: Scope,
    language: string,
    config: ReactInitialConfig
): Promise<ActionValue | null> {
    if (question.length < 2) {
        return null;
    }
    const messages: ChatMessage[] = [
        { role: 'user', content: reactPrompt(config.languageCode) },
        {
            role: 'user',
            content: `Context: ${config.context}
Question: ${question}
Assistant Response: ${previousResponse}`,
        },
    ];

    const response = await openAiCompleteChatNonStreaming(messages, 0.1);

    const lines = response.split('\n');
    const ms = lines.filter(string => string.startsWith("Action:"));

    const userDoc =
        await modelClient.userStorageCollections.get(language)?.getById(
            scope,
            userId
    )

    if (ms[0] !== undefined && userDoc !== undefined) {
        const actionPair = findSubstringAfter(ms[0], "Action:").trim();
        if (!actionPair.includes(':')) {
            return null;
        }
        const [action, value] = actionPair.split(':').map((s) => s.trim());
        if (action === undefined || value === undefined) {
            return null;
        }
        console.log('Action-Value: ', action, '->', value);
        if (observationlessActions.includes(action)) {
            var userDoc_ = userDoc;
            if (action === "change_voice") {
                if (value === "male") {
                    userDoc_ = { ...userDoc }
                } else {
                    userDoc_ = { ...userDoc }
                }
            } else if (action === "change_user_name") {
                userDoc_ = { ...userDoc, user_name: value }
            } else if (action === "change_assistant_name") {
                userDoc_ = { ...userDoc }
            } else if (action === "clear_history") {
                userDoc_ = { ...userDoc, conversation_context: [] }
            }
            // console.log('UserDoc: ', userDoc_)
            await modelClient.userStorageCollections.get(language)?.bulkMergeFields(scope, [userDoc_])
            return null;
        } else if (observationActions.includes(action)) {
            return { action, value };
        }
    }

    return null;
}

const serpSearch = async (query: string, searchConfig: LocationBasedGoogleSearchConfig): Promise<string> => {
    const body = { query: query, search_config: searchConfig };

    const response = await fetch('https://cyber-manufacture-co--kernel-serp-serp-agent.modal.run', {
        method: 'post',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' }
    });
    var result = await response.text();

    var tokenCount = enc.encode(result).length
    while (tokenCount > 2048) {
        result = result.substring(250);
        tokenCount = enc.encode(result).length
    }

    return result;
}

const stockSearch = async (query: string) => {
    const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${query}&token=ch092vhr01qt0s72cpj0ch092vhr01qt0s72cpjg`);
    const json = await response.json() as StockQuote;
    return `The current price of ${query} is ${json.c} dollars.`;
}

export async function reactAction(
    action: string,
    value: string,
    modelClient: ModelClient,
    userId: string,
    scope: Scope,
    language: string,
    config: ReactActionConfig
): Promise<string> {

    const question = config.question;
    const context = config.context;
    const previousResponse = config.previousResponse;

    const userDoc =
        await modelClient.userStorageCollections.get(language)?.getById(
            scope,
            userId
        )
    
    const searchConfig : LocationBasedGoogleSearchConfig = userDoc?.search_config as unknown as LocationBasedGoogleSearchConfig ?? {
        location: "United States",
        hl: "en",
        google_domain: "google.com",
    } as LocationBasedGoogleSearchConfig;

    console.log('Running react action');
    if (action === 'search') {
        const result = await serpSearch(value, searchConfig);
        const actionResult = await runReactActionLLM(
            result,
            question,
            previousResponse,
            context,
            action,
            value,
            config.languageCode,
            config.timeZone,
        );
        console.log('SERP RESULT: ', result.length);
        return actionResult;
    } else if (action === 'weather') {
        var result = "unknown"
        try {
            result = await weatherSearch(scope, value);
        } catch (e) {
            console.log('WEATHER ERROR: ', e);
        }

        const actionResult = await runReactActionLLM(
            result,
            question,
            previousResponse,
            context,
            action,
            value,
            config.languageCode,
            config.timeZone,
        );
        console.log('WEATHER RESULT: ', result);
        return actionResult;
    } else if (action === 'stock_price') {
        const result = await stockSearch(value);
        const actionResult = await runReactActionLLM(
            result,
            question,
            previousResponse,
            context,
            action,
            value,
            config.languageCode,
            config.timeZone,
        );
        console.log('STOCK RESULT: ', result);
        return actionResult;
    } else {
        return "";
    }
}