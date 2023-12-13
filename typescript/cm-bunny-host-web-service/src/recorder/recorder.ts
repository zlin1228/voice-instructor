import { playwright } from "base-playwright/lib/deps.js"
import {
  Scope,
  launchBackgroundScope,
  sleepUntilCancel,
} from "base-core/lib/scope.js"
import { registerPageJsonCallbackAsync } from "base-playwright/lib/playwright.js"
import { log } from "base-core/lib/logging.js"
import { scriptRegisterRecorder } from "./scripts.js"
import { emptyObjectType } from "base-core/lib/types.js"
import {
  scriptRegisterBunnyUtil,
  scriptSetInteractionMode,
} from "../common/scripts.js"
import { RecordedDomEvent, recordedDomEventType } from "./recorded.js"
import { WebExecutorBrowser } from "../executor/executor.js"
import { abortIfUndefined } from "base-core/lib/debug.js"

export async function recordDom(
  scope: Scope,
  webExecutorBrowser: WebExecutorBrowser,
  url: string,
  recordReady: () => Promise<void>,
  domEventListener: (recordedDomEvent: RecordedDomEvent) => Promise<void>
): Promise<void> {
  await webExecutorBrowser.webExecutor.createContext(scope, "recorder")
  await webExecutorBrowser.webExecutor.createPage(scope, "recorder", "recorder")
  const page = abortIfUndefined(webExecutorBrowser.pageMap.get("recorder")).page
  await registerPageJsonCallbackAsync(
    scope,
    page,
    "__bunnyReportDomEvent",
    recordedDomEventType,
    emptyObjectType,
    async (recordedDomEvent) => {
      await domEventListener(recordedDomEvent)
      return {}
    }
  )
  const handleDomContentLoaded = () => {
    launchBackgroundScope(scope, async (scope) => {
      await page.evaluate(scriptRegisterRecorder)
      await page.evaluate(scriptSetInteractionMode, {
        selecting: false,
        highlight: undefined,
      })
    })
  }
  page.on("domcontentloaded", handleDomContentLoaded)
  scope.onLeave(async () => {
    page.off("domcontentloaded", handleDomContentLoaded)
  })
  await page.goto(url)
  await recordReady()
  log.info("Ready to record")
  await sleepUntilCancel(scope)
}
