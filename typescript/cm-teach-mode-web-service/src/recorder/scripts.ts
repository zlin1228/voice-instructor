import type {
  DomEvent,
  DomSnapshot,
} from "cm-teach-mode-web-common/lib/event/dom-event"
import { BunnyMath } from "../common/scripts"

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
  const reportDomEvent = (domEvent: DomEvent): void => {
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
  ): number => {
    if (eventTarget === null) {
      throw new Error("Event target is null")
    }
    const element = findEventTargetElement(eventTarget)
    if (element === undefined) {
      console.log("Event target:", eventTarget)
      throw new Error("Cannot find the HTMLElement for the event target")
    }
    return bunnyUtils.assignAndGetElementInfo(element).id
  }
  const extractEventTargetValue = (event: Event): string | undefined => {
    const value = (event.target as EventTarget & { value?: unknown }).value
    if (typeof value !== "string") {
      return undefined
    }
    return value
  }
  const buildDomEvent = (eventType: string, event: Event): DomEvent => {
    return {
      domSnapshot: bunnyUtils.captureDomSnapshot(),
      targetElementId: findEventTargetElementIdOrThrow(event.target),
      eventType,
      value: extractEventTargetValue(event),
    }
  }
  for (const eventType of ["mousedown", "mouseup", "click"] as const) {
    window.addEventListener(
      eventType,
      (event) => {
        reportDomEvent({
          ...buildDomEvent(eventType, event),
          mouseEvent: {},
        })
      },
      { capture: true }
    )
  }
  for (const eventType of ["change", "input"] as const) {
    window.addEventListener(
      eventType,
      (event) => {
        reportDomEvent({
          ...buildDomEvent(eventType, event),
        })
      },
      { capture: true }
    )
  }
  for (const eventType of ["keydown", "keyup"] as const) {
    window.addEventListener(
      eventType,
      (event) => {
        reportDomEvent({
          ...buildDomEvent(eventType, event),
          keyboardEvent: {
            key: event.key,
          },
        })
      },
      { capture: true }
    )
  }
}
