import type { DomSnapshot } from "cm-teach-mode-web-common/lib/event/dom-event.js"

export interface ElementInfo {
  id: number
}

export interface BunnyUtils {
  originWindow: Window
  captureDomSnapshot: () => DomSnapshot
  handleDomContentLoaded: () => void
  assignAndGetElementInfo: (element: HTMLElement) => ElementInfo
}

// We attach some global data to the Math object.
// This is a hack to make the data accessible from the browser context.
// We don't attach it to the Window object because some websites deliberately remove all unknown properties from the Window object.
export interface BunnyMath extends Math {
  __bunnyUtils?: BunnyUtils
}

// The following attribute names must be consistent with the one in the below file:
// typescript/cm-teach-mode-web-common/src/record/dom-event.ts
// this file - scriptRegisterBunnyUtil()
export const elementIdAttribute = "__bunny_id"
export const documentIdAttribute = "__bunny_document_id"

export function scriptRegisterBunnyUtil() {
  // console.log("scriptRegisterBunnyUtil")

  function buildBunnyUtils(): BunnyUtils {
    const originWindow = window

    // The following attribute names must be consistent with the definition above:
    const elementIdAttribute = "__bunny_id"
    const documentIdAttribute = "__bunny_document_id"

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

    const documentId = buildRandomString()

    const elementsMap = new WeakMap<HTMLElement, ElementInfo>()
    let nextElementId = 0

    function assignAndGetElementInfo(element: HTMLElement): ElementInfo {
      const elementInfo = elementsMap.get(element)
      if (elementInfo !== undefined) {
        return elementInfo
      }
      const newElementInfo: ElementInfo = {
        id: nextElementId++,
      }
      elementsMap.set(element, newElementInfo)
      element.setAttribute(elementIdAttribute, String(newElementInfo.id))
      return newElementInfo
    }

    function assignElementIdToTree(element: HTMLElement): void {
      assignAndGetElementInfo(element)
      for (const child of element.children) {
        if (child instanceof HTMLElement) {
          assignElementIdToTree(child)
        }
      }
    }

    function registerElementIdAssignerToTree(element: HTMLElement): void {
      const observer = new originWindow.MutationObserver((mutationList) => {
        for (const mutation of mutationList) {
          if (mutation.type === "childList") {
            for (const node of mutation.addedNodes) {
              if (node instanceof HTMLElement) {
                assignElementIdToTree(node)
              }
            }
            // console.log(`Mutation observed ${mutation.addedNodes.length} nodes`)
          }
        }
      })
      observer.observe(element, {
        attributes: false,
        childList: true,
        subtree: true,
      })
      assignElementIdToTree(originWindow.document.documentElement)
    }

    function buildDomSnapshot(): DomSnapshot {
      assignElementIdToTree(originWindow.document.documentElement)
      return {
        url: originWindow.location.href,
        documentId,
        documentOuterHtml: originWindow.document.documentElement.outerHTML,
      }
    }

    function handleDomContentLoaded() {
      originWindow.document.documentElement.setAttribute(
        documentIdAttribute,
        documentId
      )
      registerElementIdAssignerToTree(originWindow.document.documentElement)
    }

    return {
      originWindow,
      captureDomSnapshot: buildDomSnapshot,
      handleDomContentLoaded,
      assignAndGetElementInfo,
    }
  }

  const bunnyMath = Math as BunnyMath
  bunnyMath.__bunnyUtils = buildBunnyUtils()
}

export function scriptHandleDomContentLoaded() {
  console.log("scriptHandleDomContentLoaded")

  const bunnyUtils = (Math as BunnyMath).__bunnyUtils
  if (bunnyUtils === undefined) {
    console.log("BunnyUtils is not available")
    return
  }

  bunnyUtils.handleDomContentLoaded()
}

export function scriptCaptureDomSnapshot(): DomSnapshot {
  const bunnyUtils = (Math as BunnyMath).__bunnyUtils
  if (bunnyUtils === undefined) {
    throw new Error("BunnyUtils is not available")
  }
  return bunnyUtils.captureDomSnapshot()
}
