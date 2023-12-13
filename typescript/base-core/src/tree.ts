import { abort, abortIfUndefined } from "./debug.js"

export interface TreeNode {
  readonly parent: number | undefined
  readonly children: readonly number[]
  readonly size: number
}

export function buildTree<T>(
  value: T,
  extractChildren: (value: T) => T[]
): { tree: TreeNode[]; values: T[] } {
  const nodes: (TreeNode | undefined)[] = []
  const values: (T | undefined)[] = []
  function processValue(parent: number | undefined, value: T): number {
    const id = nodes.length
    nodes.push(undefined)
    values.push(value)
    nodes[id] = {
      parent,
      children: extractChildren(value).map((value) => processValue(id, value)),
      size: nodes.length - id,
    }
    return id
  }
  processValue(undefined, value)
  return { tree: nodes as TreeNode[], values: values as T[] }
}

export function getTreeNodeAncestors(tree: TreeNode[], id: number): number[] {
  const { parent } = abortIfUndefined(tree[id])
  if (parent === undefined) return [id]
  return [id, ...getTreeNodeAncestors(tree, parent)]
}

export function treeBottomUp<T, R>(
  tree: TreeNode[],
  values: T[],
  fn: (data: T, children: R[], id: number) => R
): R[] {
  const length = tree.length
  if (values.length !== length) {
    throw abort("Tree length not match")
  }
  const result: (R | undefined)[] = new Array<R | undefined>(length)
  for (let idx = length - 1; idx >= 0; --idx) {
    const value = values[idx] as T
    result[idx] = fn(
      value,
      abortIfUndefined(tree[idx]).children.map(
        (childId) => result[childId] as R
      ),
      idx
    )
  }
  return result as R[]
}
