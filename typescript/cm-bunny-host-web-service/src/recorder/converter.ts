import { TreeStep } from "cm-bunny-host-common/lib/tree/tree-procedure.js"
import { TreePathFinder } from "cm-bunny-host-common/lib/tree/tree-path.js"
import { log } from "base-core/lib/logging.js"
import { DomEvent } from "cm-bunny-host-web-common/lib/event/dom-event.js"
import { RecordedDomEvent, RecordedTreeStep } from "./recorded.js"

export async function* convertEventIterableToStepIterable(
  domEventIterable: AsyncIterable<RecordedDomEvent>
): AsyncGenerator<RecordedTreeStep> {
  for await (const recordedDomEvent of domEventIterable) {
    const { domEvent, state } = recordedDomEvent
    log.info("converting DOM Event to TreeStep")
    console.log({
      ...domEvent,
      tree: {},
    })
    try {
      const pathFinder = new TreePathFinder(domEvent.tree)
      const uniPath = pathFinder.buildUniPath(
        domEvent.tree.rootNodeId,
        domEvent.nodeId
      )
      // console.log(JSON.stringify(uniPath, null, 2))
      if (domEvent.eventType === "mousedown") {
        yield {
          state,
          treeStep: {
            click: {
              uniPath,
            },
          },
          eventNodeId: domEvent.nodeId,
        }
      } else if (domEvent.eventType === "keyup") {
        if (domEvent.value !== undefined) {
          yield {
            state,
            treeStep: {
              fill: {
                uniPath,
                value: domEvent.value,
              },
            },
            eventNodeId: domEvent.nodeId,
          }
        }
      } else if (
        domEvent.eventType === "keydown" &&
        domEvent.keyboardEvent !== undefined
      ) {
        if (domEvent.keyboardEvent.key === "Enter") {
          yield {
            state,
            treeStep: {
              press: {
                uniPath,
                key: domEvent.keyboardEvent.key,
              },
            },
            eventNodeId: domEvent.nodeId,
          }
        }
      }
    } catch (e) {
      log.info("Exception!")
      console.log(e)
      throw e
    }
  }
}
