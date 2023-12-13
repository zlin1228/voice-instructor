import { openai } from "../deps.js"

import { Scope, checkAndGetAbortSignal } from "base-core/lib/scope.js"
import { makeOptionalField } from "base-core/lib/optional.js"
import { EmbeddingClient, embeddingRequest, embeddingResponse } from "./client.js"
import { EmbeddingCreateParams, CreateEmbeddingResponse, Embedding } from "openai/resources/embeddings.js"

export const openaiEmbedding_TextEmbeddingAda002 = "text-embedding-ada-002"

export type OpenAiEmbeddingModel =
    | typeof openaiEmbedding_TextEmbeddingAda002

export interface OpenAiEmbeddingOptions {
    apiKey: string | undefined // use env OPENAI_API_KEY if undefined
    model: OpenAiEmbeddingModel
}


export async function buildOpenAiEmbeddingClient(
    scope: Scope,
    options: OpenAiEmbeddingOptions
): Promise<EmbeddingClient> {
    const openaiClient = new openai.OpenAI({
        ...makeOptionalField("apiKey", options.apiKey),
    })
    const buildParams = (
        request: embeddingRequest
    ): EmbeddingCreateParams => {
        return {
            model: options.model,
            input: [...request.input],
            ...makeOptionalField("user", request.userId),
        }
    }


    return {
        embed: async (scope, request) => {
            const signal = checkAndGetAbortSignal(scope)
            const params = buildParams(request)
            try {
                const completion = await openaiClient.embeddings.create(
                    {
                        ...params,
                    },
                    {
                        signal,
                    }
                )
                const data = completion.data;
                const ret: embeddingResponse = {
                    "embeddings": data.map((item: Embedding) => {
                        return {
                            embedding: item.embedding,
                            index: item.index,
                        }
                    })
                }

                return ret;
            } catch (e) {
                throw e
            } finally {
            }
        },

    }
}
