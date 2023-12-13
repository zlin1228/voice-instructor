import Image from "next/image"

import { Broadcast } from "base-core/lib/scope.js"
import {
  Os2ClientMessageSpotify,
  Os2ServerMessageSpotify,
} from "cm-rabbit-common/lib/session/session-spotify.js"
import { NoVncPanel } from "../novnc/novnc"
import { SpotifyLoginController } from "../spotify/spotify-login-controller"
import { SpotifyLoginDebugPanel } from "../spotify/spotify-login-debug-panel"
import { useDebugValueHas } from "../utils/hooks"

import closeIcon from "./close-button.svg"

export default function SpotifyLoginPanel(props: {
  controller: SpotifyLoginController
  pushClientMessage: (spotifyClientMessage: Os2ClientMessageSpotify) => void
  serverMessageBroadcast: Broadcast<Os2ServerMessageSpotify>
}) {
  const os2DebugEnabled = useDebugValueHas("os2-debug")
  const { controller } = props
  const noVncUrl =
    controller.phase.kind === "loginReady"
      ? controller.phase.value.noVncUrl
      : undefined
  if (os2DebugEnabled) {
    return (
      <div>
        <h3>Spotify Login</h3>
        <SpotifyLoginDebugPanel
          controller={props.controller}
          pushClientMessage={props.pushClientMessage}
          serverMessageBroadcast={props.serverMessageBroadcast}
        />
      </div>
    )
  }
  const handleClose = () => {
    if (controller.phase.kind === "loginReady") {
      controller.phase.value.cancel()
    }
  }
  return (
    <div>
      {noVncUrl !== undefined && (
        <div
          role="region"
          aria-label="Spotify Login"
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: "black",
            flexDirection: "column",
            zIndex: 1000,
            display: "flex",
            justifyContent: "flex-start",
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: "1000px",
              height: "800px",
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-start",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div
              style={{
                width: "1000px",
                height: "800px",
                // overflow: "hidden",
              }}
            >
              <NoVncPanel noVncUrl={noVncUrl} />
            </div>
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: 60,
                backgroundImage: "linear-gradient(transparent, black)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                pointerEvents: "none",
              }}
            >
              <Image
                src={closeIcon}
                onClick={handleClose}
                alt="Close"
                height={40}
                style={{
                  pointerEvents: "auto",
                }}
              />
            </div>
          </div>
          <div style={{ flex: 1 }}></div>
        </div>
      )}
    </div>
  )
}
