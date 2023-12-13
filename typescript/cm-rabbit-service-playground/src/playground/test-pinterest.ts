import { Page } from "playwright"

import { Scope, sleepSeconds } from "base-core/lib/scope.js"
import { flyingPromise } from "base-core/lib/utils.js"
import {
  connectToChrome,
  exportCookiesToFile,
  importCookiesFromFile,
} from "base-playwright/lib/playwright.js"
import {
  spotifyBrowserInteractiveLogin,
  spotifyBrowserPlaySearchTop,
  spotifyBrowserPlaySpotifyUriWithName,
} from "../rabbits/spotify/spotify-client.js"
import { fileExists, readTextFile, writeTextFile } from "base-node/lib/file.js"
import { abortIfUndefined } from "base-core/lib/debug.js"
import { stringRemovePrefix } from "base-core/lib/string.js"
import { clickPageFast } from "../browsing/browser-utils.js"
import { throwError } from "base-core/lib/exception.js"
import { log } from "base-core/lib/logging.js"
import { pinterestBrowserSearch } from "../rabbits/pinterest/pinterest-client.js"

const storageFile = "cookies.json"

export async function main(scope: Scope): Promise<void> {
  const browser = await connectToChrome(scope, "localhost:9222")
  const page = abortIfUndefined(browser.contexts()[0]?.pages()[0])
  // await exportCookiesToFile(scope, page.context(), "local/cookies.json")
  // await page.goto("about:blank")
  // await importCookiesFromFile(scope, page.context(), "local/cookies.json")
  // if (page.url() !== "https://www.pinterest.com/") {
  //   await page.goto("https://www.pinterest.com/")
  // }
  await page.context().clearCookies()
  const urls = await pinterestBrowserSearch(scope, page, "matrix")
  console.log(urls)
}

flyingPromise(async () => {
  await Scope.with(undefined, [], async (scope) => {
    await main(scope)
  })
})
