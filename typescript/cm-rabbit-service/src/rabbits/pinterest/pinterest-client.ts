import { Page } from "playwright"

import {
  Scope,
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

export async function pinterestBrowserSearch(
  scope: Scope,
  page: Page,
  query: string
): Promise<string[]> {
  // if (page.url() !== "https://www.pinterest.com/") {
  //   await page.goto("https://www.pinterest.com/")
  // }
  // await page.locator('input[data-test-id="search-box-input"]').type(query)
  // await page.locator('input[data-test-id="search-box-input"]').press("Enter")
  await page.goto(
    "https://www.pinterest.com/search/pins/?q=" + encodeURIComponent(query)
  )
  return await page
    .locator('div[role="list"]')
    .evaluate((el: HTMLDivElement) => {
      const urls: string[] = []
      for (const img of el.querySelectorAll(
        'div[data-test-id="pin-visual-wrapper"] img'
      )) {
        const url = img.getAttribute("src")
        if (url !== null) {
          urls.push(url)
        }
      }
      return urls
    })
}
