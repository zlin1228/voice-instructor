import {
    template as promptTemplate, templateCn as promptTemplateCn, templateJa as promptTemplateJa, templateKo as promptTemplateKo,
    templateProactive as promptTemplateProactive, templateProactiveCn as promptTemplateProactiveCn,
    templateProactiveJa as promptTemplateProactiveJa, templateProactiveKo as promptTemplateProactiveKo, logitBias as promptLogitBias
} from "./conversation-prompt.js";
import * as cldrSegmentation from 'cldr-segmentation'
import { templateComplete as anthropicTemplate, templateCn as anthropicTemplateCn, templateJa as anthropicTemplateJa, templateKo as anthropicTemplateKo, templateProactive as anthropicTemplateProactive, templateProactiveCn as anthropicTemplateProactiveCn, templateProactiveJa as anthropicTemplateProactiveJa, templateProactiveKo as anthropicTemplateProactiveKo, logitBias as anthropicLogitBias } from "./conversation-prompt-anthropic.js";
import { UserStorage } from "../model.js"
import { supp } from "./chat.js";

import { ChatFragment, ChatMessage } from "./chat.js"
import { tokenize } from "./conversation-prompt.js"
import {
    OpenAiLlmClient
} from "base-nli/lib/llm/openai.js"
import {
    Scope,
    launchBackgroundScope,
    sleepSeconds,
} from "base-core/lib/scope.js"
import {
    AnthropicLlmClient,
} from "base-nli/lib/llm/anthropic.js"
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
    llmClient: OpenAiLlmClient,
    anthropicllmClient: AnthropicLlmClient,
    scope: Scope,
    memory: MemoryRecord[],
    salientMemory: string[],
    timeZone: string = "",
): AsyncGenerator<ChatFragment> {

    var messages: ChatMessage[] = [];
    var anthropicMessages: string = "";
    var stopSequence: string[] = [];

    var template_ = promptTemplate;
    var anthropicTemplate_ = anthropicTemplate;
    if (language === "cn") {
        template_ = promptTemplateCn;
    } else if (language === "jp") {
        template_ = promptTemplateJa;
    } else if (language === "kr") {
        template_ = promptTemplateKo;
    }

    const salientMemoryStr = salientMemory.join("\n");
    console.log("salientMemory: ", JSON.stringify(salientMemory));
    var timeZone_ = formatDateTime(timeZone);
    var config: any;

    var context;
    if (userDoc == undefined) {
        console.log("Warning: userDoc is null");
        messages = template_("", salientMemoryStr, userMessage, "User", "Assistant", "", "", userState, timeZone_);
        stopSequence = ["[",];
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
        config = { contextStr, salientMemoryStr, userMessage, userName, assistantName, summary, userState, timeZone_ }
        stopSequence = ["[", `${userName}:`];
    }

    var claude2ExpertAccumulator = "";

    let segments: string[] = []
    let buf = ""
    let accumulatedFragment = ""
    let firstFragmentYielded = false
    for await (const result of llmClient.openAichatCompletionStream(scope, {
        messages: messages,
        stopSequences: stopSequence,
        temperature0to1: 0.0,
        maxTokens: 96,
    })) {
        // console.log("LLM result: " + result)
        buf += result
        accumulatedFragment += result
        segments = cldrSegmentation.sentenceSplit(buf, supp);
        if (segments.length > 1 && !firstFragmentYielded) {
            if (segments[0] != undefined) {
                // pop the first segment
                const sentenceFragment: string = segments[0]
                if (userDoc == undefined) {
                    anthropicMessages = anthropicTemplate_("", salientMemoryStr, userMessage, "User", "Assistant", "", "", userState, timeZone_, sentenceFragment);
                } else {
                    anthropicMessages = anthropicTemplate_(config.contextStr, salientMemoryStr, userMessage, 
                        config.userName, config.assistantName, "", config.summary, config.userState, config.timeZone_, sentenceFragment);
                }
                firstFragmentYielded = true
                try {
                    for await (const aresult of anthropicllmClient.anthropicCompletionStream(scope, {
                        prompt: anthropicMessages,
                        stopSequences: stopSequence,
                        temperature0to1: 0.0,
                        maxTokens: 1024,
                    })) {
                        claude2ExpertAccumulator += aresult;
                        yield { fragment: aresult, claude2ExpertAccumulator: claude2ExpertAccumulator };
                    }
                } catch (e) {
                    console.log("Error: ", e);
                }
            }
        }
        if (!firstFragmentYielded) {
            yield { fragment: result, claude2ExpertAccumulator: claude2ExpertAccumulator };
        }
    }

}

export async function* streamingProactiveConversation(
    language: string,
    userDoc: UserStorage | undefined,
    contextLimit: number = 135,
    timeZone: string = "",
    llmClient: OpenAiLlmClient,
    scope: Scope,
): AsyncGenerator<ChatFragment> {
    var messages: ChatMessage[] = [];
    var stopSequence: string[] = [];

    var template_ = promptTemplateProactive;
    if (language === "cn") {
        template_ = promptTemplateProactiveCn;
    } else if (language === "jp") {
        template_ = promptTemplateProactiveJa;
    } else if (language === "kr") {
        template_ = promptTemplateProactiveKo;
    }

    if (userDoc == undefined) {
        console.log("Warning: userDoc is null");
        return;
    } else {
        var context: string[] = [];
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
        messages = template_(contextStr, userName, assistantName, "", summary, timeZone_);
        stopSequence = [`${assistantName}:`, "[", "Assistant:", `${userName}:`];
        //console.log(contextStr);
        //console.log(messages);
    }

    for await (const result of llmClient.openAichatCompletionStream(scope, {
        messages: messages,
        stopSequences: stopSequence,
        temperature0to1: 0.4,
        logitBias: promptLogitBias,
        maxTokens: 1024,
    })) {
        yield { fragment: result };
    }
}