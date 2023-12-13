import type {
  Tree,
  TreeNode,
  TreeNodeAttribute,
  TreeNodeLocation,
} from "cm-bunny-host-common/lib/tree/tree.js"
import type { TreeInteractionMode } from "cm-bunny-host-common/lib/tree/tree-interaction.js"

export interface BunnyUtils {
  originWindow: Window
  assignOrGetNodeId: (node: Node) => string
  fetchTree: () => Tree
  setInteractionMode: (mode: TreeInteractionMode) => void
}

// We attach some global data to the Math object.
// This is a hack to make the data accessible from the browser context.
// We don't attach it to the Window object because some websites deliberately remove all unknown properties from the Window object.
export interface BunnyMath extends Math {
  __bunnyUtils?: BunnyUtils
}

// The following attribute names must be consistent with the one in the below file:
// typescript/cm-bunny-host-web-common/src/record/dom-event.ts
// this file - scriptRegisterBunnyUtil()
export const nodeIdAttribute = "__bunny_node_id"
export const treeIdAttribute = "__bunny_tree_id"

export function scriptRegisterBunnyUtil(mode: TreeInteractionMode) {
  // https://developer.mozilla.org/en-US/docs/Web/Events
  const allEventTypes = [
    "click",
    "dblclick",
    "keydown",
    "keypress",
    "keyup",
    "mousedown",
    "mouseenter",
    "mouseleave",
    "mousemove",
    "mouseout",
    "mouseover",
    "mouseup",
    "mousewheel",
    "paste",
    "scroll",
    "select",
    "wheel",
  ] as const

  let bunnyReportSelected = (
    window as Window & {
      ["__bunnyReportSelected"]?: (data: string) => Promise<void>
    }
  ).__bunnyReportSelected?.bind(window)
  if (bunnyReportSelected === undefined) {
    console.log(`Callback __bunnyReportSelected is not registered`)
  }
  const reportSelected = (nodeLocation: TreeNodeLocation): void => {
    void bunnyReportSelected?.(JSON.stringify(nodeLocation))
  }

  let bunnyGetInteractionMode = (
    window as Window & {
      ["__bunnyGetInteractionMode"]?: (data: string) => Promise<string>
    }
  ).__bunnyGetInteractionMode?.bind(window)
  if (bunnyGetInteractionMode === undefined) {
    console.log(`Callback __bunnyGetInteractionMode is not registered`)
  }
  const getInteractionMode = async (): Promise<TreeInteractionMode> => {
    if (bunnyGetInteractionMode === undefined) {
      throw new Error("bunnyGetInteractionMode is not registered")
    }
    return JSON.parse(await bunnyGetInteractionMode("{}"))
  }

  void getInteractionMode().then((newMode) => {
    mode = newMode
  })

  function buildBunnyUtils(): BunnyUtils {
    const originWindow = window

    // The following attribute names must be consistent with the definition above:
    const nodeIdAttribute = "__bunny_node_id"
    const treeIdAttribute = "__bunny_tree_id"
    const nodeIdMap = new WeakMap<Node, string>()

    function buildRandomString(): string {
      let result = ""
      const characters = "abcdefghijklmnopqrstuvwxyz0123456789"
      for (let i = 0; i < 8; i++) {
        result += characters.charAt(
          Math.floor(Math.random() * characters.length)
        )
      }
      return result
    }

    const treeId = buildRandomString()

    let nextNodeId = 0

    function assignOrGetNodeId(node: Node): string {
      const existingNodeId = nodeIdMap.get(node)
      if (existingNodeId !== undefined) {
        return existingNodeId
      }
      const nodeId = String(nextNodeId++)
      nodeIdMap.set(node, nodeId)
      if (node instanceof Element) {
        node.setAttribute(nodeIdAttribute, nodeId)
      }
      return nodeId
    }

    function buildTextAttributes(node: Text): TreeNodeAttribute[] {
      const attributes: TreeNodeAttribute[] = []
      attributes.push({
        name: "core-type",
        value: "html-text",
      })
      attributes.push({
        name: "core-text",
        value: node.data,
      })
      return attributes
    }

    function buildElementAttributes(element: Element): TreeNodeAttribute[] {
      const attributes: TreeNodeAttribute[] = []
      attributes.push({
        name: "core-type",
        value: "html-element",
      })
      attributes.push({
        name: "html-tag",
        value: element.tagName.toLowerCase(),
      })
      for (const attribute of element.attributes) {
        if ([treeIdAttribute, nodeIdAttribute].includes(attribute.name)) {
          continue
        }
        attributes.push({
          name: `html-attr/${attribute.name}`,
          value: attribute.value,
        })
      }
      for (const prop of [
        "scrollHeight",
        "clientHeight",
        "scrollTop",
      ] as const) {
        attributes.push({
          name: `html-prop/${prop}`,
          value: String(element[prop]),
        })
      }
      for (const computedStyle of ["display", "visibility"] as const) {
        const value = originWindow.getComputedStyle(element).getPropertyValue(
          computedStyle
        )
        if (value !== "") {
          attributes.push({
            name: `html-style/${computedStyle}`,
            value,
          })
        }
      }
      if (element === element.ownerDocument.documentElement) {
        attributes.push({
          name: "html-url",
          value: element.ownerDocument.location.href,
        })
      }
      return attributes
    }

    function fetchTree(): Tree {
      const nodes: TreeNode[] = []
      const processNode = (node: Node): string | undefined => {
        if (node instanceof Element) {
          if (["HEAD", "SCRIPT"].includes(node.tagName)) {
            return undefined
          }
          const nodeId = assignOrGetNodeId(node)
          const attributes = buildElementAttributes(node)
          const childIds: string[] = []
          nodes.push({
            nodeId,
            attributes,
            childIds,
          })
          for (let i = 0; i < node.childNodes.length; ++i) {
            const childNode = node.childNodes[i]
            if (childNode === undefined) {
              continue
            }
            const nodeId = processNode(childNode)
            if (nodeId !== undefined) {
              childIds.push(nodeId)
            }
          }
          return nodeId
        } else if (node instanceof Text) {
          const nodeId = assignOrGetNodeId(node)
          const attributes = buildTextAttributes(node)
          nodes.push({
            nodeId,
            attributes,
            childIds: [],
          })
          return nodeId
        }
        return undefined
      }
      originWindow.document.documentElement.setAttribute(
        treeIdAttribute,
        treeId
      )
      processNode(originWindow.document.documentElement)
      return {
        treeId,
        nodes,
        rootNodeId: assignOrGetNodeId(originWindow.document.documentElement),
      }
    }

    const findEventTargetElement = (
      eventTarget: EventTarget
    ): HTMLElement | undefined => {
      let node: EventTarget | Node = eventTarget
      for (; ;) {
        if (node instanceof HTMLElement) {
          return node
        }
        if (node instanceof Node) {
          const parent: Node | null = node.parentNode
          if (parent === null) {
            return undefined
          }
          node = parent
        }
      }
    }
    const findEventTargetElementIdOrThrow = (
      eventTarget: EventTarget | null
    ): string => {
      if (eventTarget === null) {
        throw new Error("Event target is null")
      }
      const element = findEventTargetElement(eventTarget)
      if (element === undefined) {
        console.log("Event target:", eventTarget)
        throw new Error("Cannot find the HTMLElement for the event target")
      }
      return assignOrGetNodeId(element)
    }

    let selectingElement: HTMLElement | undefined = undefined
    let selectingBoxShadow: string | undefined = undefined
    for (const eventType of allEventTypes) {
      originWindow.addEventListener(
        eventType,
        (event) => {
          if (mode.selecting) {
            event.stopImmediatePropagation()
            event.preventDefault()
            if (event.type === "click") {
              fetchTree()
              reportSelected({
                treeId,
                nodeId: findEventTargetElementIdOrThrow(event.target),
              })
            } else if (event.type === "mouseover") {
              if (selectingElement !== undefined) {
                selectingElement.style.boxShadow = selectingBoxShadow ?? ""
                selectingElement = undefined
                selectingBoxShadow = undefined
              }
              const nodeId = findEventTargetElementIdOrThrow(event.target)
              console.log("Mouseover:", nodeId)
              const element = originWindow.document.querySelector(
                `[${nodeIdAttribute}="${nodeId}"]`
              )
              if (element === null || !(element instanceof HTMLElement)) return
              console.log(element)
              selectingElement = element
              selectingBoxShadow = element.style.boxShadow
              element.style.boxShadow =
                "0 0 2px rgba(255,0,0,1), 0 0 32px rgba(32,0,0,0.5), inset 0 0 20px rgba(32,256,256,0.5)"
            }
          }
        },
        { capture: true }
      )
    }

    const highlightedElements: {
      element: HTMLElement,
      boxShadow: string,
    }[] = []


    function setInteractionMode(
      treeInteractionMode: TreeInteractionMode
    ): void {
      mode = treeInteractionMode
      for (const { element, boxShadow } of highlightedElements) {
        element.style.boxShadow = boxShadow
      }
      for (const nodeLocation of treeInteractionMode.highlight ?? []) {
        if (nodeLocation.treeId !== treeId) continue
        const element = originWindow.document.querySelector(
          `[${nodeIdAttribute}="${nodeLocation.nodeId}"]`
        )
        if (element === null || !(element instanceof HTMLElement)) continue
        highlightedElements.push({
          element,
          boxShadow: element.style.boxShadow,
        })
        element.style.boxShadow =
          "0 0 3px rgba(255,0,0,1), 0 0 32px rgba(32,0,0,0.5), inset 0 0 20px rgba(256,256,32,0.7)"
      }
    }

    return {
      originWindow,
      assignOrGetNodeId,
      fetchTree,
      setInteractionMode,
    }
  }

  const bunnyMath = Math as BunnyMath
  bunnyMath.__bunnyUtils = buildBunnyUtils()
}

export function scriptFetchTree(): Tree {
  const bunnyUtils = (Math as BunnyMath).__bunnyUtils
  if (bunnyUtils === undefined) {
    throw new Error("BunnyUtils is not available")
  }
  return bunnyUtils.fetchTree()
}

export function scriptSetInteractionMode(mode: TreeInteractionMode): void {
  const bunnyUtils = (Math as BunnyMath).__bunnyUtils
  if (bunnyUtils === undefined) {
    throw new Error("BunnyUtils is not available")
  }
  bunnyUtils.setInteractionMode(mode)
}
