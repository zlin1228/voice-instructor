import { playwright } from "base-playwright/lib/deps.js"

import { Scope } from "base-core/lib/scope.js"

import {
  TreeActionRequest,
  TreeActionResponse,
} from "cm-bunny-host-common/lib/tree/tree-action.js"

import { Tree } from "cm-bunny-host-common/lib/tree/tree.js"
import { webExecutorHandlePageTreeOperation } from "./operation.js"
import { scriptFetchTree } from "../common/scripts.js"

async function webExecutorHandlePageTreeFetch(
  scope: Scope,
  page: playwright.Page
): Promise<Tree> {
  return await page.evaluate(scriptFetchTree)
}

export async function webExecutorHandlePageTreeAction(
  scope: Scope,
  page: playwright.Page,
  treeAction: TreeActionRequest
): Promise<TreeActionResponse> {
  const { operation, fetch } = treeAction
  if (operation !== undefined) {
    await webExecutorHandlePageTreeOperation(scope, page, operation.operation)
    return {
      operation: {},
    }
  }
  if (fetch !== undefined) {
    return {
      fetch: {
        tree: await webExecutorHandlePageTreeFetch(scope, page),
      },
    }
  }
  throw new Error("Not implemented")
}
