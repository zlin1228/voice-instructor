import { BunnyMath } from "../common/scripts.js"
import type { RecordedDomEvent } from "./recorded.js"

export function scriptRegisterRecorder() {
  const bunnyUtils = (Math as BunnyMath).__bunnyUtils
  if (bunnyUtils === undefined) {
    console.log("BunnyUtils is not available")
    return
  }
  const bunnyReportDomEvent = (
    bunnyUtils.originWindow as Window & {
      ["__bunnyReportDomEvent"]?: (data: string) => Promise<string>
    }
  ).__bunnyReportDomEvent?.bind(bunnyUtils.originWindow)
  if (bunnyReportDomEvent === undefined) {
    throw new Error(`Callback __bunnyReportDomEvent is not registered`)
  }
  const reportDomEvent = (domEvent: RecordedDomEvent): void => {
    void bunnyReportDomEvent(JSON.stringify(domEvent))
  }
  const findEventTargetElement = (
    eventTarget: EventTarget
  ): HTMLElement | undefined => {
    let node: EventTarget | Node = eventTarget
    for (;;) {
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
    return bunnyUtils.assignOrGetNodeId(element)
  }
  const extractEventTargetValue = (event: Event): string | undefined => {
    const value = (event.target as EventTarget & { value?: unknown }).value
    if (typeof value !== "string") {
      return undefined
    }
    return value
  }
  const buildDomEvent = (eventType: string, event: Event): RecordedDomEvent => {
    return {
      domEvent: {
        tree: bunnyUtils.fetchTree(),
        nodeId: findEventTargetElementIdOrThrow(event.target),
        eventType,
        value: extractEventTargetValue(event),
      },
      state: {
        url: bunnyUtils.originWindow.location.href,
        html: bunnyUtils.originWindow.document.documentElement.outerHTML,
      },
    }
  }
  for (const eventType of ["mousedown", "mouseup", "click"] as const) {
    window.addEventListener(
      eventType,
      (event) => {
        const recordedDomEvent = buildDomEvent(eventType, event)
        reportDomEvent({
          ...recordedDomEvent,
          domEvent: {
            ...recordedDomEvent.domEvent,
            mouseEvent: {},
          },
        })
      },
      { capture: true }
    )
  }
  for (const eventType of ["change", "input"] as const) {
    window.addEventListener(
      eventType,
      (event) => {
        const recordedDomEvent = buildDomEvent(eventType, event)
        reportDomEvent({
          ...recordedDomEvent,
          domEvent: {
            ...recordedDomEvent.domEvent,
          },
        })
      },
      { capture: true }
    )
  }
  for (const eventType of ["keydown", "keyup"] as const) {
    window.addEventListener(
      eventType,
      (event) => {
        const recordedDomEvent = buildDomEvent(eventType, event)
        reportDomEvent({
          ...recordedDomEvent,
          domEvent: {
            ...recordedDomEvent.domEvent,
            keyboardEvent: {
              key: event.key,
            },
          },
        })
      },
      { capture: true }
    )
  }
}
