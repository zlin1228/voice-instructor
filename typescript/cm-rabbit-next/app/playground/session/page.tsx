"use client"

import { useMemo, useState } from "react"

import { Broadcast, mapBroadcast } from "base-core/lib/scope.js"
import {
  Os2ClientMessageSpotify,
  Os2ServerMessageSpotify,
} from "cm-rabbit-common/lib/session/session-spotify.js"

import {
  SessionDebugPanel,
  useSessionController,
} from "../../../components/session/session"
import { useSpotifyLoginController } from "../../../components/spotify/spotify-login-controller"
import { SpotifyLoginDebugPanel } from "../../../components/spotify/spotify-login-debug-panel"
import { useSpotifyLoginStorage } from "../../../components/spotify/spotify-storage"
import { SpotifyPlayerUI } from "../../../components/spotify/spotify-player-ui"
import { useSpotifyPlayerController } from "../../../components/spotify/spotify-player-controller"
import { SpotifyPlayerDebugPanel } from "../../../components/spotify/spotify-player-debug-panel"

function SpotifyLoginPanel(props: {
  pushClientMessage: (spotifyClientMessage: Os2ClientMessageSpotify) => void
  serverMessageBroadcast: Broadcast<Os2ServerMessageSpotify>
}) {
  const state = useSpotifyLoginController()
  return (
    <div>
      <SpotifyLoginDebugPanel
        controller={state}
        pushClientMessage={props.pushClientMessage}
        serverMessageBroadcast={props.serverMessageBroadcast}
      />
    </div>
  )
}

function SpotifyPlayerPanel(props: {
  spotifyLoginStorage: string
  timeOffsetSeconds: number
  pushClientMessage: (spotifyClientMessage: Os2ClientMessageSpotify) => void
  serverMessageBroadcast: Broadcast<Os2ServerMessageSpotify>
}) {
  const state = useSpotifyPlayerController()
  const [volume, setVolume] = useState(0.5)
  return (
    <div>
      {state.phase.kind === "connected" &&
        state.phase.value.playerStatus !== undefined && (
          <SpotifyPlayerUI
            timeOffsetSeconds={props.timeOffsetSeconds}
            playerStatus={state.phase.value.playerStatus}
            handlePlayerControl={state.phase.value.handlePlayerControl}
            volume={volume}
            onVolumeChange={setVolume}
          />
        )}
      <SpotifyPlayerDebugPanel
        controller={state}
        spotifyLoginStorage={props.spotifyLoginStorage}
        pushClientMessage={props.pushClientMessage}
        serverMessageBroadcast={props.serverMessageBroadcast}
      />
    </div>
  )
}

export default function Session(props: {}) {
  const controller = useSessionController("/session")
  const connectedState =
    controller.phase.kind === "connected" ? controller.phase.value : undefined

  const pushSpotifyClientMessage =
    connectedState === undefined
      ? undefined
      : (spotifyClientMessage: Os2ClientMessageSpotify) => {
          connectedState.pushClientMessage({
            kind: "json",
            value: {
              spotify: spotifyClientMessage,
            },
          })
        }
  const spotifyServerMessageBroadcast = useMemo(
    () =>
      connectedState === undefined
        ? undefined
        : mapBroadcast(
            connectedState.serverMessageBroadcast,
            (serverMessage) => {
              if (serverMessage.kind !== "json") return undefined
              if (serverMessage.value.spotify === undefined) return undefined
              return serverMessage.value.spotify
            }
          ),
    [connectedState]
  )
  const spotifyLoginStorage = useSpotifyLoginStorage()

  return (
    <div>
      <div>
        <h3>Session</h3>
        <SessionDebugPanel controller={controller} />
      </div>
      {connectedState !== undefined &&
        pushSpotifyClientMessage !== undefined &&
        spotifyServerMessageBroadcast !== undefined && (
          <div>
            <h3>Spotify Login</h3>
            <SpotifyLoginPanel
              pushClientMessage={pushSpotifyClientMessage}
              serverMessageBroadcast={spotifyServerMessageBroadcast}
            />
          </div>
        )}
      {connectedState !== undefined &&
        pushSpotifyClientMessage !== undefined &&
        spotifyServerMessageBroadcast !== undefined &&
        spotifyLoginStorage !== undefined && (
          <div>
            <h3>Spotify Player</h3>
            <SpotifyPlayerPanel
              spotifyLoginStorage={spotifyLoginStorage}
              timeOffsetSeconds={controller.timeOffsetSeconds}
              pushClientMessage={pushSpotifyClientMessage}
              serverMessageBroadcast={spotifyServerMessageBroadcast}
            />
          </div>
        )}
    </div>
  )
}
