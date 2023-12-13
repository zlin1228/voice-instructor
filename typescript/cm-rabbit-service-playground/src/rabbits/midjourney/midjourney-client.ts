import { Page } from "playwright"

import {
  Scope,
  SignalController,
  buildAttachmentForCancellation,
  launchBackgroundScope,
  sleepSeconds,
} from "base-core/lib/scope.js"
import {
  stringRandomSimpleName,
  stringRemovePrefix,
  stringSplitToVector,
} from "base-core/lib/string.js"
import { BrowsingClient } from "../../browsing/browsing-client.js"
import {
  BrowserCallbackValue,
  clickPageFast,
  dblClickPageFast,
  preventPageLoadingImages,
  registerResponseJsonListener,
  waitForCookie,
} from "../../browsing/browser-utils.js"

import {
  Os2SpotifyPlayerControl,
  Os2SpotifyPlayerStatus,
} from "cm-rabbit-common/lib/spotify/spotify.js"
import { buildIceServersJson } from "../../stunner.js"
import { KubernetesServiceLocator } from "base-kubernetes/lib/kubernetes.js"
import { log } from "base-core/lib/logging.js"
import { throwError } from "base-core/lib/exception.js"
import {
  registerPageCallback,
  registerRequestListener,
} from "base-playwright/lib/playwright.js"
import { CookType, objectType, stringType } from "base-core/lib/types.js"

export const midjourneyStorageType = objectType([
  { name: "localStorage", type: stringType },
  { name: "cookies", type: stringType },
] as const)

export type MidjourneyStorage = CookType<typeof midjourneyStorageType>

export async function midjourneyBrowserInteractiveLogin(
  scope: Scope,
  page: Page,
  onLoginReady: () => Promise<void>
): Promise<MidjourneyStorage> {
  const signal = new SignalController<string>()
  let ignore = false
  await registerPageCallback(
    scope,
    page,
    "_midjourneyLoginReady",
    (storageJson: string) => {
      if (ignore) return
      signal.emit(storageJson)
      ignore = true
    }
  )
  await page.addInitScript(() => {
    if (window.location.hostname !== "discord.com") return
    const localStorage = window.localStorage
    const tid = setInterval(() => {
      if (localStorage.getItem("token") === null) return
      ;(
        window as unknown as {
          _midjourneyLoginReady: (storageJson: string) => void
        }
      )._midjourneyLoginReady(JSON.stringify(localStorage))
      clearInterval(tid)
    }, 100)
  })
  await page.goto("https://discord.com/login")
  await page.locator('input[aria-label="Email or Phone Number"]').waitFor()
  await onLoginReady()
  return {
    localStorage: await signal.waitUntilReady(scope),
    cookies: JSON.stringify(await page.context().cookies()),
  }
}

export async function midjourneyBrowserLoadStorage(
  scope: Scope,
  page: Page,
  storage: MidjourneyStorage
): Promise<void> {
  await page.context().addCookies(JSON.parse(storage.cookies))
  await page.addInitScript(
    ([storageJson]) => {
      if (!window.location.hostname.endsWith("discord.com")) return
      window.localStorage.clear()
      for (const [key, value] of Object.entries(JSON.parse(storageJson))) {
        window.localStorage.setItem(key, String(value))
      }
    },
    [storage.localStorage] as const
  )
}

const prompt =
  "chinese chinese painting, landscape painting, painting in the mountains, in the style of delicate fantasy worlds, neotraditional, yumihiko amano, historical painting, dark white and sky-blue, serene faces, dreamlike architecture --ar 29:54"

export async function midjourneyImagineImageVariants(
  scope: Scope,
  page: Page,
  imageUrl: string
): Promise<string> {
  const signal = new SignalController<string>()
  let ignoreRequest = true
  await registerRequestListener(scope, page, (request) => {
    if (ignoreRequest) return
    const url = request.url()
    if (!url.startsWith("https://media.discordapp.net/attachments/")) {
      return
    }
    if (url.includes(`chinese_chinese_painting`)) {
      signal.emit(url)
      ignoreRequest = true
    }
  })
  await page.goto(
    "https://discord.com/channels/662267976984297473/1008571218586259456"
  ) // NEWCOMER ROOMS 4 > newbies-183
  await page
    .locator('div[role="textbox"][aria-label^="Message "]')
    .type("/imagine")
  await sleepSeconds(scope, 0.2)
  await page
    .locator('div[role="textbox"][aria-label^="Message "]')
    .press("Space")
  await sleepSeconds(scope, 0.2)
  await page
    .locator('div[role="textbox"][aria-label^="Message "]')
    .type(`${imageUrl} ${prompt}`)
  ignoreRequest = false
  await sleepSeconds(scope, 0.2)
  await page
    .locator('div[role="textbox"][aria-label^="Message "]')
    .press("Enter")
  return await signal.waitUntilReady(scope)
}
