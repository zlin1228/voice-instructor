// This file will be injected into the remote browser. All functions should be self-contained.

import { Os2SpotifyPlayerStatus } from "cm-rabbit-common/lib/spotify/spotify.js"
import { BrowserCallbackValue } from "../../browsing/browser-utils"

export function registerPlayerStatusReporter() {
  console.log("registerPlayerStatusReporter enter")
  if (window !== window.top) {
    console.log("registerPlayerStatusReporter leave because window is not top")
    return
  }
  if (!window.location.href.startsWith("https://open.spotify.com/")) {
    console.log("registerPlayerStatusReporter leave before URL doesn't match")
    return
  }
  const timeTextToSeconds = (text: string): number => {
    const parts = text.split(":").reverse()
    const seconds =
      parseInt(parts[0] ?? "0") +
      parseInt(parts[1] ?? "0") * 60 +
      parseInt(parts[2] ?? "0") * 60 * 60 +
      parseInt(parts[3] ?? "0") * 60 * 60 * 24
    if (isNaN(seconds)) throw new Error(`Invalid time text: ${text}`)
    return seconds
  }

  // The footer which contains the playback controls.
  const selectorFooterPlayingBar = 'footer[data-testid="now-playing-bar"]'

  const selectorContextLink = 'a[data-testid="context-link"]'
  const selectorAlbumImage = 'img[data-testid="cover-art-image"]'
  const selectorTrackNameDiv = 'div[data-testid="context-item-info-title"]'
  const selectorArtistNameLink = 'a[data-testid="context-item-info-artist"]'
  const selectorShuffleButton = 'button[data-testid="control-button-shuffle"]'
  const selectorPlayButton = 'button[data-testid="control-button-playpause"]'
  const selectorRepeatButton = 'button[data-testid="control-button-repeat"]'
  const selectorDurationDiv = 'div[data-testid="playback-duration"]'
  const selectorPositionDiv = 'div[data-testid="playback-position"]'

  const getPlayerStatusOrThrow = (): Os2SpotifyPlayerStatus => {
    document.getElementById("onetrust-accept-btn-handler")?.click()
    const playingBarElement =
      document.querySelector(selectorFooterPlayingBar) ?? undefined
    if (playingBarElement === undefined) {
      throw new Error("Cannot find the playing bar")
    }

    const contextLinkUrl =
      playingBarElement
        .querySelector(selectorContextLink)
        ?.getAttribute("href") ?? undefined
    if (contextLinkUrl === undefined) {
      throw new Error("Cannot find the context link")
    }
    const sep = "=spotify%3Atrack%3A"
    const trackId = contextLinkUrl.substring(
      contextLinkUrl.lastIndexOf(sep) + sep.length
    )
    if (trackId === undefined) {
      throw new Error(`Cannot find the track Spotify URI: ${contextLinkUrl}`)
    }
    const trackSpotifyUri = `spotify:track:${trackId}`

    const albumImageUrl =
      playingBarElement
        .querySelector(selectorAlbumImage)
        ?.getAttribute("src") ?? undefined
    if (albumImageUrl === undefined) {
      throw new Error("Cannot find the album image")
    }
    const trackName =
      playingBarElement.querySelector(selectorTrackNameDiv)?.textContent ??
      undefined
    if (trackName === undefined) {
      throw new Error("Cannot find the track name")
    }

    const artistName =
      playingBarElement.querySelector(selectorArtistNameLink)?.textContent ??
      undefined
    if (artistName === undefined) {
      throw new Error("Cannot find the artist name")
    }

    const shuffleChecked =
      playingBarElement
        .querySelector(selectorShuffleButton)
        ?.getAttribute("aria-checked") ?? undefined
    if (shuffleChecked === undefined) {
      throw new Error("Cannot find the shuffle button")
    }
    const shuffle = shuffleChecked === "true"

    const playButtonLabel =
      playingBarElement
        .querySelector(selectorPlayButton)
        ?.getAttribute("aria-label") ?? undefined
    if (playButtonLabel === undefined) {
      throw new Error("Cannot find the play button")
    }
    const playing = playButtonLabel === "Pause"

    const repeatButtonChecked =
      playingBarElement
        .querySelector(selectorRepeatButton)
        ?.getAttribute("aria-checked") ?? undefined
    if (repeatButtonChecked === undefined) {
      throw new Error("Cannot find the repeat button")
    }
    const repeatMode =
      repeatButtonChecked === "true"
        ? "context"
        : repeatButtonChecked === "false"
        ? "off"
        : "track"

    const durationText =
      playingBarElement.querySelector(selectorDurationDiv)?.textContent ??
      undefined
    if (durationText === undefined) {
      throw new Error("Cannot find the duration text")
    }
    let durationSeconds = timeTextToSeconds(durationText)

    const positionText =
      playingBarElement.querySelector(selectorPositionDiv)?.textContent ??
      undefined
    if (positionText == undefined) {
      throw new Error("Cannot find the position text")
    }
    let positionSeconds = timeTextToSeconds(positionText)

    return {
      playing,
      ...(playing
        ? {
            matchingStartPlayingTime: new Date(
              Date.now() - positionSeconds * 1000
            ),
          }
        : {
            playedSeconds: positionSeconds,
          }),
      durationSeconds,
      shuffle,
      repeatMode,
      trackSpotifyUri,
      trackName,
      albumImageUrl,
      artistName,
    }
  }

  const getPlayerStatus = (): BrowserCallbackValue<Os2SpotifyPlayerStatus> => {
    try {
      const playerStatus = getPlayerStatusOrThrow()
      return {
        error: undefined,
        value: playerStatus,
      }
    } catch (e) {
      return {
        error: String(e),
        value: undefined,
      }
    }
  }

  let lastPlayerStatus: Os2SpotifyPlayerStatus | undefined
  const isPlayerStatusChanged = (
    p1: Os2SpotifyPlayerStatus,
    p2: Os2SpotifyPlayerStatus
  ): boolean => {
    if (p1.playing !== p2.playing) return true
    if (p1.playedSeconds !== p2.playedSeconds) return true
    if (p1.durationSeconds !== p2.durationSeconds) return true
    if (p1.shuffle !== p2.shuffle) return true
    if (p1.repeatMode !== p2.repeatMode) return true
    if (p1.trackName !== p2.trackName) return true
    if (p1.trackSpotifyUri !== p2.trackSpotifyUri) return true
    if (p1.albumImageUrl !== p2.albumImageUrl) return true
    if (p1.artistName !== p2.artistName) return true
    if (
      Math.abs(
        (p1.matchingStartPlayingTime?.getTime() ?? 0) -
          (p2.matchingStartPlayingTime?.getTime() ?? 0)
      ) > 2000
    ) {
      return true
    }
    return false
  }
  const reportPlayerStatus = () => {
    console.log("reportPlayerStatus enter")
    const playerStatus = getPlayerStatus()
    console.log("playerStatus")
    if (
      playerStatus.error === undefined &&
      lastPlayerStatus !== undefined &&
      !isPlayerStatusChanged(playerStatus.value, lastPlayerStatus)
    ) {
      console.log("Do not report status due to duplicate")
      return
    }
    lastPlayerStatus = playerStatus.value
    ;(
      window as unknown as {
        reportPlayerStatus: (
          playerStatus: BrowserCallbackValue<Os2SpotifyPlayerStatus>
        ) => void
      }
    ).reportPlayerStatus(playerStatus)
    console.log("Reported new status")
  }
  const intervalId = setInterval(() => {
    const playingBarElement =
      document.querySelector(selectorFooterPlayingBar) ?? undefined
    if (playingBarElement === undefined) {
      console.log("playingBarElement is undefined")
      return
    }
    console.log("Registering MutationObserver")
    const observer = new MutationObserver(() => {
      reportPlayerStatus()
    })
    observer.observe(playingBarElement, {
      subtree: true,
      attributes: true,
    })
    clearInterval(intervalId)
  }, 100)
}
