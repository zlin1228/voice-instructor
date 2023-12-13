import { stringRemovePrefix } from "base-core/lib/string.js"
import {
  CookType,
  arrayType,
  doubleType,
  int32Type,
  objectType,
  stringType,
} from "base-core/lib/types.js"
import { isNotUndefined } from "base-core/lib/utils.js"

export const treeNodeAttributeType = objectType([
  { name: "name", type: stringType },
  { name: "value", type: stringType },
])

export type TreeNodeAttribute = CookType<typeof treeNodeAttributeType>

export function getTreeNodeAttributeValueByName(
  attributes: readonly TreeNodeAttribute[],
  name: string
): string | undefined {
  return attributes.find((attribute) => attribute.name === name)?.value
}

export function getTreeNodeAttributesUnderPrefix(
  attributes: readonly TreeNodeAttribute[],
  prefix: string
): TreeNodeAttribute[] {
  return attributes
    .map((attribute) => {
      const name = stringRemovePrefix(attribute.name, prefix)
      return name !== undefined ? { name, value: attribute.value } : undefined
    })
    .filter(isNotUndefined)
}

export const treeNodeType = objectType([
  { name: "nodeId", type: stringType },
  { name: "attributes", type: arrayType(treeNodeAttributeType) },
  { name: "childIds", type: arrayType(stringType) },
])

export type TreeNode = CookType<typeof treeNodeType>

export const treeType = objectType([
  { name: "treeId", type: stringType },
  { name: "nodes", type: arrayType(treeNodeType) },
  { name: "rootNodeId", type: stringType },
])

export type Tree = CookType<typeof treeType>

export const treeNodeLocationType = objectType([
  { name: "treeId", type: stringType },
  { name: "nodeId", type: stringType },
])

export type TreeNodeLocation = CookType<typeof treeNodeLocationType>

export function getTreeNodeTexts(
  tree: Tree,
  nodeLocation: TreeNodeLocation
): string[] {
  if (tree.treeId !== nodeLocation.treeId) {
    return []
  }
  const result: string[] = []
  const nodes = new Map<string, TreeNode>()
  for (const node of tree.nodes) {
    nodes.set(node.nodeId, node)
  }
  const genText = (nodeId: string) => {
    const node = nodes.get(nodeId)
    if (node === undefined) {
      return
    }
    const text = getTreeNodeAttributeValueByName(node.attributes, "core-text")
    if (text !== undefined) {
      result.push(text)
    }
    for (const child of node.childIds) {
      genText(child)
    }
  }
  genText(nodeLocation.nodeId)
  return result
}
