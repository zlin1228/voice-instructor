import { Scope } from "base-core/lib/scope"
import { CommonClosure } from "base-core/lib/types-common"
import {
  CookType,
  Type,
  arrayType,
  objectType,
  stringType,
} from "base-core/lib/types.js"

export interface LlmResponseEvaluator<T> {
  name: string
  parameters: T
  evalute: (scope: Scope, response: string) => Promise<number>
}

export interface LlmRequestTemplate<T> {
  name: string
  render: (scope: Scope, parameters: T) => Promise<string>
}

export interface LlmPrompt<T> {
  id: string
  parametersType: Type<CommonClosure, T>
  templates: LlmRequestTemplate<T>[]
  evaluators: LlmResponseEvaluator<T>[]
}

export interface LlmRegistry {
  runPrompt<T>(prompt: LlmPrompt<T>, parameters: T): Promise<string>
}
