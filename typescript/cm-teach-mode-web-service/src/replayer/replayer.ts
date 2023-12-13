import { playwright } from "base-playwright/lib/deps.js"
import {
  Scope,
  launchBackgroundScope,
  sleepSeconds,
} from "base-core/lib/scope.js"
import { log } from "base-core/lib/logging.js"
import { WebAction } from "cm-teach-mode-web-common/lib/action/web-action.js"
import { PageAction } from "cm-teach-mode-web-common/lib/action/page-action.js"
import {
  scriptCaptureDomSnapshot,
  scriptRegisterBunnyUtil,
  scriptHandleDomContentLoaded,
  elementIdAttribute,
  documentIdAttribute,
} from "../common/scripts.js"
import { commonNormalizer } from "base-core/lib/types-common.js"
import {
  DomSnapshot,
  domSnapshotType,
} from "cm-teach-mode-web-common/lib/event/dom-event.js"
import { locateByLocator } from "../locator/reference-locator.js"
import { Executable } from "../executor/executor.js"
import { Locator } from "cm-teach-mode-web-common/lib/locator/locator.js"

export async function replayPageAction(
  scope: Scope,
  page: playwright.Page,
  pageAction: PageAction
): Promise<void> {
  const { navigate } = pageAction
  if (navigate !== undefined) {
    await page.goto(navigate.url)
  }
}

async function scrollPageToTop(
  scope: Scope,
  page: playwright.Page
): Promise<void> {
  return await page.evaluate(async () => {
    window.scrollTo(0, 0)
  })
}

async function scrollPageDown(
  scope: Scope,
  page: playwright.Page,
  offsetY: number
): Promise<boolean> {
  // https://github.com/microsoft/playwright/issues/4302
  return await page.evaluate(async (offsetY: number) => {
    if (
      document.body.scrollHeight >=
      window.scrollY + offsetY + window.document.documentElement.clientHeight
    ) {
      window.scrollTo(0, window.scrollY + offsetY)
      return true
    }
    return false
  }, offsetY)
}

async function fetchPageDomSnapshot(
  scope: Scope,
  page: playwright.Page
): Promise<DomSnapshot> {
  return commonNormalizer(
    domSnapshotType,
    await page.evaluate(scriptCaptureDomSnapshot)
  )
}

async function locatePageElementAsSelector(
  scope: Scope,
  page: playwright.Page,
  locator: Locator
): Promise<string | undefined> {
  // loop for full-retry
  for (let i = 0; i < 3; i++) {
    // loop for scrolling page down
    for (;;) {
      let domSnapshot = await fetchPageDomSnapshot(scope, page)
      let elementId = locateByLocator(domSnapshot, locator)
      if (elementId !== undefined) {
        return `[${documentIdAttribute}="${domSnapshot.documentId}"] [${elementIdAttribute}="${elementId}"]`
      }
      const scrolled = await scrollPageDown(scope, page, 200)
      if (!scrolled) {
        break
      }
      await sleepSeconds(scope, 0.5)
    }
    await scrollPageToTop(scope, page)
    await sleepSeconds(scope, 5)
  }
  return undefined
}

export async function replayPage(
  scope: Scope,
  context: playwright.BrowserContext,
  actionIterable: AsyncIterable<WebAction>
): Promise<void> {
  const page = await context.newPage()
  await page.addInitScript(scriptRegisterBunnyUtil)
  const handleDomContentLoaded = () => {
    launchBackgroundScope(scope, async (scope) => {
      await page.evaluate(scriptHandleDomContentLoaded)
    })
  }
  page.on("domcontentloaded", handleDomContentLoaded)
  scope.onLeave(async () => {
    page.off("domcontentloaded", handleDomContentLoaded)
  })
  // const handleFrameNavigated = (frame: playwright.Frame) => {
  //   if (frame === page.mainFrame()) {
  //     await scrollPageToBottom(scope, page)
  //   }
  // }
  // page.on("framenavigated", handleFrameNavigated)
  // scope.onLeave(async () => {
  //   page.off("framenavigated", handleFrameNavigated)
  // })
  try {
    for await (const replayAction of actionIterable) {
      try {
        log.info("Replay action")
        console.log(replayAction)
        const { domAction, pageAction } = replayAction
        if (pageAction !== undefined) {
          await replayPageAction(scope, page, pageAction)
        }
        if (domAction !== undefined) {
          const { mouseClick, fill, press } = domAction
          if (mouseClick !== undefined) {
            const selector = await locatePageElementAsSelector(
              scope,
              page,
              mouseClick.elementLocator
            )
            if (selector === undefined) {
              log.info("Failed to locate element")
              throw new Error("Failed to locate element")
            }
            await page.locator(selector).click({ force: true, timeout: 30000 })
          }
          if (fill !== undefined) {
            const selector = await locatePageElementAsSelector(
              scope,
              page,
              fill.elementLocator
            )
            if (selector === undefined) {
              log.info("Failed to locate element")
              throw new Error("Failed to locate element")
            }
            await page
              .locator(selector)
              .fill(fill.value, { force: true, timeout: 30000 })
          }
          if (press !== undefined) {
            const selector = await locatePageElementAsSelector(
              scope,
              page,
              press.elementLocator
            )
            if (selector === undefined) {
              log.info("Failed to locate element")
              throw new Error("Failed to locate element")
            }
            await page.locator(selector).press(press.key, { timeout: 30000 })
          }
        }
      } catch (e) {
        log.info("Replay action error")
        console.log(e)
        throw e
      }
    }
  } catch (e) {
    log.info("Replay error")
    console.log(e)
  }
}
