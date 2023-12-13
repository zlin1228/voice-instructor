import { throwError } from "base-core/lib/exception.js"
import { Scope } from "base-core/lib/scope.js"
import {
  CookType,
  emptyObjectType,
  objectType,
  stringType,
} from "base-core/lib/types.js"
import {
  TreeExecutor,
  treeActionRequestType,
  treeActionResponseType,
} from "cm-bunny-host-common/lib/tree/tree-action.js"

export const pageActionNavigateRequestType = objectType([
  { name: "url", type: stringType },
])

export type PageActionNavigateRequest = CookType<
  typeof pageActionNavigateRequestType
>

export const pageActionNavigateResponseType = emptyObjectType

export type PageActionNavigateResponse = CookType<
  typeof pageActionNavigateResponseType
>

export const pageActionRequestType = objectType([
  // At most one of the following fields can present.
  { name: "navigate", type: pageActionNavigateRequestType, optional: true },
  { name: "treeAction", type: treeActionRequestType, optional: true },
])

export type PageActionRequest = CookType<typeof pageActionRequestType>

export const pageActionResponseType = objectType([
  // At most one of the following fields can present.
  { name: "navigate", type: pageActionNavigateResponseType, optional: true },
  { name: "treeAction", type: treeActionResponseType, optional: true },
])

export type PageActionResponse = CookType<typeof pageActionResponseType>

export class PageExecutor {
  readonly execute: (
    scope: Scope,
    request: PageActionRequest
  ) => Promise<PageActionResponse>

  constructor(
    execute: (
      scope: Scope,
      request: PageActionRequest
    ) => Promise<PageActionResponse>
  ) {
    this.execute = execute
  }

  async navigate(scope: Scope, url: string): Promise<void> {
    await this.execute(scope, {
      navigate: { url },
    })
  }

  buildTreeExecutor(): TreeExecutor {
    return new TreeExecutor(async (scope, request) => {
      const response = await this.execute(scope, {
        treeAction: request,
      })
      return response.treeAction ?? throwError("Unexpected response")
    })
  }
}
