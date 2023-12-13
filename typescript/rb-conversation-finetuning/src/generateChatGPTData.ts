import { template } from "cm-rabbit-service/lib/conversation/conversation-prompt.js"
import { throwError } from "base-core/lib/exception.js"

import fs from 'fs';
import fetch from 'node-fetch';
import OpenAI, { toFile } from 'openai';
import { promisify } from 'util';
import { execSync } from "child_process";

const openai = new OpenAI();

export const generateSalientMemory = () => ""
export const generateContext = () => ""

export const userClearConverastionRequests = [
    "Clear conversation history.",
    "I'd like to start fresh and have you clear our conversation history.",
    "Can you delete the record of our previous chats?",
    "Is there a way to delete what we've discussed up to this point?",
    "Can you forget what we've talked about?",
    "Can you delete our conversation?",
    "Delete everything we've said so far so we can start over.",
    "Delete our conversation.",
    "Purge our chat history.",
]

export const aiClearConversationResponses = [
    "No problem, I've just cleared our chat history and we can start over.",
    "Sure, I have deleted our prior conversation logs per your request. Consider our chat record erased.",
    "Conversation history cleared.",
    "I have cleared our prior conversation data.",
    "No problem, I have erased our chat logs as you requested. We can now proceed as if we are speaking for the first time.",
    "Done, I have deleted our prior conversation history so we can start fresh.",
    "Our conversation history has been deleted."
]

export const userAppleStockPriceQuery = [
    "What's the stock price of Apple?",
    "How much is Apple stock?",
    "What is the price of Apple stock?",
]

export const aiAppleStockPriceResponses = [
    "I'm working on it. Let me find the sotrk price of Apple for you.",
    "Let me check. I'll get back to you.",
    "Let me look into it.",
    "Let me see what I can find.",
]

export const userDaHuiHuanRequests = [
    "Play Da Hui Huan.",
    "I want to listen to Da Hui Huan.",
]

export const aiDaHuiHuanResponses = [
    "Playing Da Hui Huan. Enjoy!",
    "Playing Da Hui Huan.",
]

export const userOneRepublicRequests = [
    "Play One Republic.",
    "Let's play some One Republic."
]

export const aiOneRepublicResponses = [
    "Playing One Republic. Enjoy!",
    "Playing One Republic.",
]

export const userCrescendoRequests = [
    "Play Crescendo by Daft Punk.",
    "I want to listen to Crescendo by Daft Punk.",
]

export const aiCrescendoResponses = [
    "Playing Crescendo by Daft Punk. Enjoy!",
    "Playing Crescendo by Daft Punk.",
]

export const userAssistantNameRequests = [
    "I want to call you Cynthia.",
    "I'd like to rename you to Cynthia.",
    "I want your name to be Cynthia.",
]

export const aiAssistantNameResponses = [
    "My name is Cynthia now.",
    "Ok, I will now go by Cynthia.",
    "Sure, you can call me Cynthia.",
    "Sure, from now on I will be Cynthia.",
]

export const userNameRequests = [
    "I want you to call me Alexander.",
    "You can call me Alexander.",
    "You can refer to me as Alexander.",
    "My name is Alexander.",
]

export const aiUserNameResponses = [
    "Hi Alexander, how's it going?",
    "Hi Alexander, nice to meet you.",
    "Ok, I will now call you Alexander.",
    "Sure, I will now call you Alexander.",
    "Sure, I will refer to you as Alexander.",
]

const prompts = [
    [userClearConverastionRequests, aiClearConversationResponses],
    [userAppleStockPriceQuery, aiAppleStockPriceResponses],
    [userDaHuiHuanRequests, aiDaHuiHuanResponses],
    [userOneRepublicRequests, aiOneRepublicResponses],
    [userCrescendoRequests, aiCrescendoResponses],
    [userAssistantNameRequests, aiAssistantNameResponses],
    [userNameRequests, aiUserNameResponses],
];

export const generateOpenAIData = () => {

    // get cartesian product of userClearConverastionRequests and aiClearConversationResponses

    const cartesianProduct = (a: string[], b: string[]) =>
        a.flatMap((x) => b.map((y) => [x, y]))
        

    const process = (a: string[] | undefined, b: string[] | undefined) => {
        if (a === undefined || b === undefined) {
            return []
        }
        const prod = cartesianProduct(a, b)
        if (prod.length > 10) {
            prod.sort(() => Math.random() - 0.5);
            prod.length = Math.floor(prod.length * 1 / 2);
        }
        return prod
    }
    
    // concat all cartesian products
    const reqRespPairs = prompts.map(([a, b]) => process(a, b)).flat()

    let userState = `--- Begin Spotify Status ---
Spotify is not logged in.
--- End Spotify Status ---`

    /*
    export const template = (
        context: string,
        salientMemory: string,
        userQuery: string,
        userName: string,
        assistantName: string,
        assistantPrompt: string,
        summary: string,
        userState: string,
        timeZone: string,
    ) : ChatMessage[] => [
    */

    /*
        {"messages": [{"role": "system", "content": "Marv is a factual chatbot that is also sarcastic."}, {"role": "user", "content": "What's the capital of France?"}, {"role": "assistant", "content": "Paris, as if everyone doesn't know that already."}]}
    */

    let messages = []

    for (const [req, resp] of reqRespPairs) {
        const msg = template(generateContext(),
            generateSalientMemory(),
            req ?? throwError("????"),
            "Alexander",
            "Cynthia",
            "",
            "",
            userState,
            "America/Los_Angeles")

        msg.push({
            "role": "assistant",
            "content": resp
        })
        messages.push({
            "messages": msg
        })
    }

    return messages
}

const stub = "core+nonexec"

export const getFilename = () => {
    // Get the Git commit of the current directory
    const commitHash = execSync('git rev-parse HEAD').toString().trim();

    // Get the current date
    const date = new Date();
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    const filename = `${year}-${month}-${day}-${commitHash}-${stub}`

    return filename
}

export const getModelName = () => {
    const modelname = stub

    return modelname
}

export const createAndUploadTrainingFile = async () => {

    const fullSet = generateOpenAIData()

    // Shuffle first
    fullSet.sort(() => Math.random() - 0.5);

    // Split into training and validation sets 90% / 10%
    const splitIndex = Math.floor(fullSet.length * 0.9);
    const trainingSet = fullSet.slice(0, splitIndex);
    const validationSet = fullSet.slice(splitIndex);

    // Convert your data to JSONL format
    const jsonlDataTrain = trainingSet.map(obj => JSON.stringify(obj)).join('\n');
    const jsonlDataValidation = validationSet.map(obj => JSON.stringify(obj)).join('\n');

    // Write your data to a file
    const writeFile = promisify(fs.writeFile);

    await writeFile(`${getFilename()}-train.jsonl`, jsonlDataTrain);
    await writeFile(`${getFilename()}-valid.jsonl`, jsonlDataValidation);

    const trainFileUploadState = await openai.files.create({ file: fs.createReadStream(`${getFilename()}-train.jsonl`), purpose: 'fine-tune' });
    const validFileUploadState = await openai.files.create({ file: fs.createReadStream(`${getFilename()}-valid.jsonl`), purpose: 'fine-tune' });
    console.log(trainFileUploadState)
    console.log(validFileUploadState)

    return {
        "train": trainFileUploadState.id,
        "valid": validFileUploadState.id
    }
}

export const createFinetuningJob = async (train: string, valid: string) => {

    const fineTune = await openai.fineTuning.jobs.create({
        training_file: train,
        validation_file: valid,
        model: 'gpt-3.5-turbo',
        suffix: getModelName(),
    });

    console.log(fineTune);
}
