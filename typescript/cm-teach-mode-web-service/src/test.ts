import process from "node:process"
import {
  Scope,
  SignalController,
  runParallelScopes,
} from "base-core/lib/scope.js"
import { runMainScope } from "base-node/lib/main-scope.js"
import { throwError } from "base-core/lib/exception.js"

import { log } from "base-core/lib/logging.js"
import { recordPage } from "./recorder/recorder.js"
import {
  connectToChrome,
  logBrowserStatus,
} from "base-playwright/lib/playwright.js"
import { replayPage } from "./replayer/replayer.js"
import { buildAsyncGenerator } from "base-core/lib/processing.js"
import { WebEvent } from "cm-teach-mode-web-common/lib/event/web-event.js"
import { convertEventIterableToActionIterable } from "./converter/converter.js"
import { readTextFile, writeTextFile } from "base-node/lib/file.js"
import { commonNormalizer } from "base-core/lib/types-common.js"
import {
  WebAction,
  webActionType,
} from "cm-teach-mode-web-common/lib/action/web-action.js"
import { arrayType } from "base-core/lib/types.js"
import { Environment, Executable } from "./executor/executor.js"
import { playwright } from "base-playwright/lib/deps.js"
import { iteratorToAsync } from "base-core/lib/stream.js"

async function buildActionIterableByRecording(
  scope: Scope,
  browser: playwright.Browser,
  url: string
): Promise<AsyncIterable<WebAction>> {
  const recordContext = await browser.newContext()
  scope.onLeave(async () => await recordContext.close())
  const recordEventIterable = buildAsyncGenerator<WebEvent>(async (push) => {
    await recordPage(
      scope,
      recordContext,
      url,
      async () => {},
      async (recordEvent) => {
        await push(recordEvent)
      }
    )
  })
  return convertEventIterableToActionIterable(recordEventIterable)
}

async function replayActionIterable(
  scope: Scope,
  browser: playwright.Browser,
  actionIterable: AsyncIterable<WebAction>
): Promise<void> {
  const replayContext = await browser.newContext()
  scope.onLeave(async () => await replayContext.close())
  await replayPage(scope, replayContext, actionIterable)
}

export async function testRecordAndReplay(
  scope: Scope,
  chromeAddress: string,
  url: string
): Promise<void> {
  const browser = await connectToChrome(scope, chromeAddress)
  const actionIterable = await buildActionIterableByRecording(
    scope,
    browser,
    url
  )
  await replayActionIterable(scope, browser, actionIterable)
}

export async function testRecordToFile(
  scope: Scope,
  chromeAddress: string,
  url: string,
  filePath: string
): Promise<void> {
  const browser = await connectToChrome(scope, chromeAddress)
  const actionIterable = await buildActionIterableByRecording(
    scope,
    browser,
    url
  )
  const actions = []
  for await (const action of actionIterable) {
    actions.push(action)
    await writeTextFile(
      filePath,
      JSON.stringify(commonNormalizer(arrayType(webActionType), actions))
    )
  }
}

export async function testReplayFromFile(
  scope: Scope,
  chromeAddress: string,
  filePath: string
) {
  const browser = await connectToChrome(scope, chromeAddress)
  logBrowserStatus(browser)
  const replayContext = await browser.newContext()
  scope.onLeave(async () => await replayContext.close())
  const actions = commonNormalizer(
    arrayType(webActionType),
    JSON.parse(await readTextFile(filePath))
  )
  await replayPage(
    scope,
    replayContext,
    iteratorToAsync(actions[Symbol.iterator]())
  )
}

async function main(scope: Scope, cancel: (error: Error) => void) {
  const chromeAddress =
    process.env["CM_TEACH_MODE_WEB_SERVICE_TEST_CHROME"] ?? "localhost:9222"

  // await testRecordAndReplay(scope, chromeAddress, "https://www.amazon.com/")

  await testRecordToFile(
    scope,
    chromeAddress,
    "https://www.amazon.com/",
    "actions-amazon.json"
  )

  // await testReplayFromFile(scope, chromeAddress, "actions-amazon.json")
}

void (async () => {
  await runMainScope(main)
  // process.exit()
})()
