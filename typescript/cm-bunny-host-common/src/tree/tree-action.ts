import { Scope } from "base-core/lib/scope.js"
import {
  CookType,
  ObjectType,
  doubleType,
  emptyObjectType,
  int32Type,
  objectType,
  stringType,
} from "base-core/lib/types.js"
import { TreeOperation, treeOperationType } from "./tree-operation.js"
import { Tree, treeType } from "./tree.js"

export const treeActionOperationRequestType = objectType([
  { name: "operation", type: treeOperationType },
])

export type TreeActionOperationRequest = CookType<
  typeof treeActionOperationRequestType
>

export const treeActionOperationResponseType = emptyObjectType

export type TreeActionOperationResponse = CookType<
  typeof treeActionOperationResponseType
>

export const treeActionFetchRequestType = emptyObjectType

export type TreeActionFetchRequest = CookType<typeof treeActionFetchRequestType>

export const treeActionFetchResponseType = objectType([
  { name: "tree", type: treeType },
])

export type TreeActionFetchResponse = CookType<
  typeof treeActionFetchResponseType
>

export const treeActionRequestType = objectType([
  // At most one of the following fields can present.
  { name: "operation", type: treeActionOperationRequestType, optional: true },
  { name: "fetch", type: treeActionFetchRequestType, optional: true },
])

export type TreeActionRequest = CookType<typeof treeActionRequestType>

export const treeActionResponseType = objectType([
  // At most one of the following fields can present.
  { name: "operation", type: treeActionOperationResponseType, optional: true },
  { name: "fetch", type: treeActionFetchResponseType, optional: true },
])

export type TreeActionResponse = CookType<typeof treeActionResponseType>

export class TreeExecutor {
  readonly execute: (
    scope: Scope,
    request: TreeActionRequest
  ) => Promise<TreeActionResponse>

  constructor(
    execute: (
      scope: Scope,
      request: TreeActionRequest
    ) => Promise<TreeActionResponse>
  ) {
    this.execute = execute
  }

  async doOperation(scope: Scope, operation: TreeOperation): Promise<void> {
    await this.execute(scope, { operation: { operation } })
  }

  async fetchTree(scope: Scope): Promise<Tree> {
    const response = await this.execute(scope, { fetch: {} })
    if (!response.fetch) {
      throw new Error("Unexpected response")
    }
    return response.fetch.tree
  }
}
