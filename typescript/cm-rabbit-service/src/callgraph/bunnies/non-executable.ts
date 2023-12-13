import { ModelClient, UserStorage } from "../../model.js"
import {
    Scope,
    launchBackgroundScope,
    sleepSeconds,
} from "base-core/lib/scope.js"
import { MilvusClient, InsertReq, DataType } from "@zilliz/milvus2-sdk-node"
import { updateIntentionByRabbitResponse } from "../../kernel/intention.js";
import { InstructClient } from "base-nli/lib/instruct/client.js"
import { getUserDocCreateIfNotExist } from "../../kernel/kernel-common.js";

export async function runNonExecutableBunny(
    bunnyId: string,
    action: string,
    value: string,
    modelClient: ModelClient,
    userId: string,
    scope: Scope,
    language: string,
    instructClient: InstructClient,
    vectorDBClient: MilvusClient,
    milvusCollectionName: string,
): Promise<void> {
    console.log(
        "BUNNY: runNonExecutableBunny: ", action, value
    )
    var userDoc : UserStorage = await getUserDocCreateIfNotExist(scope, modelClient, language, userId);

    var userDoc_ = userDoc;
    var rabbitResponse = "";
    var val: string = "";
    if (action === "change_voice") {
        var c = "male";
        if (value === "male") {
            userDoc_ = { ...userDoc, speaker: "male" }
        } else {
            c = "female";
            userDoc_ = { ...userDoc, speaker: "female" }
        }

        rabbitResponse = "The voice was changed to " + c + "."
    } else if (action === "change_user_name") {
        try {
            try {
                val = JSON.parse(value).name ?? value;
            } catch (e) {
                val = value;
            }
            userDoc_ = { ...userDoc, user_name: val }
        } catch (e) {
            console.log(
                "Error parsing JSON in synthesizeCallgraph change_user_name: "
            )
            console.log(e)
        }
        rabbitResponse = "The user name was changed to " + val + "."
    } else if (action === "change_assistant_name") {
        try {
            try {
                val = JSON.parse(value).name ?? value;
            } catch (e) {
                val = value;
            }
            userDoc_ = { ...userDoc, assistant_name: val }
        } catch (e) {
            console.log(
                "Error parsing JSON in synthesizeCallgraph change_assistant_name: "
            )
            console.log(e)
        }
        rabbitResponse = "The assistant name was changed to " + val + "."
    } else if (action === "clear_history") {
        // userDoc_ = { ...userDoc, conversation_context: [] }

        var done = true;
        while (done) {
            const ids: string[] = (await vectorDBClient?.query({
                collection_name: milvusCollectionName,
                expr: `userId == "${userId}"`,
                output_fields: ["id"],
                limit: 10000,
            }))?.data?.map((x) => x['id']) ?? [];

            if (ids.length === 0) {
                done = false;
            } else {
                const idsString = ids.map((x) => `${x}`).join(", ");
                const deletedEntities = await vectorDBClient?.deleteEntities({
                    collection_name: milvusCollectionName,
                    expr: `id in [${idsString}]`,
                });
                console.log("Deleted entities: ", deletedEntities?.delete_cnt);
            }

        }
        rabbitResponse = "The conversation history was cleared."
    }

    await modelClient.userStorageCollections.get(language)?.bulkMergeFields(scope, [userDoc_]);
    // 木已成舟
    const newIntention = await updateIntentionByRabbitResponse(scope, modelClient, instructClient, userId, rabbitResponse);
    console.log("New intention: ", newIntention);

}