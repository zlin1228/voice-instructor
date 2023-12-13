import { playwright } from "base-playwright/lib/deps.js"

import { Scope } from "base-core/lib/scope.js"

import {
  TreeOperation,
  TreeOperationClick,
  TreeOperationFill,
  TreeOperationHover,
  TreeOperationPress,
  TreeOperationScroll,
} from "cm-bunny-host-common/lib/tree/tree-operation.js"
import { TreeNodeLocation } from "cm-bunny-host-common/lib/tree/tree.js"
import {
  nodeIdAttribute,
  scriptSetInteractionMode,
  treeIdAttribute,
} from "../common/scripts.js"
import { throwError } from "base-core/lib/exception.js"

async function buildPlaywrightLocator(
  scope: Scope,
  page: playwright.Page,
  nodeLocation: TreeNodeLocation
): Promise<playwright.Locator> {
  const { treeId, nodeId } = nodeLocation
  return page
    .locator(
      `[${treeIdAttribute}="${treeId}"] [${nodeIdAttribute}="${nodeId}"]`
    )
    .or(
      // We need this because if nodeId is the root node, then it is not a descendent of the root node.
      page.locator(
        `[${treeIdAttribute}="${treeId}"][${nodeIdAttribute}="${nodeId}"]`
      )
    )
}

async function performOperation<T>(
  page: playwright.Page,
  fn: () => Promise<T>
): Promise<T> {
  try {
    await page.evaluate(scriptSetInteractionMode, {
      selecting: false,
      highlight: undefined,
    })
    return await fn()
  } finally {
    await page.evaluate(scriptSetInteractionMode, {
      selecting: true,
      highlight: undefined,
    })
  }
}

async function webExecutorHandlePageTreeOperationClick(
  scope: Scope,
  page: playwright.Page,
  click: TreeOperationClick
): Promise<void> {
  const { nodeLocation } = click
  const locator = await buildPlaywrightLocator(scope, page, nodeLocation)
  await performOperation(page, async () => {
    let position: {
      x: number
      y: number
    } | undefined = undefined
    if (click.positionRatioX !== undefined || click.positionRatioY !== undefined) {
      const { width, height } = await locator.boundingBox({ timeout: 1000 }) ?? throwError("Node not found")
      position = {
        // minus one so that it doesn't exceed the boundary.
        x: Math.min(width - 1, (click.positionRatioX ?? 0.5) * width),
        y: Math.min(height - 1, (click.positionRatioY ?? 0.5) * height),
      }
    }
    await locator.click({ force: true, noWaitAfter: true, timeout: 1000, ...(position === undefined ? undefined : { position }) })
  })
}

async function webExecutorHandlePageTreeOperationHover(
  scope: Scope,
  page: playwright.Page,
  hover: TreeOperationHover
): Promise<void> {
  const { nodeLocation } = hover
  const locator = await buildPlaywrightLocator(scope, page, nodeLocation)
  await performOperation(page, async () => {
    await locator.hover({ force: true, noWaitAfter: true, timeout: 1000 })
  })
}

async function webExecutorHandlePageTreeOperationFill(
  scope: Scope,
  page: playwright.Page,
  fill: TreeOperationFill
): Promise<void> {
  const { nodeLocation, value } = fill
  const locator = await buildPlaywrightLocator(scope, page, nodeLocation)
  await performOperation(page, async () => {
    await locator.fill(value)
  })
}

async function webExecutorHandlePageTreeOperationPress(
  scope: Scope,
  page: playwright.Page,
  press: TreeOperationPress
): Promise<void> {
  const { nodeLocation, key } = press
  const locator = await buildPlaywrightLocator(scope, page, nodeLocation)
  await performOperation(page, async () => {
    await locator.press(key)
  })
}

async function webExecutorHandlePageTreeOperationScroll(
  scope: Scope,
  page: playwright.Page,
  scroll: TreeOperationScroll
): Promise<void> {
  const { nodeLocation, positionX, positionY } = scroll
  const locator = await buildPlaywrightLocator(scope, page, nodeLocation)
  await locator.evaluate(
    (node, { positionX, positionY }) => {
      node.scroll(positionX, positionY)
    },
    { positionX, positionY }
  )
}

export async function webExecutorHandlePageTreeOperation(
  scope: Scope,
  page: playwright.Page,
  operation: TreeOperation
): Promise<void> {
  const { click, hover, fill, press, scroll } = operation
  if (click !== undefined) {
    return await webExecutorHandlePageTreeOperationClick(scope, page, click)
  }
  if (hover !== undefined) {
    return await webExecutorHandlePageTreeOperationHover(scope, page, hover)
  }
  if (fill !== undefined) {
    return await webExecutorHandlePageTreeOperationFill(scope, page, fill)
  }
  if (press !== undefined) {
    return await webExecutorHandlePageTreeOperationPress(scope, page, press)
  }
  if (scroll !== undefined) {
    return await webExecutorHandlePageTreeOperationScroll(scope, page, scroll)
  }
  throw new Error("Invalid operation")
}
