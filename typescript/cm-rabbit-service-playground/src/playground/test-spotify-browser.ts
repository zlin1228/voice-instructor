import { Page } from "playwright"

import { Scope, sleepSeconds } from "base-core/lib/scope.js"
import { flyingPromise } from "base-core/lib/utils.js"
import { connectToChrome } from "base-playwright/lib/playwright.js"
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

interface BrowserToolkit {
  fill: (selector: string, value: string) => Promise<void>
}

function registerBrowserToolkit() {
  const browserToolkitHolder = window as unknown as {
    browserToolkit: BrowserToolkit
  }
  browserToolkitHolder.browserToolkit = {
    fill: async (selector: string, value: string) => {},
  }
}

const storageFile = "local/spotify-login-storage.json"

async function saveSpotifyLoginStorage(
  scope: Scope,
  page: Page
): Promise<void> {
  if (await fileExists(storageFile)) return
  const storage = await spotifyBrowserInteractiveLogin(
    scope,
    page,
    async () => {
      console.log("ready to login")
    }
  )
  await writeTextFile(storageFile, storage)
}

async function loadSpotifyLoginStorage(
  scope: Scope,
  page: Page
): Promise<void> {
  await page.goto("about:blank")
  await page.context().clearCookies()
  await page.context().addCookies(JSON.parse(await readTextFile(storageFile)))
}

export async function main(scope: Scope): Promise<void> {
  const browser = await connectToChrome(scope, "localhost:9222")
  const page = abortIfUndefined(browser.contexts()[0]?.pages()[0])
  // await saveSpotifyLoginStorage(scope, page)
  // await loadSpotifyLoginStorage(scope, page)
  // await page.goto(
  //   "https://open.spotify.com/search/fly%20me%20to%20the%20moon/tracks"
  // )
  // await spotifyBrowserPlaySpotifyUriWithName(
  //   scope,
  //   page,
  //   "spotify:track:60a0Rd6pjrkxjPbaKzXjfq",
  //   "In the end"
  // )
  // await spotifyBrowserPlaySpotifyUriWithName(
  //   scope,
  //   page,
  //   "spotify:track:5tE3p4vIwoqUZLkKF2PNeB",
  //   "Interstellar- Main Theme"
  // )
  // await spotifyBrowserPlaySpotifyUriWithName(
  //   scope,
  //   page,
  //   "spotify:track:6juUE8cpqcgs0nCHfFGn01",
  //   "Interstellar- Main Theme"
  // )
  // await spotifyBrowserPlaySpotifyUriWithName(
  //   scope,
  //   page,
  //   "spotify:artist:2elBjNSdBE2Y3f0j1mjrql",
  //   "Jay Chou"
  // )
  // await spotifyBrowserPlaySpotifyUriWithName(
  //   scope,
  //   page,
  //   "spotify:playlist:2q7U9Dh7buTnrwHEWxcxiq",
  //   "best piano songs"
  // )
  // await spotifyBrowserPlaySearchTop(scope, page, "Tech LED")
  // await spotifyBrowserPlaySearchTop(scope, page, "Piano songs without lyrics")
  await spotifyBrowserPlaySearchTop(scope, page, "盖世英雄")
}

flyingPromise(async () => {
  await Scope.with(undefined, [], async (scope) => {
    await main(scope)
  })
})
