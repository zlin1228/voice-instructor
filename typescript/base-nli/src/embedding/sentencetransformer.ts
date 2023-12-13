import { Scope, checkAndGetAbortSignal } from "base-core/lib/scope.js"
import { makeOptionalField } from "base-core/lib/optional.js"
import { EmbeddingClient, embeddingRequest, embeddingResponse } from "./client.js"
import { EmbeddingCreateParams, CreateEmbeddingResponse, Embedding } from "openai/resources/embeddings.js"

export const openaiEmbedding_TextEmbeddingAda002 = "text-embedding-ada-002"

export type OpenAiEmbeddingModel =
    | typeof openaiEmbedding_TextEmbeddingAda002


export async function buildSentenceTransformerEmbeddingClient(
    scope: Scope,
): Promise<EmbeddingClient> {
    return {
        embed: async (scope, request) => {
            const signal = checkAndGetAbortSignal(scope)

            try {
                var results = []
                for (var i = 0; i < request.input.length; i++) {
                    // send a GET request to https://ray.rabbit.ngrok.io?text=
                    const query = request.input[i] ?? "(silence)"
                    if (query == "(silence)") {
                        console.log("Warning: query is (silence)")
                    }
                    const url = `https://ray.rabbit.ngrok.io?text=${encodeURIComponent(query)}`
                    const response = await fetch(url, {
                        method: "GET",
                        signal,
                    })

                    const data = await response.json()
                    results.push({
                        embedding: data,
                        index: i,
                    })
                }

                // console.log("results: ", results)

                return {
                    "embeddings": results,
                }
            } catch (e) {
                throw e
            } finally {
            }
        },

    }
}
