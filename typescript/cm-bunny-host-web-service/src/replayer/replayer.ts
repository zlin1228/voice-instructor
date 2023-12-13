import { playwright } from "base-playwright/lib/deps.js"
import {
  Scope,
  launchBackgroundScope,
  sleepSeconds,
} from "base-core/lib/scope.js"
import { log } from "base-core/lib/logging.js"
import { scriptFetchTree, scriptRegisterBunnyUtil } from "../common/scripts.js"
import { commonNormalizer } from "base-core/lib/types-common.js"
import { TreeStep } from "cm-bunny-host-common/lib/tree/tree-procedure.js"
import {
  TreePathFinder,
  TreeUniPath,
} from "cm-bunny-host-common/lib/tree/tree-path.js"
import {
  Tree,
  getTreeNodeAttributeValueByName,
  treeType,
} from "cm-bunny-host-common/lib/tree/tree.js"
import { WebExecutor } from "cm-bunny-host-web-common/lib/action/web-action.js"
import { stringRandomSimpleName } from "base-core/lib/string.js"
import { PageExecutor } from "cm-bunny-host-web-common/lib/action/page-action.js"
import { TreeExecutor } from "cm-bunny-host-common/lib/tree/tree-action.js"
import { TreeNodeLocation } from "cm-bunny-host-common/lib/tree/tree.js"
import { RecordedTreeStep } from "../recorder/recorded.js"

async function locateTreeNode(
  scope: Scope,
  treeExecutor: TreeExecutor,
  uniPath: TreeUniPath
): Promise<TreeNodeLocation | undefined> {
  const scrollOffsetY = 200
  // loop for full-retry
  for (let i = 0; i < 3; i++) {
    // loop for scrolling page down
    for (;;) {
      const tree = await treeExecutor.fetchTree(scope)
      const pathFinder = new TreePathFinder(tree)
      const nodeId = pathFinder.locateUniPath(tree.rootNodeId, uniPath)
      if (nodeId !== undefined) {
        return {
          treeId: tree.treeId,
          nodeId,
        }
      }
      const root = pathFinder.getRootNode()
      const scrollHeight = Number(
        getTreeNodeAttributeValueByName(
          root.attributes,
          "html-prop/scrollHeight"
        )
      )
      const scrollTop = Number(
        getTreeNodeAttributeValueByName(root.attributes, "html-prop/scrollTop")
      )
      const clientHeight = Number(
        getTreeNodeAttributeValueByName(
          root.attributes,
          "html-prop/clientHeight"
        )
      )
      const shouldScroll =
        scrollHeight >= scrollTop + scrollOffsetY + clientHeight
      if (!shouldScroll) {
        break
      }
      await treeExecutor.doOperation(scope, {
        scroll: {
          nodeLocation: {
            treeId: tree.treeId,
            nodeId: tree.rootNodeId,
          },
          positionX: 0,
          positionY: scrollTop + scrollOffsetY,
        },
      })
      await sleepSeconds(scope, 0.5)
    }
    const tree = await treeExecutor.fetchTree(scope)
    await treeExecutor.doOperation(scope, {
      scroll: {
        nodeLocation: {
          treeId: tree.treeId,
          nodeId: tree.rootNodeId,
        },
        positionX: 0,
        positionY: 0,
      },
    })
    await sleepSeconds(scope, 5)
  }
  return undefined
}

export async function replayTreeSteps(
  scope: Scope,
  url: string,
  webExecutor: WebExecutor,
  stepIterable: AsyncIterable<RecordedTreeStep>
): Promise<void> {
  const contextId = stringRandomSimpleName(6)
  const pageId = stringRandomSimpleName(6)
  await webExecutor.createContext(scope, contextId)
  scope.onLeave(async () => {
    await webExecutor.deleteContext(scope, contextId)
  })
  await webExecutor.createPage(scope, contextId, pageId)
  const pageExecutor = webExecutor.buildPageExecutor(pageId)
  await pageExecutor.navigate(scope, url)
  const treeExecutor = pageExecutor.buildTreeExecutor()
  try {
    for await (const recordedTreeStep of stepIterable) {
      const { treeStep } = recordedTreeStep
      try {
        log.info("Replay step")
        console.log(treeStep)
        const { click, fill, press, extract } = treeStep
        if (click !== undefined) {
          const nodeLocation = await locateTreeNode(
            scope,
            treeExecutor,
            click.uniPath
          )
          if (nodeLocation === undefined) {
            log.info("Failed to locate element")
            throw new Error("Failed to locate element")
          }
          await treeExecutor.doOperation(scope, {
            click: {
              nodeLocation,
            },
          })
        }
        if (fill !== undefined) {
          const nodeLocation = await locateTreeNode(
            scope,
            treeExecutor,
            fill.uniPath
          )
          if (nodeLocation === undefined) {
            log.info("Failed to locate element")
            throw new Error("Failed to locate element")
          }
          await treeExecutor.doOperation(scope, {
            fill: {
              nodeLocation,
              value: fill.value,
            },
          })
        }
        if (press !== undefined) {
          const nodeLocation = await locateTreeNode(
            scope,
            treeExecutor,
            press.uniPath
          )
          if (nodeLocation === undefined) {
            log.info("Failed to locate element")
            throw new Error("Failed to locate element")
          }
          await treeExecutor.doOperation(scope, {
            press: {
              nodeLocation,
              key: press.key,
            },
          })
        }
      } catch (e) {
        log.info("Replay action error")
        console.log(e)
        throw e
      }
    }
  } catch (e) {
    log.info("Replay error")
    console.log(e)
  }
}
