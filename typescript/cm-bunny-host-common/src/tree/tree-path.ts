import {
  arrayConcat,
  arrayIsVector,
  arrayLastOrUndefined,
  arrayRepeat,
  arraySort,
  arrayToVector,
  byKey,
  comparatorChain,
  comparatorExtract,
  comparatorReverse,
} from "base-core/lib/array.js"
import { throwError } from "base-core/lib/exception.js"
import { abortIfUndefined } from "base-core/lib/debug.js"
import { log } from "base-core/lib/logging.js"
import { stringRemovePrefix } from "base-core/lib/string.js"
import {
  Tree,
  TreeNode,
  TreeNodeAttribute,
  TreeNodeLocation,
  getTreeNodeAttributeValueByName,
  getTreeNodeAttributesUnderPrefix,
} from "./tree.js"
import {
  CookType,
  arrayType,
  int32Type,
  objectType,
  stringType,
} from "base-core/lib/types.js"
import { isNotUndefined } from "base-core/lib/utils.js"

export const treeUniLinkDescendantTagType = objectType([
  { name: "tag", type: stringType },
])

export type TreeUniLinkDescendantTag = CookType<
  typeof treeUniLinkDescendantTagType
>

export const treeUniLinkChildTagType = objectType([
  { name: "tag", type: stringType },
  { name: "index", type: int32Type },
  { name: "count", type: int32Type },
])

export type TreeUniLinkChildTag = CookType<typeof treeUniLinkChildTagType>

export const treeUniLinkType = objectType([
  // At most one of the following fields can present.
  {
    name: "descendantTagLink",
    type: treeUniLinkDescendantTagType,
    optional: true,
  },
  { name: "childTagLink", type: treeUniLinkChildTagType, optional: true },
])

export type TreeUniLink = CookType<typeof treeUniLinkType>

export const treeUniStopType = objectType([
  {
    name: "arrivalLinks",
    type: arrayType(
      objectType([
        { name: "from", type: int32Type },
        { name: "uniLink", type: treeUniLinkType },
      ])
    ),
  },
])

export type TreeUniStop = CookType<typeof treeUniStopType>

export const treeUniPathType = objectType([
  {
    name: "stops",
    type: arrayType(treeUniStopType),
  },
])

export type TreeUniPath = CookType<typeof treeUniPathType>

export const treeListPathType = objectType([
  { name: "listNodePath", type: treeUniPathType },
  { name: "tags", type: arrayType(stringType) },
])

export type TreeListPath = CookType<typeof treeListPathType>

interface NodeInfo {
  readonly node: TreeNode
  readonly parent: string | undefined
  readonly tags: readonly string[]

  // Given a tag, which descendants have this tag?
  readonly tagToDescendants: Map<string, readonly string[]>

  // Given a descendant, which tags on this descendant are unique under this node?
  readonly descendantToUniqueTags: Map<string, readonly string[]>

  // A (`tag`, `children`) pair is in this map if and only if all following conditions are met:
  // * `tag` is a unique tag under each child tree in `children`
  // * `tag` is not present under any other child tree
  // * The size of `children` is greater than 1.
  readonly tagToListChildren: Map<string, readonly string[]>
}

const blacklistedAttributes = [
  "src",
  "href",
  "class",
  "alt",
  "title",
  "target",
  "id",
]

function attributesToTags(attributes: readonly TreeNodeAttribute[]): string[] {
  const coreType = getTreeNodeAttributeValueByName(attributes, "core-type")
  if (coreType !== "html-element") {
    return []
  }
  const tags: string[] = []
  const htmlTag = getTreeNodeAttributeValueByName(attributes, "html-tag")
  if (htmlTag === undefined) {
    throw new Error("html-tag attribute not found")
  }
  tags.push(htmlTag)
  const classes =
    getTreeNodeAttributeValueByName(attributes, "html-attr/class")?.split(
      " "
    ) ?? []
  for (const class_ of classes) {
    tags.push(`${htmlTag}.${class_}`)
  }
  for (const { name, value } of getTreeNodeAttributesUnderPrefix(
    attributes,
    "html-attr/"
  )) {
    if (blacklistedAttributes.includes(name)) {
      continue
    }
    tags.push(`${htmlTag}[${name}]`)
    tags.push(`${htmlTag}[${name}="${value}"]`)
  }
  return tags
}

export class TreePathFinder {
  readonly #nodes = new Map<string, NodeInfo>()
  readonly #rootId: string

  constructor(tree: Tree) {
    this.#rootId = tree.rootNodeId
    const parentMap = new Map<string, string>()
    for (const node of tree.nodes) {
      for (const childId of node.childIds) {
        parentMap.set(childId, node.nodeId)
      }
    }
    for (const node of tree.nodes) {
      this.#nodes.set(node.nodeId, {
        node,
        parent: parentMap.get(node.nodeId),
        tags: attributesToTags(node.attributes),
        tagToDescendants: new Map(),
        tagToListChildren: new Map(),
        descendantToUniqueTags: new Map(),
      })
    }
    const fillNodes = (node: NodeInfo) => {
      const nodeChildren = node.node.childIds.map(
        (childId) =>
          [
            childId,
            this.#nodes.get(childId) ?? throwError("Child node not found"),
          ] as const
      )
      for (const [childId, child] of nodeChildren) {
        for (const tag of child.tags) {
          const descendants = node.tagToDescendants.get(tag) ?? []
          node.tagToDescendants.set(tag, [...descendants, childId])
        }
        fillNodes(child)
        for (const [tag, descendants] of child.tagToDescendants) {
          const existingDecendants = node.tagToDescendants.get(tag) ?? []
          node.tagToDescendants.set(tag, [
            ...existingDecendants,
            ...descendants,
          ])
        }
        for (const [tag, descendants] of node.tagToDescendants) {
          if (arrayIsVector(descendants, 1)) {
            node.descendantToUniqueTags.set(descendants[0], [
              ...(node.descendantToUniqueTags.get(descendants[0]) ?? []),
              tag,
            ])
          }
        }
      }
      for (const tag of node.tagToDescendants.keys()) {
        let valid = true
        const listChildren: string[] = []
        for (const [childId, child] of nodeChildren) {
          const length = child.tagToDescendants.get(tag)?.length ?? 0
          if (length === 1) {
            listChildren.push(childId)
          } else if (length > 1) {
            valid = false
            break
          }
        }
        if (!valid) continue
        if (listChildren.length < 2) continue
        node.tagToListChildren.set(tag, listChildren)
      }
    }
    fillNodes(
      this.#nodes.get(tree.rootNodeId) ?? throwError("Root node not found")
    )
  }

  #getNodeOrThrow(nodeId: string): NodeInfo {
    return this.#nodes.get(nodeId) ?? throwError("Node not found")
  }

  getTreeNodeById(nodeId: string): TreeNode {
    return this.#getNodeOrThrow(nodeId).node
  }

  getRootNode(): TreeNode {
    return this.getTreeNodeById(this.#rootId)
  }

  // Returned nodes include targetId but not baseId
  getNodesBetween(baseId: string, targetId: string): readonly string[] {
    const path: string[] = []
    let currentId: string = targetId
    while (currentId !== baseId) {
      path.push(currentId)
      currentId = this.#getNodeOrThrow(currentId).parent ?? throwError("")
    }
    return path.reverse()
  }

  searchUniLinks(baseId: string, targetId: string): TreeUniLink[] {
    const baseInfo = this.#getNodeOrThrow(baseId)
    const targetInfo = this.#getNodeOrThrow(targetId)
    const uniLinks = targetInfo.tags
      .map<TreeUniLink | undefined>((tag) => {
        const descendantIds =
          baseInfo.tagToDescendants.get(tag) ??
          throwError("not a valid descendant")
        if (arrayIsVector(descendantIds, 1)) {
          return {
            descendantTagLink: { tag },
          }
        }
        return undefined
      })
      .filter(isNotUndefined)
    if (targetInfo.parent === baseId) {
      const childTagLinks: TreeUniLinkChildTag[] = []
      for (const tag of targetInfo.tags) {
        let index: number | undefined = undefined
        let count = 0
        for (const child of baseInfo.node.childIds) {
          if (child === targetId) {
            index = count
          }
          if (this.#getNodeOrThrow(child).tags.includes(tag)) {
            ++count
          }
        }
        if (index === undefined) {
          throw new Error("child not found")
        }
        childTagLinks.push({ tag, index, count })
      }
      uniLinks.push(
        ...arraySort(
          childTagLinks,
          comparatorChain(comparatorExtract(byKey("count")))
        ).map((childTagLink) => ({
          childTagLink,
        }))
      )
    }
    return uniLinks
  }

  buildUniPath(baseId: string, targetId: string): TreeUniPath {
    const nodeIds = this.getNodesBetween(baseId, targetId)
    return {
      stops: nodeIds.map<TreeUniStop>((toId, toIdx) => {
        return {
          arrivalLinks: arrayConcat(
            [baseId, ...nodeIds.slice(0, toIdx)].map((fromId, fromIdx) => {
              return this.searchUniLinks(fromId, toId).map((uniLink) => ({
                from: fromIdx,
                uniLink,
              }))
            })
          ),
        }
      }),
    }
  }

  locateUniLink(baseId: string, uniLink: TreeUniLink): string | undefined {
    const { descendantTagLink, childTagLink } = uniLink
    const baseInfo = this.#getNodeOrThrow(baseId)
    if (descendantTagLink !== undefined) {
      const descendantIds =
        baseInfo.tagToDescendants.get(descendantTagLink.tag) ?? []
      if (arrayIsVector(descendantIds, 1)) {
        return descendantIds[0]
      }
      return undefined
    }
    if (childTagLink !== undefined) {
      const { tag, index } = childTagLink
      const childIds = baseInfo.node.childIds.filter((childId) =>
        this.#getNodeOrThrow(childId).tags.includes(tag)
      )
      if (childIds.length !== childTagLink.count) {
        return undefined
      }
      return childIds[index]
    }
    throw new Error("not implemented")
  }

  locateUniPath(baseId: string, uniPath: TreeUniPath): string | undefined {
    let locatedNodeIds: (string | undefined)[] = [baseId]
    for (const stop of uniPath.stops) {
      let locatedNodeId: string | undefined = undefined
      for (const { from, uniLink } of stop.arrivalLinks) {
        const fromId = locatedNodeIds[from]
        if (fromId === undefined) continue
        const toId = this.locateUniLink(fromId, uniLink)
        if (toId === undefined) continue
        locatedNodeId = toId
        break
      }
      locatedNodeIds.push(locatedNodeId)
    }
    return arrayLastOrUndefined(locatedNodeIds)
  }

  buildListPath(baseId: string, firstItemDescendantId: string, secondItemDescendantId: string): TreeListPath | undefined {
    const firstPath = this.getNodesBetween(baseId, firstItemDescendantId)
    const secondPath = this.getNodesBetween(baseId, secondItemDescendantId)
    let commonPathLength = 0
    while (commonPathLength < firstPath.length && firstPath[commonPathLength] === secondPath[commonPathLength]) {
      ++commonPathLength
    }
    const listNodeId = firstPath[commonPathLength - 1] ?? baseId
    const firstItemId = firstPath[commonPathLength] ?? throwError("firstItemId not found")
    const secondItemId = secondPath[commonPathLength] ?? throwError("secondItemId not found")
    const listNodePath = this.buildUniPath(baseId, listNodeId)
    const listNode = this.#getNodeOrThrow(listNodeId)
    // Prefer longer list
    const tags = arraySort([...listNode.tagToListChildren.entries()].map(([tag, children]) => {
      if (children[0] === firstItemId && children[1] === secondItemId) {
        return [tag, children.length] as const
      }
      return undefined
    }).filter(isNotUndefined), comparatorReverse(comparatorExtract(byKey(1)))).map(([tag, count]) => tag)
    if (tags.length === 0) {
      return undefined
    }
    return {
      listNodePath,
      tags,
    }
  }

  locateListPath(baseId: string, listPath: TreeListPath): string[] | undefined {
    const { listNodePath, tags } = listPath
    const listNodeId = this.locateUniPath(baseId, listNodePath)
    if (listNodeId === undefined) {
      return undefined
    }
    const listNode = this.#getNodeOrThrow(listNodeId)
    const nodeChildren = listNode.node.childIds.map(
      (childId) =>
        [
          childId,
          this.#nodes.get(childId) ?? throwError("Child node not found"),
        ] as const
    )
    for (const tag of tags) {
      let invalid = false
      const itemNodeIds: string[] = []
      for (const [childId, child] of nodeChildren) {
        let count = child.tags.includes(tag) ? 1 : 0
        count += child.tagToDescendants.get(tag)?.length ?? 0
        if (count > 1) {
          invalid = true
          break
        }
        if (count === 1) {
          itemNodeIds.push(childId)
        }
      }
      if (invalid) {
        continue
      }
      return itemNodeIds
    }
    return undefined
  }
}

export function treeLocateUni(
  referenceTree: Tree,
  referenceNode: TreeNodeLocation,
  targetTree: Tree
): TreeNodeLocation | undefined {
  const uniPath = new TreePathFinder(referenceTree).buildUniPath(
    referenceTree.rootNodeId,
    referenceNode.nodeId
  )
  const nodeId = new TreePathFinder(targetTree).locateUniPath(
    targetTree.rootNodeId,
    uniPath
  )
  if (nodeId === undefined) {
    return undefined
  }
  return {
    treeId: targetTree.treeId,
    nodeId,
  }
}

export function treeLocateList(
  referenceTree: Tree,
  firstItemDescendantNode: TreeNodeLocation,
  secondItemDescendantNode: TreeNodeLocation,
  targetTree: Tree): TreeNodeLocation[] | undefined {
  const listPath = new TreePathFinder(referenceTree).buildListPath(
    referenceTree.rootNodeId,
    firstItemDescendantNode.nodeId,
    secondItemDescendantNode.nodeId
  )
  if (listPath === undefined) {
    return undefined
  }
  const nodeIds = new TreePathFinder(targetTree).locateListPath(targetTree.rootNodeId, listPath)
  if (nodeIds === undefined) {
    return undefined
  }
  return nodeIds.map((nodeId) => ({
    treeId: targetTree.treeId,
    nodeId,
  }))
}

