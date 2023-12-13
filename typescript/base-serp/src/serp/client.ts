import { Scope } from "base-core/lib/scope.js"
import {
  CookType,
  arrayType,
  booleanType,
  doubleType,
  int32Type,
  objectType,
  stringType,
} from "base-core/lib/types.js"

export const serpResponseType = objectType([
  // raw SERP response  
  {
    name: "results",
    type: stringType,
  },
  // a natural language description of the SERP for LLM
  {
    name: "about",
    type: stringType,
  },
] as const)

export const serpRequestType = objectType([
  {
    name: "query",
    type: stringType,
  },
  {
    name: "location",
    type: stringType,
    optional: true,
  },
  {
    name: "hl",
    type: stringType,
    optional: true,
  },
  {
    name: "google_domain",
    type: stringType,
    optional: true,
  },
] as const)


export type SerpResponse = CookType<typeof serpResponseType>
export type SerpRequest = CookType<typeof serpRequestType>

export const testType = (test: SerpResponse) => {
  console.log(test.about)
  console.log(test.results)
}

export interface SerpClient {
  query(scope: Scope, request: SerpRequest): Promise<SerpResponse>
}