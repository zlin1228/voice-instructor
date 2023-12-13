import { Page, Request, Response, Route } from "playwright"

import {
  Broadcast,
  BroadcastController,
  Scope,
  SignalController,
  launchBackgroundScope,
} from "base-core/lib/scope.js"
import { CommonClosure, commonNormalizer } from "base-core/lib/types-common.js"
import { Type } from "base-core/lib/types.js"
import { log } from "base-core/lib/logging.js"

export async function waitForCookie(
  scope: Scope,
  page: Page,
  cookieName: string,
  body: () => Promise<void>
): Promise<void> {
  const signalCtrl = new SignalController<void>()
  const listener = (data: Response) => {
    launchBackgroundScope(scope, async (scope) => {
      const values = await data.headerValues("set-cookie")
      if (values.some((value) => value.startsWith(`${cookieName}=`))) {
        if (signalCtrl.get().kind === "pending") {
          signalCtrl.emit()
        }
      }
    })
  }
  page.on("response", listener)
  scope.onLeave(async () => {
    page.off("response", listener)
  })
  await body()
  await signalCtrl.waitUntilReady(scope)
}

export async function registerResponseJsonListener<T>(
  scope: Scope,
  page: Page,
  type: Type<CommonClosure, T>,
  urlFilter: (url: string) => boolean,
  // Listener doesn't guaranteed to be called in the same order as the responses
  listener: (value: T) => void
): Promise<void> {
  const responseListener = (response: Response) => {
    if (!urlFilter(response.url())) return
    launchBackgroundScope(scope, async (scope) => {
      const value = await (async () => {
        try {
          return commonNormalizer(type, await response.json())
        } catch (e) {
          console.log(e)
          return undefined
        }
      })()
      if (value === undefined) {
        log.info("Failed to parse response json")
        return
      }
      listener(value)
    })
  }
  page.on("response", responseListener)
  scope.onLeave(async () => {
    page.off("response", responseListener)
  })
}

export type BrowserCallbackValue<T> =
  | {
      error: undefined
      value: T
    }
  | {
      error: string
      value: undefined
    }

export async function preventPageLoadingImages(
  scope: Scope,
  page: Page
): Promise<void> {
  log.info("Preventing page loading images")
  const handler = async (route: Route, request: Request) => {
    if (
      request.resourceType() === "image" ||
      request.url().includes(".scdn.co/image") ||
      request.url().includes("mosaic.scdn.co") ||
      request.url().includes(".woff")
    ) {
      log.info(`blocked: ${request.url()}`)
      await route.abort()
      return
    }
    await route.continue()
  }
  await page.context().route("**/*", handler)
  scope.onLeave(async () => {
    await page.context().unroute("**/*", handler)
  })
  const cdpSession = await page.context().newCDPSession(page)
  await cdpSession.send("Network.setCacheDisabled", { cacheDisabled: false })
  scope.onLeave(async () => {
    await cdpSession.detach()
  })
}

export async function clickPageFast(
  scope: Scope,
  page: Page,
  selector: string
): Promise<void> {
  await page.locator(selector).click({
    force: true,
    noWaitAfter: true,
  })
}

export async function dblClickPageFast(
  scope: Scope,
  page: Page,
  selector: string
): Promise<void> {
  await page.locator(selector).dblclick({
    force: true,
    noWaitAfter: true,
  })
}
