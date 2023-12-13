"use client"

import { useState } from "react"
import { SpotifyPlayerUI } from "../../../components/spotify/spotify-player-ui"
import { Os2SpotifyPlayerControl } from "cm-rabbit-common/lib/spotify/spotify"

export default function SpotifyPlayer(props: {}) {
  const durationSeconds = 306
  const [playing, setPlaying] = useState(true)
  const [shuffle, setShuffle] = useState(false)
  const [repeatMode, setRepeatMode] = useState("off")
  const [matchingStartPlayingTime, setMatchingStartPlayingTime] = useState(
    new Date(Date.now() - 10000)
  )
  const [playedSeconds, setPlayedSeconds] = useState(10000)
  const [volume, setVolume] = useState(0.5)

  const handlePlayerControl = (playerControl: Os2SpotifyPlayerControl) => {
    if (playerControl.switchResume !== undefined) {
      if (playing) {
        setPlayedSeconds(
          (Date.now() - matchingStartPlayingTime.getTime()) / 1000
        )
        setPlaying(false)
      } else {
        setMatchingStartPlayingTime(new Date(Date.now() - playedSeconds * 1000))
        setPlaying(true)
      }
    }
    if (playerControl.switchRepeatMode !== undefined) {
      setRepeatMode((repeatMode) => {
        if (repeatMode === "off") return "context"
        else if (repeatMode === "context") return "track"
        else return "off"
      })
    }
    if (playerControl.switchShuffle !== undefined) {
      setShuffle((shuffle) => !shuffle)
    }
    if (playerControl.jumpToPosition !== undefined) {
      setPlayedSeconds(
        playerControl.jumpToPosition.playedRatio * durationSeconds
      )
      setMatchingStartPlayingTime(
        new Date(
          Date.now() -
            playerControl.jumpToPosition.playedRatio * durationSeconds * 1000
        )
      )
    }
    if (playerControl.jumpToPosition !== undefined) {
      setPlayedSeconds(
        playerControl.jumpToPosition.playedRatio * durationSeconds
      )
      setMatchingStartPlayingTime(
        new Date(
          Date.now() -
            playerControl.jumpToPosition.playedRatio * durationSeconds * 1000
        )
      )
    }
    if (playerControl.previous !== undefined) {
      handlePlayerControl({
        jumpToPosition: {
          playedRatio: 0.2,
        },
      })
    }
    if (playerControl.next !== undefined) {
      handlePlayerControl({
        jumpToPosition: {
          playedRatio: 0.8,
        },
      })
    }
  }
  return (
    <div>
      <h3>Spotify Player UI</h3>
      <SpotifyPlayerUI
        timeOffsetSeconds={0}
        playerStatus={{
          playing,
          matchingStartPlayingTime: playing
            ? matchingStartPlayingTime
            : undefined,
          playedSeconds: playing ? undefined : playedSeconds,
          durationSeconds,
          shuffle,
          repeatMode,
          trackName:
            "PocketCalculatorPocketCalculatorPocketCalculator Pocket Calculator",
          trackSpotifyUri: "spotify:track:123456",
          albumImageUrl:
            "https://i.scdn.co/image/ab67616d00004851e49b7bfa74ee582a21ae2d99",
          artistName: "Kraftwerk",
        }}
        handlePlayerControl={handlePlayerControl}
        volume={volume}
        onVolumeChange={setVolume}
      />
    </div>
  )
}
