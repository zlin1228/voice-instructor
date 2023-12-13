import {
  Browser,
  Page,
  Request,
  Response,
  chromium,
  BrowserContext,
} from "playwright"
import {
  buildAttachmentForCancellation,
  checkAndGetAbortSignal,
  Scope,
  sleepSeconds,
  sleepUntilCancel,
} from "base-core/lib/scope.js"
import { log } from "base-core/lib/logging.js"
import { buildPromise, flyingPromise } from "base-core/lib/utils.js"
import { CommonClosure, commonNormalizer } from "base-core/lib/types-common.js"
import { Type, objectType, stringType } from "base-core/lib/types.js"
import { catchErrorAsync } from "base-core/lib/one-of.js"
import { readTextFile, writeTextFile } from "base-node/lib/file.js"

function normalizeFilename(name: string): string {
  return name.replaceAll(/[^a-zA-Z0-9.-]/g, "_")
}

// browserUrl should not contain protocol
export async function connectToChrome(
  scope: Scope,
  cdpAddress: string
): Promise<Browser> {
  const resp = await fetch(`http://${cdpAddress}/json/version`, {
    signal: checkAndGetAbortSignal(scope),
    headers: {
      // Chrome doesn't allow connecting to it using a host name. Otherwise, it emits the following error:
      //   Host header is specified and is not an IP address or localhost.
      host: "localhost",
    },
  })
  const versionContent = commonNormalizer(
    objectType([{ name: "webSocketDebuggerUrl", type: stringType }] as const),
    await resp.json()
  )
  const wsUrl = new URL(versionContent.webSocketDebuggerUrl)
  const browser = await chromium.connectOverCDP(
    `ws://${cdpAddress}${wsUrl.pathname}`,
    {
      timeout: 10000,
    }
  )
  scope.onLeave(async () => {
    await browser.close()
  })
  return browser
}

export async function waitUntilPageClose(
  scope: Scope,
  page: Page,
  timeoutSeconds: number | undefined
): Promise<void> {
  const { cancel, attachment } = buildAttachmentForCancellation(true)
  const listener = (page: Page) => cancel(new Error("Page being closed"))
  page.on("close", listener)
  await Scope.with(scope, [attachment], async (scope) => {
    scope.onLeave(async () => {
      page.off("close", listener)
    })
    if (timeoutSeconds === undefined) {
      await sleepUntilCancel(scope)
    } else {
      await sleepSeconds(scope, timeoutSeconds)
    }
  })
}

export function waitUntilPostDone<T>(
  scope: Scope,
  page: Page,
  type: Type<CommonClosure, T>,
  predicate: (request: T) => Promise<boolean>
): <R>(fn: () => Promise<R>) => Promise<R> {
  return async (fn) => {
    const waitPromise = page.waitForResponse(async (response) => {
      const pass = await catchErrorAsync(Error, async () => {
        const requestData = response.request().postDataJSON() as unknown
        const req = commonNormalizer(type, requestData)
        return predicate(req)
      })
      return pass.kind === "value" && pass.value
    })
    const result = await fn()
    await waitPromise
    return result
  }
}

export class ScreenshotTaker {
  readonly #directory: string
  #screenshotIdx = 0

  constructor(directory: string) {
    this.#directory = directory
  }

  async screenshot(scope: Scope, page: Page, name: string): Promise<string> {
    ++this.#screenshotIdx
    const basename = `${this.#screenshotIdx
      .toString()
      .padStart(3, "0")}-${normalizeFilename(name)}`
    const filePath = `${this.#directory}/${basename}.png`
    log.info(`Take a screenshot - ${basename}`)
    await page.screenshot({
      path: filePath,
    })
    return filePath
  }
}

export async function registerNetworkLogger(
  scope: Scope,
  page: Page,
  filter: (url: string) => boolean
): Promise<void> {
  {
    const listener = (request: Request) => {
      const url = request.url()
      if (filter(url)) {
        log.info(`Request sent: ${url}`)
        console.log(request.timing())
      }
    }
    page.on("request", listener)
    scope.onLeave(async () => {
      page.off("request", listener)
    })
  }
  {
    const listener = (request: Request) => {
      const url = request.url()
      if (filter(url)) {
        log.info(`Request finished: ${url}`)
        flyingPromise(async () => {
          const response = await request.response()
          const body = (await response?.json()) as unknown
          log.info(`Request finished with response:`)
          console.log(JSON.stringify(body, null, 2))
          console.log(JSON.stringify(request.postDataJSON(), null, 2))
        })
      }
    }
    page.on("requestfinished", listener)
    scope.onLeave(async () => {
      page.off("requestfinished", listener)
    })
  }
}

export async function exportCookiesToFile(
  scope: Scope,
  context: BrowserContext,
  filename: string
): Promise<void> {
  const cookies = await context.cookies()
  await writeTextFile(filename, JSON.stringify(cookies))
}

export async function importCookiesFromFile(
  scope: Scope,
  context: BrowserContext,
  filename: string
): Promise<void> {
  await context.clearCookies()
  await context.addCookies(JSON.parse(await readTextFile(filename)))
}

export async function exportLocalStorageToFile(
  scope: Scope,
  page: Page,
  filename: string
) {
  const storage = await page.evaluate(() => {
    return JSON.stringify(window.localStorage)
  })
  await writeTextFile(filename, storage)
}

export async function importLocalStorageFromFile(
  scope: Scope,
  page: Page,
  filename: string,
  url: string
) {
  await page.addInitScript(
    ([url, storageJson]) => {
      if (page.url() !== url) {
        return
      }
      window.localStorage.clear()
      for (const [key, value] of Object.entries(JSON.parse(storageJson))) {
        window.localStorage.setItem(key, String(value))
      }
    },
    [url, await readTextFile(filename)] as const
  )
  await page.goto(url)
  return await page.evaluate(() => JSON.stringify(window.localStorage))
}

export async function registerRequestListener(
  scope: Scope,
  page: Page,
  listener: (request: Request) => void
): Promise<void> {
  const requestListener = (request: Request) => {
    listener(request)
  }
  page.on("request", requestListener)
  scope.onLeave(async () => {
    page.off("request", requestListener)
  })
}

export async function registerResponseListener(
  scope: Scope,
  page: Page,
  listener: (response: Response) => void
): Promise<void> {
  const responseListener = (response: Response) => {
    listener(response)
  }
  page.on("response", responseListener)
  scope.onLeave(async () => {
    page.off("response", responseListener)
  })
}

export async function registerPageCallback<T>(
  scope: Scope,
  page: Page,
  name: string,
  callback: (data: T) => void
): Promise<void> {
  let ignore = false
  scope.onLeave(async () => {
    ignore = true
  })
  await page.exposeFunction(name, (data: T) => {
    if (ignore) return
    callback(data)
  })
}

export function logBrowserStatus(browser: Browser): void {
  log.info("Browser status begin ===")
  for (const context of browser.contexts()) {
    log.info(`  Context #page=${context.pages().length}`)
    for (const page of context.pages()) {
      log.info(`    Page: ${page.url()}`)
    }
  }
  log.info("Browser status end ===")
}

export async function registerPageJsonCallbackAsync<Param, Return>(
  scope: Scope,
  page: Page,
  name: string,
  parameterType: Type<CommonClosure, Param>,
  returnType: Type<CommonClosure, Return>,
  callback: (data: Param) => Promise<Return>
): Promise<void> {
  let ignore = false
  scope.onLeave(async () => {
    ignore = true
  })
  await page.exposeFunction(name, async (data: unknown): Promise<string> => {
    if (ignore) {
      log.info("Page callback called after scope is cancelled")
      throw new Error("Page callback called after scope is cancelled")
    }
    if (typeof data !== "string") {
      log.info("Invalid data type received from browser")
      throw new Error("Invalid data type received from browser")
    }
    const paramJson: unknown = (() => {
      try {
        return JSON.parse(data)
      } catch (e) {
        log.info("Invalid JSON received from browser")
        console.log(e)
        throw new Error("Invalid JSON received from browser")
      }
    })()
    const param: Param = (() => {
      try {
        return commonNormalizer(parameterType, paramJson)
      } catch (e) {
        log.info("Invalid data received from browser")
        console.log(e)
        throw new Error("Invalid data received from browser")
      }
    })()
    const returnValue = commonNormalizer(returnType, await callback(param))
    return JSON.stringify(returnValue)
  })
}
