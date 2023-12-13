import { Scope } from "base-core/lib/scope.js"
import { runMainScope } from "base-node/lib/main-scope.js"
import { buildAsyncGenerator } from "base-core/lib/processing.js"
import { playwright } from "base-playwright/lib/deps.js"
import { buildDefaultProfile } from "./profile.js"
import {
  TreeStep,
  treeStepType,
} from "cm-bunny-host-common/lib/tree/tree-procedure.js"
import { recordDom } from "./recorder/recorder.js"
import { replayTreeSteps } from "./replayer/replayer.js"
import { DomEvent } from "cm-bunny-host-web-common/lib/event/dom-event.js"
import { convertEventIterableToStepIterable } from "./recorder/converter.js"
import {
  WebExecutorBrowser,
  buildWebExecutorBrowser,
} from "./executor/executor.js"
import { readTextFile, writeTextFile } from "base-node/lib/file.js"
import { commonNormalizer } from "base-core/lib/types-common.js"
import { arrayType } from "base-core/lib/types.js"
import { iteratorToAsync } from "base-core/lib/stream.js"
import {
  RecordedDomEvent,
  RecordedTreeStep,
  recordedTreeStepType,
} from "./recorder/recorded.js"
import { log } from "base-core/lib/logging.js"
import { WebExecutor } from "cm-bunny-host-web-common/lib/action/web-action.js"

async function recordTreeSteps(
  scope: Scope,
  webExecutorBrowser: WebExecutorBrowser,
  url: string
): Promise<AsyncIterable<RecordedTreeStep>> {
  const domEventIterable = buildAsyncGenerator<RecordedDomEvent>(
    async (push) => {
      await recordDom(
        scope,
        webExecutorBrowser,
        url,
        async () => {},
        async (recordEvent) => {
          await push(recordEvent)
        }
      )
    }
  )
  return convertEventIterableToStepIterable(domEventIterable)
}

async function replayTreeStepIterable(
  scope: Scope,
  webExecutor: WebExecutor,
  url: string,
  stepIterable: AsyncIterable<RecordedTreeStep>
): Promise<void> {
  webExecutor.selectedNodeBroadcast.listen(scope, (nodeLocation) => {
    log.info("Selected node")
    console.log(nodeLocation)
  })
  await replayTreeSteps(scope, url, webExecutor, stepIterable)
}

export async function testRecordAndReplay(
  scope: Scope,
  webExecutorBrowser: WebExecutorBrowser,
  url: string
): Promise<void> {
  const treeStepIterable = await recordTreeSteps(scope, webExecutorBrowser, url)
  await replayTreeStepIterable(
    scope,
    webExecutorBrowser.webExecutor,
    url,
    treeStepIterable
  )
}

export async function testRecordToFile(
  scope: Scope,
  webExecutorBrowser: WebExecutorBrowser,
  url: string,
  filePath: string
): Promise<void> {
  const treeStepIterable = await recordTreeSteps(scope, webExecutorBrowser, url)
  const treeSteps = []
  for await (const action of treeStepIterable) {
    treeSteps.push(action)
    await writeTextFile(
      filePath,
      JSON.stringify(
        commonNormalizer(arrayType(recordedTreeStepType), treeSteps)
      )
    )
  }
}

export async function testReplayFromFile(
  scope: Scope,
  webExecutor: WebExecutor,
  url: string,
  filePath: string
) {
  const treeSteps = commonNormalizer(
    arrayType(recordedTreeStepType),
    JSON.parse(await readTextFile(filePath))
  )
  await replayTreeStepIterable(
    scope,
    webExecutor,
    url,
    iteratorToAsync(treeSteps[Symbol.iterator]())
  )
}

async function main(scope: Scope, cancel: (error: Error) => void) {
  const profile = await buildDefaultProfile(scope)
  // await testRecordAndReplay(scope, profile.browser, "https://www.amazon.com/")
  await testRecordAndReplay(
    scope,
    profile.webExecutorBrowser,
    "https://www.doordash.com/"
  )

  // await testRecordToFile(
  //   scope,
  //   profile.browser,
  //   "https://www.doordash.com/",
  //   "actions-doordash.json"
  // )

  // await testReplayFromFile(
  //   scope,
  //   profile.browser,
  //   "https://www.doordash.com/",
  //   "actions-doordash.json"
  // )
}

void (async () => {
  await runMainScope(main)
  // process.exit()
})()
