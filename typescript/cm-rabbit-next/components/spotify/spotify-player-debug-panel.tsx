import { useCallback, useState } from "react"

import {
  Os2ClientMessageSpotify,
  Os2ServerMessageSpotify,
} from "cm-rabbit-common/lib/session/session-spotify.js"
import { Broadcast } from "base-core/lib/scope.js"
import { abortIfUndefined } from "base-core/lib/debug.js"

import JsonDisplay from "../JsonDisplay"
import { SpotifyPlayerController } from "./spotify-player-controller"

export function SpotifyPlayerDebugPanel(props: {
  controller: SpotifyPlayerController
  spotifyLoginStorage: string | undefined
  pushClientMessage:
    | ((spotifyClientMessage: Os2ClientMessageSpotify) => void)
    | undefined
  serverMessageBroadcast: Broadcast<Os2ServerMessageSpotify> | undefined
}) {
  const { controller } = props
  const connect =
    controller.phase.kind === "none"
      ? controller.phase.value.connect
      : undefined
  const disconnect =
    controller.phase.kind !== "none"
      ? controller.phase.value.disconnect
      : undefined
  const mediaStream =
    controller.phase.kind === "connected"
      ? controller.phase.value.mediaStream
      : undefined
  const debugNoVncUrl =
    controller.phase.kind === "connected"
      ? controller.phase.value.debugNoVncUrl
      : undefined
  const audioRef = useCallback(
    (audio: HTMLAudioElement | null) => {
      if (audio === null) {
        return
      }
      if (mediaStream !== undefined) {
        audio.srcObject = mediaStream
      } else {
        audio.srcObject = null
      }
    },
    [mediaStream]
  )
  const handlePlayerControl =
    controller.phase.kind === "connected"
      ? controller.phase.value.handlePlayerControl
      : undefined
  const [searchTopQuery, setSearchTopQuery] = useState<string>("叶惠美")

  const [spotifyUri, setSpotifyUri] = useState<string>(
    "spotify:artist:2elBjNSdBE2Y3f0j1mjrql"
  )
  const [name, setName] = useState<string>("Jay Chou")

  return (
    <div>
      <div>
        <button
          onClick={() =>
            abortIfUndefined(connect)(
              abortIfUndefined(props.spotifyLoginStorage),
              abortIfUndefined(props.pushClientMessage),
              abortIfUndefined(props.serverMessageBroadcast)
            )
          }
          disabled={
            connect === undefined ||
            props.spotifyLoginStorage === undefined ||
            props.pushClientMessage === undefined ||
            props.serverMessageBroadcast === undefined
          }
        >
          Connect
        </button>
        <button
          onClick={() => disconnect?.()}
          disabled={disconnect === undefined}
        >
          Disconnect
        </button>
        {debugNoVncUrl !== undefined && (
          <a href={debugNoVncUrl} target="_blank">
            Browser (will not show in production)
          </a>
        )}
        <div>
          <audio ref={audioRef} controls autoPlay />
        </div>
        {handlePlayerControl !== undefined && (
          <div>
            <div>
              <input
                type="text"
                value={searchTopQuery}
                onChange={(e) => setSearchTopQuery(e.target.value)}
              />
              <button
                onClick={() => {
                  handlePlayerControl?.({
                    playSearchTop: {
                      query: searchTopQuery,
                    },
                  })
                }}
              >
                Play Search Top
              </button>
            </div>
            <div>
              <input
                type="text"
                value={spotifyUri}
                onChange={(e) => setSpotifyUri(e.target.value)}
              />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <button
                onClick={() => {
                  handlePlayerControl?.({
                    playSpotifyUriWithName: {
                      spotifyUri,
                      name,
                    },
                  })
                }}
              >
                Search & Play
              </button>
            </div>
            <div>
              <button
                onClick={() => {
                  handlePlayerControl?.({
                    playLikedSongs: {},
                  })
                }}
              >
                Play liked songs
              </button>
            </div>
          </div>
        )}
      </div>
      <div>
        <JsonDisplay value={controller} />
      </div>
    </div>
  )
}
