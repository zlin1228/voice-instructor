import { template, templateCn, templateJa, templateKo, templateProactive, templateProactiveCn, templateProactiveJa, templateProactiveKo, logitBias } from "./conversation-prompt-anthropic.js"
import { UserStorage } from "../model.js"
import { ChatFragment, ChatMessage } from "./chat.js"
import { tokenize } from "./conversation-prompt-anthropic.js"
import {
    AnthropicLlmClient,
} from "base-nli/lib/llm/anthropic.js"
import {
    Scope,
    launchBackgroundScope,
    sleepSeconds,
} from "base-core/lib/scope.js"
import {
    MemoryRecord
} from "../memory/conversation.js"
import {
    formatDateTime
} from "../utils/time.js"


export async function* streamingConversation(
    userMessage: string,
    language: string,
    userDoc: UserStorage | undefined,
    userState: string,
    llmClient: AnthropicLlmClient,
    scope: Scope,
    memory: MemoryRecord[],
    salientMemory: string[],
    timeZone: string = "",
): AsyncGenerator<ChatFragment> {
    
    var messages: string = "";
    var stopSequence: string[] = [];

    var template_ = template;
    if (language === "cn") {
        template_ = templateCn;
    } else if (language === "jp") {
        template_ = templateJa;
    } else if (language === "kr") {
        template_ = templateKo;
    }

    const salientMemoryStr = salientMemory.join("\n");
    console.log("salientMemory: ", JSON.stringify(salientMemory));
    var timeZone_ = formatDateTime(timeZone);

    var context;
    if (userDoc == undefined) {
        console.log("Warning: userDoc is null");
        messages = template_("", salientMemoryStr, userMessage, "User", "Assistant", "", "", userState, timeZone_);
        stopSequence = ["[", ];
    } else {
        context = memory.map((record) => record.text)
        var tokenCount = tokenize(context.join("\n"));
        while (tokenCount > 13000) {
            context = context.slice(2)
            tokenCount = tokenize(context.join("\n"));
        }
        const userName = userDoc.user_name;
        const contextStr = context.join("\n");
        const assistantName = userDoc.assistant_name;
        const summary = userDoc.conversation_summary;
        messages = template_(contextStr, salientMemoryStr, userMessage, userName, assistantName, "", summary, userState, timeZone_);
        stopSequence = ["[", `${userName}:`];
    }

    for await (const result of llmClient.anthropicCompletionStream(scope, {
        prompt: messages,
        stopSequences: stopSequence,
        temperature0to1: 0.0,
        logitBias: logitBias,
        maxTokens: 1024,
    })) {
        // console.log("LLM result: " + result)
        yield { fragment: result };
    }

}

export async function* streamingProactiveConversation(
    language: string,
    userDoc: UserStorage | undefined,
    contextLimit: number = 135,
    timeZone: string = "",
    llmClient: AnthropicLlmClient,
    scope: Scope,
): AsyncGenerator<ChatFragment> {
    var prompt: string = "";
    var stopSequence: string[] = [];

    var template_ = templateProactive;
    if (language === "cn") {
        template_ = templateProactiveCn;
    } else if (language === "jp") {
        template_ = templateProactiveJa;
    } else if (language === "kr") {
        template_ = templateProactiveKo;
    }

    if (userDoc == undefined) {
        console.log("Warning: userDoc is null");
        return;
    } else {
        // var context = userDoc.conversation_context.slice(-contextLimit)
        var context : string[] = [];
        var tokenCount = tokenize(context.join("\n"));
        while (tokenCount > 2048) {
            context = context.slice(2);
            tokenCount = tokenize(context.join("\n"));
        }
        const userName = userDoc.user_name;
        const contextStr = context.join("\n");
        const assistantName = userDoc.assistant_name;
        const summary = userDoc.conversation_summary;
        const timeZone_ = timeZone == "" ? "UTC" : timeZone;
        prompt = template_(contextStr, userName, assistantName, "", summary, timeZone_);
        stopSequence = [`${assistantName}:`, "[", "Assistant:", `${userName}:`];
        //console.log(contextStr);
    }

    for await (const result of llmClient.anthropicCompletionStream(scope, {
        prompt: prompt,
        stopSequences: stopSequence,
        temperature0to1: 0.4,
        logitBias: logitBias,
        maxTokens: 1024,
    })) {
        yield { fragment: result };
    }
}