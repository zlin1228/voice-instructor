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
import { registerPageCallback } from "base-playwright/lib/playwright.js"
import {
  Os2SpotifyPlayerControl,
  Os2SpotifyPlayerStatus,
} from "cm-rabbit-common/lib/spotify/spotify.js"
import { buildIceServersJson } from "../../stunner.js"
import { KubernetesServiceLocator } from "base-kubernetes/lib/kubernetes.js"
import {
  SpotifyApiTrackType,
  spotifyApiTrackPlaybackType,
  spotifyApiTracksType,
} from "./spotify-schema.js"
import { log } from "base-core/lib/logging.js"
import { registerPlayerStatusReporter } from "./spotify-browsing.js"
import { throwError } from "base-core/lib/exception.js"

function getAlbumImageUrlFromTrack(
  track: SpotifyApiTrackType
): string | undefined {
  return track.album.images.filter((image) => image.width === 300)?.[0]?.url
}

export async function spotifyBrowserInteractiveLogin(
  scope: Scope,
  page: Page,
  onLoginReady: () => Promise<void>
): Promise<string> {
  await page.goto("https://open.spotify.com/")
  await sleepSeconds(scope, 1)
  await waitForCookie(scope, page, "sp_dc", async () => {
    await page.goto(
      "https://accounts.spotify.com/en/login?continue=https&3A%2F%2Fopen.spotify.com%2F"
    )
    await onLoginReady()
  })
  const cookies = await page.context().cookies()
  return JSON.stringify(cookies)
}

export async function spotifyBrowserPlaySearchTop(
  scope: Scope,
  page: Page,
  query: string
): Promise<void> {
  log.info(`Play search top: [${query}]`)
  if (page.url().startsWith("https://open.spotify.com/")) {
    if (!page.url().startsWith("https://open.spotify.com/search")) {
      log.info(
        "Browser is not at https://open.spotify.com/search. Click the search button."
      )
      await page
        .locator('nav[aria-label="Main"] a[aria-label="Search"]')
        .evaluate((el: HTMLAnchorElement) => el.click())
    }
    log.info("Clear the search input.")
    await page.fill('[data-testid="search-input"]', "")
    log.info("Wait until the recent search result is cleared")
    await page.locator('section[aria-label="Browse all"]').waitFor()
    log.info("Fill the search input")
    await page.fill('[data-testid="search-input"]', query)
  } else {
    log.info("Browser is not at Spotify. Go to Spotify.")
    await page.goto(
      `https://open.spotify.com/search/${encodeURIComponent(query)}`
    )
    await sleepSeconds(scope, 2)
  }
  log.info("Check the search result type")
  const link = await page
    .locator('div[data-testid="top-result-card"] a[title]')
    .getAttribute("href")
  if (
    ["track", "playlist", "album", "artist"].some((x) =>
      link?.startsWith(`/${x}/`)
    )
  ) {
    log.info("Click the search result")
    await page
      .locator('div[data-testid="herocard-click-handler"]')
      .evaluate((el: HTMLButtonElement) => el.click())
    log.info("Click the play button")
    await page
      .locator(
        'div[data-testid="action-bar-row"] button[data-testid=play-button]'
      )
      .evaluate((el: HTMLAnchorElement) => {
        if (el.getAttribute("aria-label")?.startsWith("Pause") === true) {
          console.log("The song is already playing, do nothing")
          return
        }
        el.click()
      })
  } else {
    log.info("Click the play button of the first song")
    await page
      .locator(
        'section[data-testid="search-tracks-result"] div[role="row"][aria-rowindex="1"] div[aria-colindex="1"] button'
      )
      .evaluate((el: HTMLAnchorElement) => {
        if (el.getAttribute("aria-label")?.startsWith("Pause") === true) {
          console.log("The song is already playing, do nothing")
          return
        }
        console.log("Click", el)
        el.click()
      })
  }
  log.info("Finished all operations")
}

export async function spotifyBrowserPlaySpotifyUriWithName(
  scope: Scope,
  page: Page,
  spotifyUri: string,
  name: string
): Promise<void> {
  const parts =
    stringSplitToVector(spotifyUri, ":", 3) ??
    throwError(`invalid Spotify URI: [${spotifyUri}]`)
  if (page.url().startsWith("https://open.spotify.com/")) {
    if (!page.url().startsWith("https://open.spotify.com/search/")) {
      await page
        .locator('nav[aria-label="Main"] a[aria-label="Search"]')
        .evaluate((el: HTMLAnchorElement) => el.click())
    }
    await page.fill('[data-testid="search-input"]', name)
  } else {
    await page.goto(
      `https://open.spotify.com/search/${encodeURIComponent(name)}`
    )
    await sleepSeconds(scope, 2)
  }

  if (parts[1] === "track") {
    try {
      await page
        .locator(`a[href="/search/${encodeURIComponent(name)}/tracks"] button`)
        .evaluate((el: HTMLButtonElement) => el.click())
      await page
        .locator('div[data-testid="track-list"]>:last-child div[role="row"]')
        .filter({
          has: page.locator(`a[href="/track/${parts[2]}"]`),
        })
        .locator('div[role="gridcell"]:first-child button')
        .evaluate(
          (el: HTMLButtonElement) => {
            if (el.getAttribute("aria-label") === "Pause") {
              console.log("Track is already playing, do nothing")
              return
            }
            console.log(el)
            el.click()
          },
          undefined,
          {
            timeout: 3000,
          }
        )
    } catch (e) {
      log.info(
        `Failed to play track [${spotifyUri}] using query [${name}] due to: ${String(
          e
        )}`
      )
      await page.goto(
        `https://open.spotify.com/track/${encodeURIComponent(parts[2])}`
      )
      await page
        .locator("[class=os-content] button[aria-label=Play]")
        .evaluate((el: HTMLButtonElement) => el.click())
    }
  } else if (parts[1] === "artist") {
    try {
      await page
        .locator(`a[href="/search/${encodeURIComponent(name)}/artists"] button`)
        .evaluate((el: HTMLButtonElement) => el.click())
      await page
        .locator(
          'div[id="searchPage"] div[data-testid^="search-category-card-"]'
        )
        .filter({
          has: page.locator(`a[href="/artist/${parts[2]}"]`),
        })
        .locator('button[data-testid="play-button"]')
        .evaluate(
          (el: HTMLButtonElement) => {
            if (el.getAttribute("aria-label")?.startsWith("Pause ") === true) {
              console.log("The artist is already playing, do nothing")
              return
            }
            console.log(el)
            el.click()
          },
          undefined,
          {
            timeout: 3000,
          }
        )
    } catch (e) {
      log.info(
        `Failed to play artist [${spotifyUri}] using query [${name}] due to: ${String(
          e
        )}`
      )
      await page.goto(
        `https://open.spotify.com/artist/${encodeURIComponent(parts[2])}`
      )
      await page
        .locator("[class=os-content] button[aria-label=Play]")
        .evaluate((el: HTMLButtonElement) => el.click())
    }
  } else if (parts[1] === "playlist") {
    try {
      await page
        .locator(
          `a[href="/search/${encodeURIComponent(name)}/playlists"] button`
        )
        .evaluate((el: HTMLButtonElement) => el.click())
      await page
        .locator(
          'div[id="searchPage"] div[data-testid^="search-category-card-"]'
        )
        .filter({
          has: page.locator(`a[href="/playlist/${parts[2]}"]`),
        })
        .locator('button[data-testid="play-button"]')
        .evaluate(
          (el: HTMLButtonElement) => {
            if (el.getAttribute("aria-label")?.startsWith("Pause") === true) {
              console.log("The playlist is already playing, do nothing")
              return
            }
            console.log(el)
            el.click()
          },
          undefined,
          {
            timeout: 3000,
          }
        )
    } catch (e) {
      log.info(
        `Failed to play playlist [${spotifyUri}] using query [${name}] due to: ${String(
          e
        )}`
      )
      await page.goto(
        `https://open.spotify.com/playlist/${encodeURIComponent(parts[2])}`
      )
      await page
        .locator("[class=os-content] button[data-testid=play-button]")
        .evaluate((el: HTMLButtonElement) => el.click())
    }
  } else if (parts[1] === "album") {
    try {
      await page
        .locator(`a[href="/search/${encodeURIComponent(name)}/albums"] button`)
        .evaluate((el: HTMLButtonElement) => el.click())
      await page
        .locator(
          'div[id="searchPage"] div[data-testid^="search-category-card-"]'
        )
        .filter({
          has: page.locator(`a[href="/album/${parts[2]}"]`),
        })
        .locator('button[data-testid="play-button"]')
        .evaluate(
          (el: HTMLButtonElement) => {
            if (el.getAttribute("aria-label")?.startsWith("Pause") === true) {
              console.log("The album is already playing, do nothing")
              return
            }
            console.log(el)
            el.click()
          },
          undefined,
          {
            timeout: 3000,
          }
        )
    } catch (e) {
      log.info(
        `Failed to play album [${spotifyUri}] using query [${name}] due to: ${String(
          e
        )}`
      )
      await page.goto(
        `https://open.spotify.com/album/${encodeURIComponent(parts[2])}`
      )
      await page
        .locator("[class=os-content] button[data-testid=play-button]")
        .evaluate((el: HTMLButtonElement) => el.click())
    }
  }
}

export async function spotifyBrowserPlayLikedSongs(
  scope: Scope,
  page: Page
): Promise<boolean> {
  if (!page.url().startsWith("https://open.spotify.com/")) {
    await page.goto("https://open.spotify.com/collection/tracks")
    await sleepSeconds(scope, 2)
  }
  try {
    await page
      .locator(
        'div[role="button"][aria-labelledby~="listrow-title-spotify:collection:tracks"]'
      )
      .waitFor({ timeout: 10000 })
  } catch (e) {
    return false
  }
  await page
    .locator(
      'div[role="button"][aria-labelledby~="listrow-title-spotify:collection:tracks"]'
    )
    .evaluate((el: HTMLButtonElement) => el.click())
  await page
    .locator('[class=os-content] button[aria-label="Play Liked Songs"]')
    .evaluate((el: HTMLButtonElement) => el.click())
  return true
}

export class SpotifyClient {
  readonly #kubernetesServiceLocator: KubernetesServiceLocator
  readonly #browsingClient: BrowsingClient

  constructor(
    kubernetesServiceLocator: KubernetesServiceLocator,
    browsingController: BrowsingClient
  ) {
    this.#kubernetesServiceLocator = kubernetesServiceLocator
    this.#browsingClient = browsingController
  }

  async interactiveLogin(
    scope: Scope,
    onLoginReady: (noVncUrl: string, debugNoVncUrl: string) => Promise<void>,
    debugEnabled: boolean
  ): Promise<string> {
    const { cancel, attachment } = buildAttachmentForCancellation(true)
    return await Scope.with(scope, [attachment], async (scope) => {
      const { sessionName, page } =
        await this.#browsingClient.allocateBrowserPage(
          scope,
          undefined,
          cancel,
          debugEnabled
        )
      return await spotifyBrowserInteractiveLogin(scope, page, async () => {
        await onLoginReady(
          this.#browsingClient.getSessionNoVncUrl(sessionName),
          this.#browsingClient.getSessionDebugNoVncUrl(sessionName)
        )
      })
    })
  }

  async withPlayerSession(
    scope: Scope,
    storage: string,
    onPlayerStatusChange: (playerStatus: Os2SpotifyPlayerStatus) => void,
    body: (
      scope: Scope,
      serviceUrl: string,
      debugNoVncUrl: string,
      iceServersJson: string,
      playerController: (playerControl: Os2SpotifyPlayerControl) => void
    ) => Promise<void>,
    debugEnabled: boolean
  ): Promise<void> {
    const { cancel, attachment } = buildAttachmentForCancellation(true)
    return await Scope.with(scope, [attachment], async (scope) => {
      const { sessionName, page } =
        await this.#browsingClient.allocateBrowserPage(
          scope,
          storage,
          cancel,
          debugEnabled
        )
      let lastReportedStatus: Os2SpotifyPlayerStatus | undefined = undefined
      const trackInfos = new Map<string, SpotifyApiTrackType>()
      await registerResponseJsonListener(
        scope,
        page,
        spotifyApiTracksType,
        (url) => url.startsWith("https://api.spotify.com/v1/tracks?"),
        (resp) => {
          for (const track of resp.tracks) {
            if (track === null) continue
            if (trackInfos.has(track.uri)) {
              trackInfos.set(track.uri, track)
              continue
            }
            trackInfos.set(track.uri, track)
            if (lastReportedStatus?.trackSpotifyUri === track.uri) {
              const albumImageUrl = getAlbumImageUrlFromTrack(track)
              if (albumImageUrl !== undefined) {
                lastReportedStatus = {
                  ...lastReportedStatus,
                  albumImageUrl,
                }
                onPlayerStatusChange({
                  ...lastReportedStatus,
                })
              }
            }
          }
        }
      )
      await registerPageCallback<BrowserCallbackValue<Os2SpotifyPlayerStatus>>(
        scope,
        page,
        "reportPlayerStatus",
        (playerStatus) => {
          // TODO: dedup
          if (playerStatus.error !== undefined) {
            log.info(`Player status error: ${playerStatus.error}`)
          } else {
            const trackInfo = trackInfos.get(playerStatus.value.trackSpotifyUri)
            if (trackInfo !== undefined) {
              const albumImageUrl = getAlbumImageUrlFromTrack(trackInfo)
              lastReportedStatus = {
                ...playerStatus.value,
                ...(albumImageUrl !== undefined && { albumImageUrl }),
              }
            } else {
              lastReportedStatus = playerStatus.value
            }
            console.log(
              JSON.stringify({
                sessionName,
                playerStatus: lastReportedStatus,
              })
            )
            onPlayerStatusChange(lastReportedStatus)
          }
        }
      )
      // await preventPageLoadingImages(scope, page)
      await page.addInitScript(registerPlayerStatusReporter)
      await page.goto("https://open.spotify.com/search/")
      try {
        log.info("Waiting for Cookie accept button")
        await page.locator('[id="onetrust-accept-btn-handler"]').evaluate(
          (el: HTMLButtonElement) => {
            el.click()
          },
          undefined,
          { timeout: 500 }
        )
      } catch (e) {}
      log.info("Finished handling Cookie accept button")
      const iceServersJson = await buildIceServersJson(
        this.#kubernetesServiceLocator,
        sessionName,
        (60 * 60 * 24).toString() // 24 hours
      )
      const handlePlayTrack = async (scope: Scope, spotifyTrackUri: string) => {
        const trackId = stringRemovePrefix(spotifyTrackUri, "spotify:track:")
        if (trackId === undefined) {
          throw new Error(`Invalid Spotify track URI: ${spotifyTrackUri}`)
        }
        // await preventPageLoadingImages(scope, page)
        await page.goto(
          `https://open.spotify.com/track/${encodeURIComponent(trackId)}`
        )
        await clickPageFast(scope, page, "[class=os-content] [aria-label=Play]")
      }
      const handlePlaySearchTop = async (scope: Scope, query: string) => {
        await spotifyBrowserPlaySearchTop(scope, page, query)
      }
      const handlePlaySpotifyUriWithName = async (
        scope: Scope,
        spotifyUri: string,
        name: string
      ) => {
        await spotifyBrowserPlaySpotifyUriWithName(
          scope,
          page,
          spotifyUri,
          name
        )
      }
      const handlePlayPlaylist = async (
        scope: Scope,
        spotifyPlaylistUri: string
      ) => {
        const playlistId = stringRemovePrefix(
          spotifyPlaylistUri,
          "spotify:playlist:"
        )
        if (playlistId === undefined) {
          throw new Error(`Invalid Spotify playlist URI: ${spotifyPlaylistUri}`)
        }
        // await preventPageLoadingImages(scope, page)
        await page.goto(
          `https://open.spotify.com/playlist/${encodeURIComponent(playlistId)}`
        )
        await clickPageFast(
          scope,
          page,
          "[class=os-content] [data-testid=play-button]"
        )
      }
      const handlePlaySearch = async (
        scope: Scope,
        query: string,
        type: string
      ) => {
        // TODO: handle search type
        if (
          page.url().startsWith("https://open.spotify.com/search/") &&
          page.url().endsWith("/tracks")
        ) {
          await page.fill('[data-testid="search-input"]', query)
          // await page.keyboard.press("Enter")
        } else {
          await page.goto(
            `https://open.spotify.com/search/${encodeURIComponent(query)}/track`
          )
        }
        // TODO: Improve this
        await sleepSeconds(scope, 1)
        // await page
        //   .locator('div[data-testid="track-list"] div[role="row"]:first-child')
        //   .hover()
        await page
          .locator(
            'div[data-testid="track-list"]>:last-child div[role="row"]:first-child'
          )
          .hover()
        await dblClickPageFast(
          scope,
          page,
          'div[data-testid="track-list"]>:last-child div[role="row"]:first-child div[role="gridcell"]:first-child button'
        )
        // await page.locator('[data-testid="top-result-card"]').hover()
        // await clickPageFast(
        //   scope,
        //   page,
        //   '[data-testid="top-result-card"] [data-testid="play-button"]'
        // )
      }
      const handleSwitchResume = async (scope: Scope) => {
        await clickPageFast(
          scope,
          page,
          'footer[data-testid="now-playing-bar"] button[data-testid="control-button-playpause"]'
        )
      }
      const handlePrevious = async (scope: Scope) => {
        await clickPageFast(
          scope,
          page,
          'footer[data-testid="now-playing-bar"] button[data-testid="control-button-skip-back"]'
        )
      }
      const handleNext = async (scope: Scope) => {
        await clickPageFast(
          scope,
          page,
          'footer[data-testid="now-playing-bar"] button[data-testid="control-button-skip-forward"]'
        )
      }
      const handleSwitchShuffle = async (scope: Scope) => {
        await clickPageFast(
          scope,
          page,
          'footer[data-testid="now-playing-bar"] button[data-testid="control-button-shuffle"]'
        )
      }
      const handleSwitchRepeatMode = async (scope: Scope) => {
        await clickPageFast(
          scope,
          page,
          'footer[data-testid="now-playing-bar"] button[data-testid="control-button-repeat"]'
        )
      }
      const handlePlayerControl = (playerControl: Os2SpotifyPlayerControl) => {
        launchBackgroundScope(scope, async (scope) => {
          log.info(
            `Handling player control start - session name: [${sessionName}]`
          )
          console.log(
            JSON.stringify({
              sessionName,
              playerControl,
            })
          )
          try {
            if (playerControl.playTrack !== undefined) {
              await handlePlayTrack(
                scope,
                playerControl.playTrack.spotifyTrackUri
              )
            }
            if (playerControl.playSearchTop !== undefined) {
              await handlePlaySearchTop(
                scope,
                playerControl.playSearchTop.query
              )
            }
            if (playerControl.playSpotifyUriWithName !== undefined) {
              await handlePlaySpotifyUriWithName(
                scope,
                playerControl.playSpotifyUriWithName.spotifyUri,
                playerControl.playSpotifyUriWithName.name
              )
            }
            if (playerControl.playLikedSongs !== undefined) {
              if (!(await spotifyBrowserPlayLikedSongs(scope, page))) {
                log.info(`User doesn't have any liked songs`)
                // TODO : Report this to user?
                return
              }
            }
            if (playerControl.playPlaylist !== undefined) {
              await handlePlayPlaylist(
                scope,
                playerControl.playPlaylist.spotifyPlaylistUri
              )
            }
            if (playerControl.playSearch !== undefined) {
              await handlePlaySearch(
                scope,
                playerControl.playSearch.query,
                playerControl.playSearch.type
              )
            }
            if (playerControl.switchResume !== undefined) {
              await handleSwitchResume(scope)
            }
            if (playerControl.previous !== undefined) {
              await handlePrevious(scope)
            }
            if (playerControl.next !== undefined) {
              await handleNext(scope)
            }
            if (playerControl.switchShuffle !== undefined) {
              await handleSwitchShuffle(scope)
            }
            if (playerControl.switchRepeatMode !== undefined) {
              await handleSwitchRepeatMode(scope)
            }
          } catch (e) {
            log.info(
              `Failed to handle player control [${sessionName}]: ${String(e)}`
            )
          }
          log.info(
            `Handling player control end - session name: [${sessionName}]`
          )
        })
      }
      await body(
        scope,
        this.#browsingClient.getServiceUrl(sessionName),
        this.#browsingClient.getSessionDebugNoVncUrl(sessionName),
        iceServersJson,
        handlePlayerControl
      )
    })
  }
}
