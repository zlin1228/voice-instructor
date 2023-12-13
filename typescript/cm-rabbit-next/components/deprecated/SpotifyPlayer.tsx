"use client"

import { useEffect, useState } from "react"
import Image from "next/image"

import { OneOf, dispatchOneOf } from "base-core/lib/one-of"

import albumIcon from "../public/spotify/icons/album.svg"
import previousIcon from "../public/spotify/icons/previous.svg"
import nextIcon from "../public/spotify/icons/next.svg"
import repeatIcon from "../public/spotify/icons/repeat-off.svg"
import playIcon from "../public/spotify/icons/play.svg"
import shuffleIcon from "../public/spotify/icons/shuffle-off.svg"
import spotifyIcon from "../public/spotify/icons/spotify.svg"

// Spotify Reference:
//  - https://developer.spotify.com/documentation/web-playback-sdk/tutorials/getting-started
//  - https://developer.spotify.com/documentation/web-playback-sdk/reference

function loadSpotifyPlaybackSdk(): Promise<void> {
  return new Promise((resolve) => {
    window.onSpotifyWebPlaybackSDKReady = () => {
      resolve()
    }
    const script = document.createElement("script")
    script.src = "https://sdk.scdn.co/spotify-player.js"
    script.async = true
    document.body.appendChild(script)
  })
}

let spotifyPlaybackSdkLoader: Promise<void> | undefined = undefined

export type SpotifyPlayerController = OneOf<{
  // The player is connecting to Spotify
  connecting: {}
  // The player is connected to Spotify but it is not an active playback device
  connected: {
    deviceId: string
  }
  // The player is connected to Spotify and it is an active playback device
  ready: {
    deviceId: string
    player: Spotify.Player
    playerState: Spotify.PlaybackState
  }
  // The player is in an invalid state
  error: {
    why: string
  }
}>

export function useSpotifyPlayerController(
  name: string,
  token: string | undefined
): SpotifyPlayerController {
  const [errorReason, setErrorReason] = useState<string>()
  const [connected, setConnected] = useState(false)
  const [deviceId, setDeviceId] = useState<string>()
  const [ready, setReady] = useState(false)
  const [playerState, setPlayerState] = useState<Spotify.PlaybackState>()
  const [player, setPlayer] = useState<Spotify.Player>()
  useEffect(() => {
    let ignore = false
    let connectedPlayer: Spotify.Player | undefined = undefined
    let firstState = true
    async function initPlayer() {
      if (token === undefined) {
        setErrorReason("Token is not available")
        return
      }
      if (spotifyPlaybackSdkLoader === undefined) {
        spotifyPlaybackSdkLoader = loadSpotifyPlaybackSdk()
      }
      await spotifyPlaybackSdkLoader
      if (ignore) return
      const player = new Spotify.Player({
        name,
        getOAuthToken: (cb) => cb(token),
      })
      setPlayer(player)
      player.addListener("ready", ({ device_id }) => {
        console.log(`ready - ${device_id}`)
        setDeviceId(device_id)
        setReady(true)
      })
      player.addListener("not_ready", ({ device_id }) => {
        console.log(`not_ready - ${device_id}`)
        setDeviceId(device_id)
        setReady(false)
      })
      player.addListener("player_state_changed", (state) => {
        console.log("Paused: ", state.paused)
        setPlayerState(state)
        if (firstState) {
          firstState = false
          const f = async function () {
            await player.activateElement()
            await player.resume()
          }
          f().catch((e) => console.log(e))
        }
      })
      const connected = await player.connect()
      if (ignore) return
      if (!connected) {
        setErrorReason("The player failed to connect to Spotify")
      }
      connectedPlayer = player
      setConnected(true)
    }
    initPlayer().catch((err) => {
      setErrorReason(`Encountered unexpected exception: ${String(err)}`)
    })
    return () => {
      ignore = true
      setErrorReason(undefined)
      setConnected(false)
      setDeviceId(undefined)
      setReady(false)
      setPlayerState(undefined)
      setPlayer(undefined)
      connectedPlayer?.disconnect()
    }
  }, [name, token])
  if (errorReason !== undefined) {
    return {
      kind: "error",
      value: {
        why: errorReason,
      },
    }
  }
  if (
    connected &&
    deviceId !== undefined &&
    ready &&
    playerState !== undefined &&
    player !== undefined
  ) {
    console.log("ready")
    return {
      kind: "ready",
      value: {
        deviceId,
        player,
        playerState,
      },
    }
  }
  if (connected && deviceId !== undefined) {
    console.log("connected")
    return {
      kind: "connected",
      value: {
        deviceId,
      },
    }
  }
  return {
    kind: "connecting",
    value: {},
  }
}

function SpotifyPlayerProgressBar() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: 6,
          justifyContent: "space-between",
          height: "10px",
        }}
      >
        <div>0:10</div>
        <div>-8:33</div>
      </div>
      <div style={{ height: "18px" }}>
        <div
          style={{
            height: "2px",
            width: "10%",
            backgroundColor: "#000000",
            borderRadius: "1px",
          }}
        ></div>
      </div>
    </div>
  )
}

function SpotifyPlayerControlBar(props: {
  playing: boolean
  // shuffle: boolean
  // onShuffleChange: (shuffle: boolean) => void
  onSkipToPrevious: () => void
  onSkipToNext: () => void
  onPlayChange: (play: boolean) => void
  // onRepeatChange: (repeatMode: "off" | "track" | "context") => void
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-around",
        height: "32px",
      }}
    >
      <Image priority src={shuffleIcon} alt="Shuffle" />
      <Image
        priority
        src={previousIcon}
        alt="Skip to Previous"
        onClick={() => {
          props.onSkipToPrevious()
        }}
      />
      <Image
        priority
        src={playIcon}
        alt="Toggle Play"
        onClick={() => {
          console.log(`Play: ${props.playing}`)
          props.onPlayChange(!props.playing)
        }}
      />
      <Image
        priority
        src={nextIcon}
        alt="Skip to Next"
        onClick={() => {
          props.onSkipToNext()
        }}
      />
      <Image priority src={repeatIcon} alt="Repeat Mode" />
    </div>
  )
}

function SpotifyPlayerPanel(props: {
  token: string
  player: Spotify.Player
  playerState: Spotify.PlaybackState
}) {
  return (
    <div
      style={{
        display: "flex",
        width: "397px",
        height: "110px",
        gap: "10px",
        color: "#000000",
        fontFamily: "Helvetica Now Text",
      }}
    >
      <Image
        priority
        src={
          props.playerState.track_window.current_track.album.images[0].url ??
          albumIcon
        }
        alt="Album"
        width={110}
        height={110}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: "1",
        }}
      >
        <div
          style={{
            fontSize: 20,
            fontWeight: 500,
            color: "black",
            height: "25px",
          }}
        >
          {props.playerState.track_window.current_track.name}
        </div>
        <div
          style={{
            fontFamily: "Helvetica Now Text",
            fontSize: 10,
            height: "14px",
          }}
        >
          {props.playerState.track_window.current_track.album.name}
        </div>
        <SpotifyPlayerProgressBar />
        <SpotifyPlayerControlBar
          playing={!props.playerState.paused}
          onSkipToPrevious={() =>
            props.player.previousTrack().catch((e) => {
              // do nothing
            })
          }
          onSkipToNext={() =>
            props.player.nextTrack().catch((e) => {
              // do nothing
            })
          }
          onPlayChange={(play) => {
            if (play) props.player.resume()
            else props.player.pause()
          }}
        />
        <Image
          style={{ alignSelf: "flex-end" }}
          priority
          src={spotifyIcon}
          alt="Spotify"
        />
      </div>
    </div>
  )
}

export function SpotifyPlayer(props: {
  token: string | undefined
  controller: SpotifyPlayerController
}): JSX.Element {
  return (
    <div>
      <div>
        {dispatchOneOf(props.controller, {
          connecting: () => <div>Connecting...</div>,
          connected: ({ deviceId }) => (
            <div>Connected - Device ID: {deviceId}</div>
          ),
          ready: ({ playerState }) => (
            <div>
              Ready - track: {playerState.track_window.current_track?.name}
            </div>
          ),
          error: ({ why }) => <div>Error: {why}</div>,
        })}
      </div>
      <div style={{ backgroundColor: "#000000", padding: "10px" }}>
        {props.token !== undefined && props.controller.kind === "ready" && (
          <SpotifyPlayerPanel
            token={props.token}
            player={props.controller.value.player}
            playerState={props.controller.value.playerState}
          />
        )}
      </div>
    </div>
  )
}
