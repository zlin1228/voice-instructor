import { WebEvent } from "cm-teach-mode-web-common/lib/event/web-event.js"
import { WebAction } from "cm-teach-mode-web-common/lib/action/web-action.js"
import { Executable } from "../executor/executor.js"
import { log } from "base-core/lib/logging.js"
import { Locator } from "cm-teach-mode-web-common/lib/locator/locator.js"

export async function* convertEventIterableToActionIterable(
  recordEventIterable: AsyncIterable<WebEvent>
): AsyncGenerator<WebAction> {
  for await (const recordEvent of recordEventIterable) {
    const { domEvent, pageEvent } = recordEvent
    log.info("recordEvent")
    console.log({
      ...recordEvent,
      domEvent:
        recordEvent.domEvent === undefined
          ? undefined
          : {
              ...recordEvent.domEvent,
              domSnapshot: {
                ...recordEvent.domEvent.domSnapshot,
                documentOuterHtml: "",
              },
            },
    })
    if (domEvent !== undefined) {
      const elementLocator: Locator = {
        referenceLocator: {
          domSnapshot: domEvent.domSnapshot,
          targetElementId: domEvent.targetElementId,
        },
      }
      if (domEvent.eventType === "mousedown") {
        yield {
          domAction: {
            mouseClick: {
              elementLocator,
            },
          },
        }
      } else if (domEvent.eventType === "keyup") {
        if (domEvent.value !== undefined) {
          yield {
            domAction: {
              fill: {
                elementLocator,
                value: domEvent.value,
              },
            },
          }
        }
      } else if (
        domEvent.eventType === "keydown" &&
        domEvent.keyboardEvent !== undefined
      ) {
        if (domEvent.keyboardEvent.key === "Enter") {
          yield {
            domAction: {
              press: {
                elementLocator,
                key: domEvent.keyboardEvent.key,
              },
            },
          }
        }
      }
    }
    if (pageEvent !== undefined) {
      if (pageEvent.navigate !== undefined) {
        yield {
          pageAction: {
            navigate: {
              url: pageEvent.navigate.url,
            },
          },
        }
      }
    }
  }
}
