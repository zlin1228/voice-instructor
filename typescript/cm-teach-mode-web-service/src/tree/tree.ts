import {
  arrayRepeat,
  arraySort,
  arrayToVector,
  byKey,
  comparatorChain,
  comparatorExtract,
} from "base-core/lib/array.js"
import { throwError } from "base-core/lib/exception.js"
import { abortIfUndefined } from "base-core/lib/debug.js"
import { log } from "base-core/lib/logging.js"

export interface TreeNode {
  id: number
  parent: number | undefined
  tags: string[]
}

interface NodeInfo {
  readonly id: number
  readonly parent: number | undefined
  readonly children: readonly number[]
  readonly tags: readonly string[]

  // Given a tag, which descendants have this tag?
  readonly tagToDescendants: Map<string, readonly number[]>

  // Given a descendant, which tags on this descendant are unique under this node?
  readonly descendantToUniqueTags: Map<number, readonly string[]>
}

export interface TagLocation {
  tag: string
  count: number
  index: number
}

// [targetDepth - 1][baseDepth][sorted-by-count]
export type NodeLocation = TagLocation[][][]

export class Tree {
  readonly #nodes = new Map<number, NodeInfo>()
  readonly #rootId: number

  constructor(nodes: TreeNode[]) {
    const nodesById = new Map<number, TreeNode>()
    const childrenMap = new Map<number, number[]>()
    const tagToDescendantsMap = new Map<number, Map<string, number[]>>()
    let rootId: number | undefined = undefined
    for (const node of nodes) {
      if (node.parent === undefined) {
        if (rootId !== undefined) {
          throw new Error("Multiple root nodes")
        }
        rootId = node.id
      } else if (node.parent === node.id) {
        throw new Error("Node is its own parent")
      } else {
        const children = childrenMap.get(node.parent) ?? []
        childrenMap.set(node.parent, [...children, node.id])
      }
      nodesById.set(node.id, node)
    }
    if (rootId === undefined) {
      throw new Error("No root node")
    }
    this.#rootId = rootId
    let visited = new Set<number>()
    const fillTagToDescendantsMap = (nodeId: number) => {
      if (visited.has(nodeId)) {
        console.log("Duplicate node")
        abortIfUndefined(undefined)
      }
      visited.add(nodeId)
      const tagToDescendants = new Map<string, number[]>()
      for (const child of childrenMap.get(nodeId) ?? []) {
        for (const tag of abortIfUndefined(nodesById.get(child)).tags) {
          const descendants = tagToDescendants.get(tag) ?? []
          tagToDescendants.set(tag, [...descendants, child])
        }
        fillTagToDescendantsMap(child)
        const childTagToDescendants =
          tagToDescendantsMap.get(child) ?? new Map<string, number[]>()
        for (const [tag, descendants] of childTagToDescendants) {
          const existingDecendants = tagToDescendants.get(tag) ?? []
          tagToDescendants.set(tag, [...existingDecendants, ...descendants])
        }
      }
      tagToDescendantsMap.set(nodeId, tagToDescendants)
    }
    fillTagToDescendantsMap(rootId)
    for (const node of nodes) {
      const tagToDescendants: Map<string, number[]> =
        tagToDescendantsMap.get(node.id) ?? new Map()
      const descendantToUniqueTags = new Map<number, string[]>()
      for (const [tag, descendants] of tagToDescendants) {
        const descendantsVector = arrayToVector(descendants, 1)
        if (descendantsVector === undefined) {
          continue
        }
        const tags = descendantToUniqueTags.get(descendantsVector[0]) ?? []
        descendantToUniqueTags.set(descendantsVector[0], [...tags, tag])
      }
      this.#nodes.set(node.id, {
        id: node.id,
        parent: node.parent,
        children: childrenMap.get(node.id) ?? [],
        tags: node.tags,
        tagToDescendants,
        descendantToUniqueTags,
      })
    }
  }

  #getNodeInfoOrThrow(nodeId: number): NodeInfo {
    return this.#nodes.get(nodeId) ?? throwError("Node not found")
  }

  getPathFromRoot(nodeId: number): readonly number[] {
    const path: number[] = []
    let currentId: number | undefined = nodeId
    while (currentId !== undefined) {
      path.push(currentId)
      currentId = this.#getNodeInfoOrThrow(currentId).parent
    }
    return path.reverse()
  }

  buildTagLocations(baseId: number, targetId: number): TagLocation[] {
    const baseInfo = this.#getNodeInfoOrThrow(baseId)
    const targetInfo = this.#getNodeInfoOrThrow(targetId)
    const matches = targetInfo.tags.map((tag) => {
      const descendantIds =
        baseInfo.tagToDescendants.get(tag) ??
        throwError("not a valid descendant")
      const index =
        descendantIds.indexOf(targetId) ?? throwError("not a valid descendant")
      return { tag, count: descendantIds.length, index }
    })
    return arraySort(
      matches,
      comparatorChain(comparatorExtract(byKey("count")))
    )
  }

  buildNodeLocation(nodeId: number): NodeLocation {
    const pathIds = this.getPathFromRoot(nodeId)
    return pathIds.slice(1).map((targetId, idx) => {
      const targetDepth = idx + 1
      return pathIds.slice(0, targetDepth).map((baseId) => {
        return this.buildTagLocations(baseId, targetId)
      })
    })
  }

  locateNodeByTagLocation(
    tagLocation: TagLocation,
    baseId: number
  ): number | undefined {
    const baseInfo = this.#getNodeInfoOrThrow(baseId)
    const descendantIds = baseInfo.tagToDescendants.get(tagLocation.tag) ?? []
    return descendantIds[tagLocation.index]
  }

  locateNodeByNodeLocation(nodeLocation: NodeLocation): number | undefined {
    let nodeIdsByDepth: (number | undefined)[] = [this.#rootId]
    for (
      let targetDepth = 1;
      targetDepth < nodeLocation.length + 1;
      ++targetDepth
    ) {
      let choices: {
        baseDepth: number
        baseId: number
        tagLocation: TagLocation
      }[] = []
      for (let baseDepth = 0; baseDepth < targetDepth; ++baseDepth) {
        const baseId = nodeIdsByDepth[baseDepth]
        if (baseId === undefined) continue
        const tagLocations =
          nodeLocation[targetDepth - 1]?.[baseDepth] ??
          throwError("invalid node location")
        for (const tagLocation of tagLocations)
          choices.push({ baseDepth, baseId, tagLocation })
      }
      choices = arraySort(
        choices,
        comparatorChain(comparatorExtract((choice) => choice.tagLocation.count))
      )
      const firstChoice = choices[0]
      if (firstChoice === undefined) {
        nodeIdsByDepth.push(undefined)
        continue
      }
      nodeIdsByDepth.push(
        this.locateNodeByTagLocation(
          firstChoice.tagLocation,
          firstChoice.baseId
        )
      )
    }
    const notFound = nodeIdsByDepth[nodeLocation.length] === undefined
    if (notFound) {
      console.log(JSON.stringify(nodeLocation, null, 2))
      console.log(nodeIdsByDepth)
      log.info("Failed to locate node")
    }
    return nodeIdsByDepth[nodeLocation.length]
  }

  // findDescendantsWithTag(nodeId: number, tag: string): readonly number[] {
  //   return this.#getNodeInfoOrThrow(nodeId).tagToDescendants.get(tag) ?? []
  // }

  // findUniqueTagsOnDescendant(
  //   nodeId: number,
  //   descendantId: number
  // ): readonly string[] {
  //   return (
  //     this.#getNodeInfoOrThrow(nodeId).descendantToUniqueTags.get(
  //       descendantId
  //     ) ?? []
  //   )
  // }
}
