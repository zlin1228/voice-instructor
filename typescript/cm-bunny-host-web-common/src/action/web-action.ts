import {
  CookType,
  arrayType,
  emptyObjectType,
  objectType,
  stringType,
} from "base-core/lib/types.js"
import {
  PageExecutor,
  pageActionRequestType,
  pageActionResponseType,
} from "./page-action.js"
import { Broadcast, Scope } from "base-core/lib/scope.js"
import { throwError } from "base-core/lib/exception.js"
import { TreeNodeLocation } from "cm-bunny-host-common/lib/tree/tree.js"
import {
  TreeInteractionMode,
  treeInteractionModeType,
} from "cm-bunny-host-common/lib/tree/tree-interaction.js"

export const webActionCreateContextRequestType = objectType([
  { name: "contextId", type: stringType },
  { name: "stateJson", type: stringType, optional: true },
])

export type WebActionCreateContextRequest = CookType<
  typeof webActionCreateContextRequestType
>

export const webActionCreateContextResponseType = emptyObjectType

export type WebActionCreateContextResponse = CookType<
  typeof webActionCreateContextResponseType
>

export const webActionDeleteContextRequestType = objectType([
  { name: "contextId", type: stringType },
])

export type WebActionDeleteContextRequest = CookType<
  typeof webActionDeleteContextRequestType
>

export const webActionDeleteContextResponseType = emptyObjectType

export type WebActionDeleteContextResponse = CookType<
  typeof webActionDeleteContextResponseType
>

export const webActionExportContextStateRequestType = objectType([
  { name: "contextId", type: stringType },
])

export type WebActionExportContextStateRequest = CookType<
  typeof webActionExportContextStateRequestType
>

export const webActionExportContextStateResponseType = objectType([
  { name: "stateJson", type: stringType },
])

export type WebActionExportContextStateResponse = CookType<
  typeof webActionExportContextStateResponseType
>

export const webActionImportContextStateRequestType = objectType([
  { name: "contextId", type: stringType },
  { name: "stateJson", type: stringType },
])

export type WebActionImportContextStateRequest = CookType<
  typeof webActionImportContextStateRequestType
>

export const webActionImportContextStateResponseType = emptyObjectType

export type WebActionImportContextStateResponse = CookType<
  typeof webActionImportContextStateResponseType
>

export const webActionListContextsRequestType = objectType([])

export type WebActionListContextsRequest = CookType<
  typeof webActionListContextsRequestType
>

export const webActionListContextsResponseType = objectType([
  {
    name: "contexts",
    type: arrayType(
      objectType([
        {
          name: "contextId",
          type: stringType,
        },
        {
          name: "pageIds",
          type: arrayType(stringType),
        },
      ])
    ),
  },
])

export type WebActionListContextsResponse = CookType<
  typeof webActionListContextsResponseType
>

export const webActionCreatePageRequestType = objectType([
  { name: "contextId", type: stringType },
  { name: "pageId", type: stringType },
])

export type WebActionCreatePageRequest = CookType<
  typeof webActionCreatePageRequestType
>

export const webActionCreatePageResponseType = emptyObjectType

export type WebActionCreatePageResponse = CookType<
  typeof webActionCreatePageResponseType
>

export const webActionSetPageInteractionModeRequestType = objectType([
  { name: "contextId", type: stringType },
  { name: "pageId", type: stringType },
  { name: "interactionMode", type: treeInteractionModeType },
])

export type WebActionSetPageInteractionModeRequest = CookType<
  typeof webActionSetPageInteractionModeRequestType
>

export const webActionSetPageInteractionModeResponseType = emptyObjectType

export type WebActionSetPageInteractionModeResponse = CookType<
  typeof webActionSetPageInteractionModeResponseType
>

export const webActionPageActionRequestType = objectType([
  { name: "pageId", type: stringType },
  { name: "pageAction", type: pageActionRequestType },
])

export type WebActionPageActionRequest = CookType<
  typeof webActionPageActionRequestType
>

export const webActionPageActionResponseType = objectType([
  { name: "pageAction", type: pageActionResponseType },
])

export type WebActionPageActionResponse = CookType<
  typeof webActionPageActionResponseType
>

export const webActionRequestType = objectType([
  // At most one of the following fields can present.
  {
    name: "createContext",
    type: webActionCreateContextRequestType,
    optional: true,
  },
  {
    name: "deleteContext",
    type: webActionDeleteContextRequestType,
    optional: true,
  },
  {
    name: "exportContextState",
    type: webActionExportContextStateRequestType,
    optional: true,
  },
  {
    name: "importContextState",
    type: webActionImportContextStateRequestType,
    optional: true,
  },
  {
    name: "listContexts",
    type: webActionListContextsRequestType,
    optional: true,
  },
  { name: "createPage", type: webActionCreatePageRequestType, optional: true },
  {
    name: "setPageInteractionMode",
    type: webActionSetPageInteractionModeRequestType,
    optional: true,
  },
  {
    name: "singlePageAction",
    type: webActionPageActionRequestType,
    optional: true,
  },
])

export type WebActionRequest = CookType<typeof webActionRequestType>

export const webActionResponseType = objectType([
  // At most one of the following fields can present.
  {
    name: "createContext",
    type: webActionCreateContextResponseType,
    optional: true,
  },
  {
    name: "deleteContext",
    type: webActionDeleteContextResponseType,
    optional: true,
  },
  {
    name: "exportContextState",
    type: webActionExportContextStateResponseType,
    optional: true,
  },
  {
    name: "importContextState",
    type: webActionImportContextStateResponseType,
    optional: true,
  },
  {
    name: "listContexts",
    type: webActionListContextsResponseType,
    optional: true,
  },
  { name: "createPage", type: webActionCreatePageResponseType, optional: true },
  {
    name: "setPageInteractionMode",
    type: webActionSetPageInteractionModeResponseType,
    optional: true,
  },
  {
    name: "singlePageAction",
    type: webActionPageActionResponseType,
    optional: true,
  },
])

export type WebActionResponse = CookType<typeof webActionResponseType>

export class WebExecutor {
  readonly selectedNodeBroadcast: Broadcast<TreeNodeLocation>
  readonly execute: (
    scope: Scope,
    request: WebActionRequest
  ) => Promise<WebActionResponse>

  constructor(
    execute: (
      scope: Scope,
      request: WebActionRequest
    ) => Promise<WebActionResponse>,
    selectedNodeBroadcast: Broadcast<TreeNodeLocation>
  ) {
    this.execute = execute
    this.selectedNodeBroadcast = selectedNodeBroadcast
  }

  async createContext(scope: Scope, contextId: string): Promise<void> {
    await this.execute(scope, {
      createContext: { contextId },
    })
  }

  async deleteContext(scope: Scope, contextId: string): Promise<void> {
    await this.execute(scope, {
      deleteContext: { contextId },
    })
  }

  async listContexts(scope: Scope): Promise<WebActionListContextsResponse> {
    const response = await this.execute(scope, {
      listContexts: {},
    })
    return response.listContexts ?? throwError("Unexpected response")
  }

  async setPageInteractionMode(
    scope: Scope,
    contextId: string,
    pageId: string,
    interactionMode: TreeInteractionMode
  ): Promise<void> {
    await this.execute(scope, {
      setPageInteractionMode: { contextId, pageId, interactionMode },
    })
  }

  async exportContextState(scope: Scope, contextId: string): Promise<string> {
    const response = await this.execute(scope, {
      exportContextState: { contextId },
    })
    return (response.exportContextState ?? throwError("Unexpected response"))
      .stateJson
  }

  async importContextState(
    scope: Scope,
    contextId: string,
    stateJson: string
  ): Promise<void> {
    await this.execute(scope, {
      importContextState: { contextId, stateJson },
    })
  }

  async createPage(
    scope: Scope,
    contextId: string,
    pageId: string
  ): Promise<void> {
    await this.execute(scope, {
      createPage: { contextId, pageId },
    })
  }

  buildPageExecutor(pageId: string): PageExecutor {
    return new PageExecutor(async (scope, request) => {
      const response = await this.execute(scope, {
        singlePageAction: {
          pageId,
          pageAction: request,
        },
      })
      return (response.singlePageAction ?? throwError("Unexpected response"))
        .pageAction
    })
  }
}
