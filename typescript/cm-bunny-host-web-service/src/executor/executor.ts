import { playwright } from "base-playwright/lib/deps.js"
import {
  BroadcastController,
  Scope,
  launchBackgroundScope,
} from "base-core/lib/scope.js"
import {
  WebActionCreateContextRequest,
  WebActionCreateContextResponse,
  WebActionCreatePageRequest,
  WebActionCreatePageResponse,
  WebActionDeleteContextRequest,
  WebActionDeleteContextResponse,
  WebActionExportContextStateRequest,
  WebActionExportContextStateResponse,
  WebActionImportContextStateRequest,
  WebActionImportContextStateResponse,
  WebActionListContextsRequest,
  WebActionListContextsResponse,
  WebActionRequest,
  WebActionResponse,
  WebActionSetPageInteractionModeRequest,
  WebActionSetPageInteractionModeResponse,
  WebExecutor,
} from "cm-bunny-host-web-common/lib/action/web-action.js"
import {
  PageActionNavigateRequest,
  PageActionNavigateResponse,
  PageActionRequest,
  PageActionResponse,
} from "cm-bunny-host-web-common/lib/action/page-action.js"

import { webExecutorHandlePageTreeAction } from "./tree.js"
import {
  scriptRegisterBunnyUtil,
  scriptSetInteractionMode,
} from "../common/scripts.js"
import { stringRandomSimpleName } from "base-core/lib/string.js"
import { throwError } from "base-core/lib/exception.js"
import { registerPageJsonCallbackAsync } from "base-playwright/lib/playwright.js"
import {
  TreeNodeLocation,
  treeNodeLocationType,
} from "cm-bunny-host-common/lib/tree/tree.js"
import { emptyObjectType } from "base-core/lib/types.js"
import {
  TreeInteractionMode,
  treeInteractionModeType,
} from "cm-bunny-host-common/lib/tree/tree-interaction.js"

interface WebExecutorRuntime {
  executorScope: Scope
  browser: playwright.Browser
  contextMap: Map<string, playwright.BrowserContext>
  pageMap: Map<
    string,
    { page: playwright.Page; interactionMode: TreeInteractionMode }
  >
  pageInteractionMode: Map<string, TreeInteractionMode>
}

function webExecutorGetContextOrThrow(
  runtime: WebExecutorRuntime,
  contextId: string
): playwright.BrowserContext {
  const context = runtime.contextMap.get(contextId)
  if (context === undefined) {
    throw new Error(`Context [${contextId}] does not exist`)
  }
  return context
}

function webExecutorGetPageOrThrow(
  runtime: WebExecutorRuntime,
  pageId: string
): playwright.Page {
  const page = runtime.pageMap.get(pageId)
  if (page === undefined) {
    throw new Error(`Page [${pageId}] does not exist`)
  }
  return page.page
}

async function webExecutorHandleCreateContext(
  scope: Scope,
  runtime: WebExecutorRuntime,
  createContext: WebActionCreateContextRequest
): Promise<WebActionCreateContextResponse> {
  const { contextId, stateJson } = createContext
  const context = await runtime.browser.newContext({
    screen: {
      width: 1024,
      height: 1024,
    },
    viewport: {
      width: 1024,
      height: 1024,
    },
    storageState: stateJson ? JSON.parse(stateJson) : undefined,
  })
  if (runtime.contextMap.has(contextId)) {
    await context.close()
    throw new Error("Context already exists")
  }
  runtime.contextMap.set(contextId, context)
  return {}
}

async function webExecutorHandleDeleteContext(
  scope: Scope,
  runtime: WebExecutorRuntime,
  deleteContext: WebActionDeleteContextRequest
): Promise<WebActionDeleteContextResponse> {
  const { contextId } = deleteContext
  const context = webExecutorGetContextOrThrow(runtime, contextId)
  runtime.contextMap.delete(contextId)
  await context.close()
  return {}
}

async function webExecutorHandleExportContextState(
  scope: Scope,
  runtime: WebExecutorRuntime,
  exportContextState: WebActionExportContextStateRequest
): Promise<WebActionExportContextStateResponse> {
  const { contextId } = exportContextState
  const context = webExecutorGetContextOrThrow(runtime, contextId)
  return {
    stateJson: JSON.stringify(await context.storageState()),
  }
}

async function contextLoadState(
  scope: Scope,
  context: playwright.BrowserContext,
  stateJson: string
) {
  await context.addCookies(JSON.parse(stateJson)["cookies"])
  // await context.addInitScript((storageStateJson) => {
  //   const storageState = JSON.parse(storageStateJson)
  // }, storageStateJson)
}

async function webExecutorHandleImportContextState(
  scope: Scope,
  runtime: WebExecutorRuntime,
  importContextState: WebActionImportContextStateRequest
): Promise<WebActionImportContextStateResponse> {
  const { contextId, stateJson } = importContextState
  const context = webExecutorGetContextOrThrow(runtime, contextId)
  await contextLoadState(scope, context, stateJson)
  return {}
}

async function webExecutorHandleListContexts(
  scope: Scope,
  runtime: WebExecutorRuntime,
  listContexts: WebActionListContextsRequest
): Promise<WebActionListContextsResponse> {
  const pages = new Map(
    [...runtime.pageMap.entries()].map(([pageId, page]) => [page.page, pageId])
  )
  return {
    contexts: [...runtime.contextMap.entries()].map(([contextId, context]) => {
      return {
        contextId,
        pageIds: context
          .pages()
          .map((page) => pages.get(page) ?? throwError("page not found")),
      }
    }),
  }
}

async function initPage(
  scope: Scope,
  runtime: WebExecutorRuntime,
  pageId: string,
  selectedNodeBroadcast: BroadcastController<TreeNodeLocation>
) {
  const page = runtime.pageMap.get(pageId) ?? throwError("page not found")
  await registerPageJsonCallbackAsync(
    scope,
    page.page,
    "__bunnyReportSelected",
    treeNodeLocationType,
    emptyObjectType,
    async (nodeLocation) => {
      console.log(nodeLocation)
      selectedNodeBroadcast.emit(nodeLocation)
      return {}
    }
  )
  await registerPageJsonCallbackAsync(
    scope,
    page.page,
    "__bunnyGetInteractionMode",
    emptyObjectType,
    treeInteractionModeType,
    async () => {
      return (
        runtime.pageMap.get(pageId)?.interactionMode ?? {
          selecting: true,
          highlight: undefined,
        }
      )
    }
  )
  await page.page.addInitScript(scriptRegisterBunnyUtil, {
    selecting: true,
    highlight: undefined,
  })
}

async function webExecutorHandleCreatePage(
  scope: Scope,
  runtime: WebExecutorRuntime,
  createPage: WebActionCreatePageRequest,
  selectedNodeBroadcast: BroadcastController<TreeNodeLocation>
): Promise<WebActionCreatePageResponse> {
  const { contextId, pageId } = createPage
  const context = webExecutorGetContextOrThrow(runtime, contextId)
  const page = await context.newPage()
  if (runtime.pageMap.has(pageId)) {
    await page.close()
    throw new Error("Page already exists")
  }
  runtime.pageMap.set(pageId, {
    page,
    interactionMode: {
      selecting: true,
      highlight: undefined,
    },
  })
  await initPage(scope, runtime, pageId, selectedNodeBroadcast)
  return {}
}

async function webExecutorHandleSetPageInteractionMode(
  scope: Scope,
  runtime: WebExecutorRuntime,
  setPageInteractionMode: WebActionSetPageInteractionModeRequest
): Promise<WebActionSetPageInteractionModeResponse> {
  const { pageId, interactionMode } = setPageInteractionMode
  const page = webExecutorGetPageOrThrow(runtime, pageId)
  runtime.pageMap.set(pageId, {
    page,
    interactionMode,
  })
  await page.evaluate(scriptSetInteractionMode, interactionMode)
  return {}
}

async function webExecutorHandlePageNavigate(
  scope: Scope,
  runtime: WebExecutorRuntime,
  page: playwright.Page,
  navigate: PageActionNavigateRequest
): Promise<PageActionNavigateResponse> {
  const { url } = navigate
  await page.goto(url)
  return {}
}

async function webExecutorHandlePageAction(
  scope: Scope,
  runtime: WebExecutorRuntime,
  page: playwright.Page,
  pageAction: PageActionRequest
): Promise<PageActionResponse> {
  const { navigate, treeAction } = pageAction
  if (navigate !== undefined) {
    return {
      navigate: await webExecutorHandlePageNavigate(
        scope,
        runtime,
        page,
        navigate
      ),
    }
  }
  if (treeAction !== undefined) {
    return {
      treeAction: await webExecutorHandlePageTreeAction(
        scope,
        page,
        treeAction
      ),
    }
  }
  throw new Error("Not implemented")
}

export interface WebExecutorBrowser {
  webExecutor: WebExecutor
  contextMap: Map<string, playwright.BrowserContext>
  pageMap: Map<
    string,
    { page: playwright.Page; interactionMode: TreeInteractionMode }
  >
}

export async function buildWebExecutorBrowser(
  scope: Scope,
  browser: playwright.Browser
): Promise<WebExecutorBrowser> {
  const selectedNodeBroadcast = new BroadcastController<TreeNodeLocation>()
  const runtime: WebExecutorRuntime = {
    executorScope: scope,
    browser,
    contextMap: new Map<string, playwright.BrowserContext>(),
    pageMap: new Map<
      string,
      { page: playwright.Page; interactionMode: TreeInteractionMode }
    >(),
    pageInteractionMode: new Map<string, TreeInteractionMode>(),
  }
  scope.onLeave(async () => {
    for (const context of runtime.contextMap.values()) {
      await context.close()
    }
  })
  for (const ctx of browser.contexts()) {
    const contextId = stringRandomSimpleName(8)
    runtime.contextMap.set(contextId, ctx)
    for (const page of ctx.pages()) {
      const pageId = stringRandomSimpleName(8)
      runtime.pageMap.set(pageId, {
        page,
        interactionMode: { selecting: false, highlight: undefined },
      })
      await initPage(scope, runtime, pageId, selectedNodeBroadcast)
    }
  }
  return {
    contextMap: runtime.contextMap,
    pageMap: runtime.pageMap,
    webExecutor: new WebExecutor(
      async (
        scope: Scope,
        request: WebActionRequest
      ): Promise<WebActionResponse> => {
        const {
          createContext,
          deleteContext,
          exportContextState,
          importContextState,
          listContexts,
          createPage,
          setPageInteractionMode,
          singlePageAction,
        } = request
        if (createContext !== undefined) {
          return {
            createContext: await webExecutorHandleCreateContext(
              scope,
              runtime,
              createContext
            ),
          }
        }
        if (deleteContext !== undefined) {
          return {
            deleteContext: await webExecutorHandleDeleteContext(
              scope,
              runtime,
              deleteContext
            ),
          }
        }
        if (exportContextState !== undefined) {
          return {
            exportContextState: await webExecutorHandleExportContextState(
              scope,
              runtime,
              exportContextState
            ),
          }
        }
        if (importContextState !== undefined) {
          return {
            importContextState: await webExecutorHandleImportContextState(
              scope,
              runtime,
              importContextState
            ),
          }
        }
        if (listContexts !== undefined) {
          return {
            listContexts: await webExecutorHandleListContexts(
              scope,
              runtime,
              listContexts
            ),
          }
        }
        if (createPage !== undefined) {
          return {
            createPage: await webExecutorHandleCreatePage(
              scope,
              runtime,
              createPage,
              selectedNodeBroadcast
            ),
          }
        }
        if (setPageInteractionMode !== undefined) {
          return {
            setPageInteractionMode:
              await webExecutorHandleSetPageInteractionMode(
                scope,
                runtime,
                setPageInteractionMode
              ),
          }
        }
        if (singlePageAction !== undefined) {
          const { pageId, pageAction } = singlePageAction
          const page = webExecutorGetPageOrThrow(runtime, pageId)
          return {
            singlePageAction: {
              pageAction: await webExecutorHandlePageAction(
                scope,
                runtime,
                page,
                pageAction
              ),
            },
          }
        }
        throw new Error("Not implemented")
      },
      selectedNodeBroadcast
    ),
  }
}
