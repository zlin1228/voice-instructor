import { SerpClient, SerpResponse } from "./client.js"
import {
  Scope,
  buildAttachmentForTimeout,
} from "base-core/lib/scope.js"

import { encoding_for_model } from "@dqbd/tiktoken";
const enc = encoding_for_model("gpt-3.5-turbo");

export async function buildSerpAPISerpClient(
  scope: Scope
): Promise<SerpClient> {
  return {
    query: async (scope, request) => {
      const attachment = buildAttachmentForTimeout(5)
      return await Scope.with(scope, [attachment], async (scope) => {

        const searchConfig = {
          location: request.location,
          hl: request.hl,
          google_domain: request.google_domain,
        };

        const body = { query: request.query, search_config: searchConfig, llm: false };

        const response = await fetch('https://cyber-manufacture-co--serpapi-prod-search.modal.run', {
            method: 'post',
            body: JSON.stringify(body),
            headers: { 'Content-Type': 'application/json' }
        });
        
        var result = await response.json();
        var about = result.about;
        var results = JSON.stringify(result.results, null, 2); // prettify into string from json

    
        var tokenCount = enc.encode(results).length
        while (tokenCount > 8192) {
          results = results.substring(250);
            tokenCount = enc.encode(results).length
        }
    
        return {
          results: results,
          about: about,
        }
      })
    }
  }
}
