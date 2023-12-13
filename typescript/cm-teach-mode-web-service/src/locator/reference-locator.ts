import { DOMParser } from "@xmldom/xmldom"

import { ReferenceLocator } from "cm-teach-mode-web-common/lib/locator/reference-locator.js"
import {
  DomSnapshot,
  domElementIdAttribute,
  extractElementIdFromDom,
} from "cm-teach-mode-web-common/lib/event/dom-event.js"
import { Locator } from "cm-teach-mode-web-common/lib/locator/locator.js"
import { TreeNode, Tree } from "../tree/tree.js"
import { log } from "base-core/lib/logging.js"

const blacklistedAttributes = [
  "src",
  "href",
  "class",
  "alt",
  "title",
  "target",
  "id",
]

function extractClassNamesFromElement(element: HTMLElement): string[] {
  // element.classList may be undefined from DOMParser
  return [...((element.classList as DOMTokenList | undefined) ?? [])]
}

function extractAttributesFromElement(element: HTMLElement): Attr[] {
  // element.attributes may be undefined from DOMParser
  if (!element.attributes) {
    return []
  }
  // element.attributes may not be iterable from DOMParser
  const attributes: Attr[] = []
  for (let i = 0; i < element.attributes.length; ++i) {
    const attr = element.attributes.item(i)
    if (attr !== null) {
      attributes.push(attr)
    }
  }
  return attributes
}

function extractTagsFromHTMLElement(element: HTMLElement): string[] {
  const tags = []
  const tag = element.tagName.toLowerCase()
  tags.push(tag)
  for (const className of extractClassNamesFromElement(element)) {
    tags.push(`${tag}.${className}`)
  }
  for (const attr of extractAttributesFromElement(element)) {
    if (blacklistedAttributes.includes(attr.name)) {
      continue
    }
    if (attr.name.startsWith("__bunny")) {
      continue
    }
    tags.push(`${tag}[${attr.name}="${attr.value}"]`)
  }
  return tags
}

function isHtmlElement(node: Node | null): node is HTMLElement {
  return (
    node?.nodeType === 1 && // Element
    (node as Element)?.tagName !== "svg"
  )
}

function extractChildrenFromElement(element: HTMLElement): HTMLElement[] {
  if (!element.childNodes) {
    return []
  }
  const children: HTMLElement[] = []
  for (let i = 0; i < element.childNodes.length; ++i) {
    const child = element.childNodes.item(i)
    if (isHtmlElement(child)) {
      children.push(child)
    }
  }
  return children
}

function buildTreeFromDomSnapshot(domSnapshot: DomSnapshot): Tree {
  const { documentOuterHtml } = domSnapshot
  const parser = new DOMParser()
  const document = parser.parseFromString(documentOuterHtml, "text/html")
  const nodes: TreeNode[] = []
  const appendNodesForElement = (element: HTMLElement) => {
    const id = extractElementIdFromDom(element)
    if (id === undefined) return
    const parent = isHtmlElement(element.parentNode)
      ? extractElementIdFromDom(element.parentNode)
      : undefined
    const tags = extractTagsFromHTMLElement(element)
    nodes.push({ id, parent, tags })
    for (const child of extractChildrenFromElement(element)) {
      appendNodesForElement(child)
    }
  }
  appendNodesForElement(document.documentElement)
  return new Tree(nodes)
}

export function locateByReferenceLocator(
  referenceLocator: ReferenceLocator,
  targetDomSnapshot: DomSnapshot
): number | undefined {
  const referenceTree = buildTreeFromDomSnapshot(referenceLocator.domSnapshot)
  const nodeLocation = referenceTree.buildNodeLocation(
    referenceLocator.targetElementId
  )
  const targetTree = buildTreeFromDomSnapshot(targetDomSnapshot)
  return targetTree.locateNodeByNodeLocation(nodeLocation)
}

export function locateByLocator(
  targetDomSnapshot: DomSnapshot,
  locator: Locator
) {
  try {
    const { referenceLocator, selectorLocator } = locator
    if (referenceLocator !== undefined) {
      return locateByReferenceLocator(referenceLocator, targetDomSnapshot)
    }
  } catch (e) {
    log.info("Failed to locate by locator")
    console.log(e)
    throw e
  }
  throw new Error(`Unsupported locator type ${JSON.stringify(locator)}`)
}
