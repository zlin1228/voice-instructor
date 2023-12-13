"use client"

import { abortIfUndefined } from "base-core/lib/debug"
import { SpotifyPlayer, useSpotifyPlayerController } from "./SpotifyPlayer"
import {
  initiateSpotifyLogin,
  spotifyLogout,
  useSpotifyToken,
} from "./spotify-peripheral"
import { serviceClient } from "./service"
import { flyingPromise } from "base-core/lib/utils"

export function SpotifyDebugPanel(props: {}) {
  const token = useSpotifyToken()
  const controller = useSpotifyPlayerController("OS2", token)
  const deviceId =
    controller.kind === "connected" || controller.kind === "ready"
      ? controller.value.deviceId
      : undefined

  const playTrack = () => {
    flyingPromise(async () => {
      try {
        await serviceClient.post_spotifyPlay.fetch(
          {
            token: abortIfUndefined(token),
            deviceId: abortIfUndefined(deviceId),
            trackUris: [
              "spotify:track:5tE3p4vIwoqUZLkKF2PNeB",
              "spotify:track:3lSOZb5rruEnFbe9xWELF6",
              "spotify:track:4nPNK2LaoHoUlW7e6YyJ31",
            ],
            // uris: ["spotify:playlist:5UgAMrhfOj2JCSvu5cO4k6"],
          },
          new AbortController().signal
        )
      } catch (e) {
        console.log(`Failed to play track due to error: ${String(e)}`)
      }
    })
  }

  return (
    <div>
      <div>
        <button onClick={() => initiateSpotifyLogin()}>Login</button>
        <button onClick={() => spotifyLogout()}>Log out</button>
        Logged in: {token === undefined ? "No" : "Yes"}
      </div>
      <div>
        Device ID: {deviceId === undefined ? "Not available" : deviceId}
      </div>
      <div>
        <button
          onClick={() => playTrack()}
          disabled={token === undefined || deviceId === undefined}
        >
          Play
        </button>
      </div>
      <div>
        <SpotifyPlayer token={token} controller={controller} />
      </div>
    </div>
  )
}
