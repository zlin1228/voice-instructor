import {
  Scope,
  launchBackgroundScope,
  sleepSeconds,
  sleepUntilCancel,
} from "base-core/lib/scope.js"
import { WebExecutor } from "cm-bunny-host-web-common/lib/action/web-action.js"
import {
  BunnyHostWebHttpService,
  PresetStepRequest,
  PresetStepResponse,
} from "cm-bunny-host-web-common/lib/service/schema.js"
import { playwright } from "base-playwright/lib/deps.js"
import { log } from "base-core/lib/logging.js"
import { OneOf } from "base-core/lib/one-of.js"
import {
  Tree,
  TreeNode,
  TreeNodeLocation,
  getTreeNodeAttributeValueByName,
  getTreeNodeTexts,
} from "cm-bunny-host-common/lib/tree/tree.js"
import { buildAsyncGenerator } from "base-core/lib/processing.js"
import { PageExecutor } from "cm-bunny-host-web-common/lib/action/page-action.js"
import { throwError } from "base-core/lib/exception.js"
import { TreeExecutor } from "cm-bunny-host-common/lib/tree/tree-action.js"
import {
  TreePathFinder,
  treeLocateUni,
  treeLocateList,
} from "cm-bunny-host-common/lib/tree/tree-path.js"
import { OperationLocation, PresetStep } from "cm-bunny-host-web-common/lib/preset/preset.js"
import { isNotUndefined } from "base-core/lib/utils.js"
import { abortIfUndefined } from "base-core/lib/debug.js"

export interface BunnyHostWebService extends BunnyHostWebHttpService {
  handleSelectedNode: (
    scope: Scope,
    clientMessageIter: AsyncIterable<OneOf<{ json: {}; binary: Uint8Array }>>
  ) => AsyncIterable<OneOf<{ json: TreeNodeLocation; binary: Uint8Array }>>
}

async function getDefaultPageExecutor(
  scope: Scope,
  webExecutor: WebExecutor
): Promise<PageExecutor> {
  const pageId =
    (await webExecutor.listContexts(scope)).contexts[0]?.pageIds[0] ??
    throwError("No default page found")
  return webExecutor.buildPageExecutor(pageId)
}

async function locateStaticTreeNode(
  scope: Scope,
  treeExecutor: TreeExecutor,
  referenceTree: Tree,
  referenceNode: TreeNodeLocation
): Promise<TreeNodeLocation | undefined> {
  const scrollOffsetY = 200
  // loop for full-retry
  for (let i = 0; i < 3; i++) {
    // loop for scrolling page down
    for (; ;) {
      const tree = await treeExecutor.fetchTree(scope)
      const nodeLocation = treeLocateUni(referenceTree, referenceNode, tree)
      if (nodeLocation !== undefined) {
        return nodeLocation
      }
      const pathFinder = new TreePathFinder(tree)
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

async function findBestContentMatch(scope: Scope, candidates: string[], target: string): Promise<string | undefined> {
  log.info(`candidates: ${candidates.join(", ")}`)
  log.info(`target: ${target}`)
  const result = candidates.find((candidate) => candidate.includes(target))
  log.info(`result: ${result ?? "(no matched)"}`)
  return result
}

async function locateListTreeNode(
  scope: Scope,
  treeExecutor: TreeExecutor,
  referenceTree: Tree,
  firstItemDescendantNode: TreeNodeLocation,
  secondItemDescendantNode: TreeNodeLocation,
  subjectNode: TreeNodeLocation,
  targetNode: TreeNodeLocation,
): Promise<Map<string, TreeNodeLocation>> {
  const referenceItemNodeLocations = treeLocateList(referenceTree, firstItemDescendantNode, secondItemDescendantNode, referenceTree)
  if (referenceItemNodeLocations === undefined) {
    throw new Error("Failed to locate list node in reference tree")
  }
  const referencePathFinder = new TreePathFinder(referenceTree)
  const subjectNodeRootPath = referencePathFinder.getNodesBetween(referenceTree.rootNodeId, subjectNode.nodeId)
  const referenceSubjectItemNodeLocation = referenceItemNodeLocations.find((nodeLocation) => {
    return subjectNodeRootPath.includes(nodeLocation.nodeId)
  })
  if (referenceSubjectItemNodeLocation === undefined) {
    throw new Error("Failed to locate item node for subject in reference tree")
  }
  const subjectUniPath = referencePathFinder.buildUniPath(referenceSubjectItemNodeLocation.nodeId, subjectNode.nodeId)
  const targetNodeRootPath = referencePathFinder.getNodesBetween(referenceTree.rootNodeId, targetNode.nodeId)
  const referenceTargetItemNodeLocation = referenceItemNodeLocations.find((nodeLocation) => {
    return targetNodeRootPath.includes(nodeLocation.nodeId)
  })
  if (referenceTargetItemNodeLocation === undefined) {
    throw new Error("Failed to locate item node for target in reference tree")
  }
  const targetUniPath = referencePathFinder.buildUniPath(referenceTargetItemNodeLocation.nodeId, targetNode.nodeId)
  const scrollOffsetY = 200
  // loop for full-retry
  for (let i = 0; i < 3; i++) {
    // loop for scrolling page down
    for (; ;) {
      const tree = await treeExecutor.fetchTree(scope)
      const itemNodeLocations = treeLocateList(
        referenceTree, firstItemDescendantNode, secondItemDescendantNode, tree)
      const pathFinder = new TreePathFinder(tree)
      if (itemNodeLocations !== undefined) {
        const itemNodeSubjects = itemNodeLocations.map((itemNodeLocation) => {
          const subjectItemNode = pathFinder.locateUniPath(itemNodeLocation.nodeId, subjectUniPath)
          if (subjectItemNode === undefined) return undefined
          const targetItemNode = pathFinder.locateUniPath(itemNodeLocation.nodeId, targetUniPath)
          if (targetItemNode === undefined) return undefined
          return [getTreeNodeTexts(tree, {
            treeId: tree.treeId,
            nodeId: subjectItemNode,
          }).join(" "), {
            treeId: tree.treeId,
            nodeId: targetItemNode
          }] as const
        }).filter(isNotUndefined)
        return new Map(itemNodeSubjects)
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
  throw new Error("Failed to locate list node")
}

async function processOperationLocation<T>(
  scope: Scope,
  treeExecutor: TreeExecutor,
  tree: Tree,
  argumentList: readonly { name: string; value: string }[],
  operationLocation: OperationLocation,
  body: (nodeLocation: TreeNodeLocation) => Promise<T>
): Promise<T[]> {
  const result: T[] = []
  const { staticLocation, listOneLocation, listAllLocation } = operationLocation
  if (staticLocation !== undefined) {
    const nodeLocation = await locateStaticTreeNode(
      scope,
      treeExecutor,
      tree,
      staticLocation
    )
    if (nodeLocation === undefined) {
      throw new Error("Failed to locate node")
    }
    result.push(await body(nodeLocation))
  } else if (listOneLocation !== undefined) {
    const argumentName = listOneLocation.argumentName
    const argumentValue = argumentList.find((arg) => arg.name === argumentName)?.value
    if (argumentValue === undefined) {
      throw new Error("Argument is not available")
    }
    const contentToNodeLocations = await locateListTreeNode(
      scope,
      treeExecutor,
      tree,
      listOneLocation.listLocation.firstSubjectLocation,
      listOneLocation.listLocation.secondSubjectLocation,
      listOneLocation.listLocation.firstSubjectLocation,
      listOneLocation.targetLocation
    )
    const candidates = [...contentToNodeLocations.keys()]
    const bestCandidate = await findBestContentMatch(scope, candidates, argumentValue)
    if (bestCandidate === undefined) {
      throw new Error("Failed to find the matched item in the list")
    }
    const nodeLocation = abortIfUndefined(contentToNodeLocations.get(bestCandidate))
    result.push(await body(nodeLocation))
  } else if (listAllLocation !== undefined) {
    const contentToNodeLocations = await locateListTreeNode(
      scope,
      treeExecutor,
      tree,
      listAllLocation.listLocation.firstSubjectLocation,
      listAllLocation.listLocation.secondSubjectLocation,
      listAllLocation.listLocation.firstSubjectLocation,
      listAllLocation.targetLocation
    )
    for (const nodeLocation of contentToNodeLocations.values()) {
      await sleepSeconds(scope, 1)
      result.push(await body(nodeLocation))
    }
  }
  return result
}

async function performPresetStep(
  scope: Scope,
  pageExecutor: PageExecutor,
  request: PresetStepRequest
): Promise<PresetStepResponse> {
  const treeExecutor = pageExecutor.buildTreeExecutor()
  const { click, fill, report, richComponent, hover, scroll, press, configuration, slider } = request.presetStep
  if (click !== undefined) {
    await processOperationLocation(
      scope,
      treeExecutor,
      request.presetStep.tree,
      request.argumentList,
      click.operationLocation,
      async (nodeLocation) => {
        await treeExecutor.doOperation(scope, {
          click: {
            nodeLocation,
          },
        })
      })
    return {}
  } else if (fill !== undefined) {
    const { staticText, argumentName } = fill
    const value =
      staticText ??
      request.argumentList.find((arg) => arg.name === argumentName)?.value
    if (value === undefined) {
      throw new Error("Text is required")
    }
    await processOperationLocation(
      scope,
      treeExecutor,
      request.presetStep.tree,
      request.argumentList,
      fill.operationLocation,
      async (nodeLocation) => {
        await treeExecutor.doOperation(scope, {
          fill: {
            nodeLocation,
            value,
          },
        })
        if (fill.pressEnter) {
          await sleepSeconds(scope, 5)
          await treeExecutor.doOperation(scope, {
            press: {
              nodeLocation,
              key: "Enter",
            },
          })
        }
      })
    return {}
  } else if (report !== undefined) {
    const lines = await processOperationLocation(
      scope,
      treeExecutor,
      request.presetStep.tree,
      request.argumentList,
      report.operationLocation,
      async (nodeLocation) => {
        const tree = await treeExecutor.fetchTree(scope)
        const texts = getTreeNodeTexts(tree, nodeLocation)
        return texts.join(" ")
      })
    return {
      report: lines.join("\n"),
    }
  } else if (richComponent !== undefined) {
    // Do nothing
    return {}
  } else if (hover !== undefined) {
    await processOperationLocation(
      scope,
      treeExecutor,
      request.presetStep.tree,
      request.argumentList,
      hover.operationLocation,
      async (nodeLocation) => {
        await treeExecutor.doOperation(scope, {
          hover: {
            nodeLocation,
          },
        })
      })
    return {}
  } else if (scroll !== undefined) {
    // Do nothing
    return {}
  } else if (press !== undefined) {
    await processOperationLocation(
      scope,
      treeExecutor,
      request.presetStep.tree,
      request.argumentList,
      press.operationLocation,
      async (nodeLocation) => {
        await treeExecutor.doOperation(scope, {
          press: {
            nodeLocation,
            key: press.keyName,
          },
        })
      })
    return {}
  } else if (configuration !== undefined) {
    // Do nothing
    return {}
  } else if (slider !== undefined) {
    await processOperationLocation(
      scope,
      treeExecutor,
      request.presetStep.tree,
      request.argumentList,
      slider.operationLocation,
      async (nodeLocation) => {
        await treeExecutor.doOperation(scope, {
          click: {
            nodeLocation,
            positionRatioX: slider.positionRatioValue,
          },
        })
      })
    return {}
  }
  throw new Error("Invalid preset step")
}

export async function buildBunnyHostWebService(
  scope: Scope,
  webExecutor: WebExecutor
): Promise<BunnyHostWebService> {
  let ready = false
  return {
    post_webAction: async (scope, request) => {
      return await webExecutor.execute(scope, request)
    },
    post_presetStep: async (scope, request) => {
      const pageExecutor = await getDefaultPageExecutor(scope, webExecutor)
      return await performPresetStep(scope, pageExecutor, request)
    },
    get_healthz: async (scope, request) => {
      if (!ready) {
        const browser = await playwright.chromium.connectOverCDP(
          "http://localhost:9222",
          {
            timeout: 1000,
          }
        )
        await browser.close()
        ready = true
      } else {
        try {
          const browser = await playwright.chromium.connectOverCDP(
            "http://localhost:9222",
            {
              timeout: 10000,
            }
          )
          await browser.close()
        } catch (e) {
          log.info("Failed to connect to chromium after it is ready")
          console.log(e)
          throw e
        }
      }
      return {}
    },
    handleSelectedNode: function (
      scope,
      clientMessageIter: AsyncIterable<OneOf<{ json: {}; binary: Uint8Array }>>
    ): AsyncGenerator<OneOf<{ json: TreeNodeLocation; binary: Uint8Array }>> {
      return buildAsyncGenerator(async (push) => {
        webExecutor.selectedNodeBroadcast.listen(scope, (nodeLocation) => {
          launchBackgroundScope(scope, async (scope) => {
            await push({ kind: "json", value: nodeLocation })
          })
        })
        await sleepUntilCancel(scope)
      })
    },
  }
}
