import { Page } from "playwright"

import { Scope, SignalController, sleepSeconds } from "base-core/lib/scope.js"
import { flyingPromise } from "base-core/lib/utils.js"
import {
  connectToChrome,
  exportCookiesToFile,
  exportLocalStorageToFile,
  importCookiesFromFile,
  importLocalStorageFromFile,
  registerPageCallback,
  registerRequestListener,
  registerResponseListener,
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
import { runMainScope } from "base-node/lib/main-scope.js"
import {
  midjourneyBrowserInteractiveLogin,
  midjourneyBrowserLoadStorage,
  midjourneyImagineImageVariants,
  midjourneyStorageType,
} from "../rabbits/midjourney/midjourney-client.js"
import { CookType, objectType, stringType } from "base-core/lib/types.js"
import { commonNormalizer } from "base-core/lib/types-common.js"

const discordStorageFile = "local/discord-storage.json"

async function creativeWorkflow(
  scope: Scope,
  page: Page,
  query: string,
  imageIdx: number
): Promise<string> {
  console.log(`Searching image about [${query}] from Pinterest...`)
  const urls = await pinterestBrowserSearch(scope, page, query)
  console.log(`Got ${urls.length} images from Pinterest. They are:`)
  console.log(urls)
  const url = abortIfUndefined(urls[imageIdx])
  console.log(`Picked this one: ${url}`)
  if (!(await fileExists(discordStorageFile))) {
    console.log("You are not logged in Discord. Opening Discord login page...")
    const discordStorage = await midjourneyBrowserInteractiveLogin(
      scope,
      page,
      async () => {
        console.log("The Discord login page is ready. Please login to Discord.")
      }
    )
    await writeTextFile(discordStorageFile, JSON.stringify(discordStorage))
    console.log(`Saved Discord login credentials to ${discordStorageFile}.`)
  } else {
    console.log(
      `Loading Discord login credentials from ${discordStorageFile}...`
    )
    const midjourneyStorage = commonNormalizer(
      midjourneyStorageType,
      await readTextFile(discordStorageFile)
    )
    await midjourneyBrowserLoadStorage(scope, page, midjourneyStorage)
  }
  console.log(`Generating image variants for ${url}`)
  const imageUrl = await midjourneyImagineImageVariants(scope, page, url)
  console.log(`The generated image URL is ${imageUrl}.`)
  return imageUrl
}

async function main(scope: Scope, cancel: (error: Error) => void) {
  const browser = await connectToChrome(scope, "localhost:9222")
  const page = abortIfUndefined(browser.contexts()[0]?.pages()[0])
  await creativeWorkflow(scope, page, "shan shui painting", 0)
}

void (async () => {
  await runMainScope(main)
  process.exit()
})()
