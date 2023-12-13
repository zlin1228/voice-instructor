"use client"

import {
  Os2ClientMessageSpotify,
  Os2ServerMessageSpotify,
} from "cm-rabbit-common/lib/session/session-spotify.js"
import { Broadcast } from "base-core/lib/scope.js"
import { abortIfUndefined } from "base-core/lib/debug.js"

import JsonDisplay from "../JsonDisplay"
import { NoVncPanel } from "../novnc/novnc"
import { SpotifyLoginController } from "./spotify-login-controller"

export function SpotifyLoginDebugPanel(props: {
  controller: SpotifyLoginController
  pushClientMessage:
    | ((spotifyClientMessage: Os2ClientMessageSpotify) => void)
    | undefined
  serverMessageBroadcast: Broadcast<Os2ServerMessageSpotify> | undefined
}) {
  const { controller } = props
  const initiate =
    controller.phase.kind === "none" ||
    controller.phase.kind === "loginComplete"
      ? controller.phase.value.initiate
      : undefined
  const cancel =
    controller.phase.kind === "loadingLogin" ||
    controller.phase.kind === "loginReady"
      ? controller.phase.value.cancel
      : undefined
  const logout =
    controller.storage.kind === "available"
      ? controller.storage.value.logout
      : undefined
  const noVncUrl =
    controller.phase.kind === "loginReady"
      ? controller.phase.value.noVncUrl
      : undefined
  return (
    <div>
      <div>
        <button
          onClick={() =>
            abortIfUndefined(initiate)(
              abortIfUndefined(props.pushClientMessage),
              abortIfUndefined(props.serverMessageBroadcast)
            )
          }
          disabled={
            initiate === undefined ||
            props.pushClientMessage == undefined ||
            props.serverMessageBroadcast === undefined
          }
        >
          Login
        </button>
        <button onClick={() => cancel?.()} disabled={cancel === undefined}>
          Cancel
        </button>
        <button onClick={() => logout?.()} disabled={logout === undefined}>
          Logout
        </button>
        {noVncUrl !== undefined && <NoVncPanel noVncUrl={noVncUrl} />}
      </div>
      <div>
        <JsonDisplay value={controller} />
      </div>
    </div>
  )
}
