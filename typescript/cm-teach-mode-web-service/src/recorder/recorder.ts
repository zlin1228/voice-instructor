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
import { WebEvent } from "cm-teach-mode-web-common/lib/event/web-event.js"
import {
  DomEvent,
  domEventType,
} from "cm-teach-mode-web-common/lib/event/dom-event.js"
import {
  scriptRegisterBunnyUtil,
  scriptHandleDomContentLoaded,
} from "../common/scripts.js"

export async function recordPage(
  scope: Scope,
  context: playwright.BrowserContext,
  url: string,
  recordReady: () => Promise<void>,
  recordEventListener: (event: WebEvent) => Promise<void>
): Promise<void> {
  const page = await context.newPage()
  await registerPageJsonCallbackAsync(
    scope,
    page,
    "__bunnyReportDomEvent",
    domEventType,
    emptyObjectType,
    async (domEvent) => {
      log.info("Record dom event")
      console.log({
        ...domEvent,
        domSnapshot: { documentOuterHtml: "" },
      } as DomEvent)
      await recordEventListener({
        domEvent,
      })
      return {}
    }
  )
  await page.addInitScript(scriptRegisterBunnyUtil)
  const handleDomContentLoaded = () => {
    launchBackgroundScope(scope, async (scope) => {
      await page.evaluate(scriptHandleDomContentLoaded)
      await page.evaluate(scriptRegisterRecorder)
    })
  }
  page.on("domcontentloaded", handleDomContentLoaded)
  scope.onLeave(async () => {
    page.off("domcontentloaded", handleDomContentLoaded)
  })
  await recordEventListener({
    pageEvent: {
      navigate: {
        url,
      },
    },
  })
  await page.goto(url)
  await recordReady()
  log.info("Ready to record")
  await sleepUntilCancel(scope)
}
