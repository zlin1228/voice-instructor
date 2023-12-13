import { template, templateCn, templateJa, templateKo, templateProactive, templateProactiveCn, templateProactiveJa, templateProactiveKo, logitBias } from "./conversation-prompt.js"
import { openAiCompleteChat } from "./openai.js"
import { UserStorage } from "../model.js"
import { ChatFragment, ChatMessage } from "./chat.js"
import { enc } from "./conversation-prompt.js"

export async function* streamingConversation(
    userMessage: string,
    language: string,
    userDoc: UserStorage | undefined,
    assistantName: string,
    assistantPrompt: string,
    userState: string,
    characterId: string,
    contextLimit: number = 50,
): AsyncGenerator<ChatFragment> {
    var messages: ChatMessage[] = [];
    var stopSequence: string[] = [];

    var template_ = template;
    if (language === "cn") {
        template_ = templateCn;
    } else if (language === "jp") {
        template_ = templateJa;
    } else if (language === "kr") {
        template_ = templateKo;
    }

    var userName = "V", summary = "";
    var context = [];
    if (userDoc == undefined) {
        console.log("Warning: userDoc is null");
        context = [ userMessage ]
    } else {
        var history = [...userDoc.history] ?? []
        const characterHistoryExists = history.some((history) => history.character === characterId);
        if (characterHistoryExists) {
            // context is the conversation of first element in history that has character = characterId
            var context_ = history.find((history) => history.character === characterId)?.conversation ?? []
            context = [...context_]
            context = context.slice(-contextLimit)
            var tokenCount = enc.encode(context.join("\n")).length
            while (tokenCount > 12000) {
                context = context.slice(2)
                tokenCount = enc.encode(context.join("\n")).length
            }
            context.push(userMessage);
        } else {
            context = [ userMessage ]
        }
        //console.log(contextStr);
        summary = userDoc.conversation_summary;
    }

    const contextStr = context.join("\n");
    messages = template_(contextStr, userName, assistantName, assistantPrompt, summary, userState);
    stopSequence = [`${assistantName}:`, "[", "Assistant:", `${userName}:`];

    console.log("Prompt: ", messages);
    for await (const chatFragment of openAiCompleteChat(messages, stopSequence, logitBias, 1.0)) {
        yield chatFragment;
    }
}

export async function* streamingProactiveConversation(
    language: string,
    userDoc: UserStorage | undefined,
    assistantName: string,
    assistantPrompt: string,
    contextLimit: number = 50,
): AsyncGenerator<ChatFragment> {
    var messages: ChatMessage[] = [];
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
        var context = userDoc.conversation_context.slice(-contextLimit)
        var tokenCount = enc.encode(context.join("\n")).length
        while (tokenCount > 12000) {
            context = context.slice(2);
            tokenCount = enc.encode(context.join("\n")).length
        }
        const userName = userDoc.user_name;
        const contextStr = context.join("\n");
        const summary = userDoc.conversation_summary;
        messages = template_(contextStr, userName, assistantName, assistantPrompt, summary);
        stopSequence = [`${assistantName}:`, "[", "Assistant:", `${userName}:`];
        //console.log(contextStr);
    }
    for await (const chatFragment of openAiCompleteChat(messages, stopSequence, logitBias, 0.4)) {
        yield chatFragment;
    }
}