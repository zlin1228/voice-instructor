import {
  Os2ClientMessageSpotify,
  Os2ServerMessageSpotify,
} from "cm-rabbit-common/lib/session/session-spotify.js"
import {
  Broadcast,
  Scope,
  ScopeAttachment,
  buildAttachmentForCancellation,
  launchBackgroundScope,
  sleepUntilCancel,
} from "base-core/lib/scope.js"
import { flyingPromise } from "base-core/lib/utils.js"

import { OneOf, dispatchOneOf } from "base-core/lib/one-of.js"
import {
  buildHttpServiceClient,
  defaultBuildHttpServiceClientOptions,
} from "base-node/lib/service.js"
import { browsingMinionHttpServiceSchema } from "cm-browsing-minion-common/lib/schema/schema.js"
import {
  Os2SpotifyPlayerControl,
  Os2SpotifyPlayerStatus,
} from "cm-rabbit-common/lib/spotify/spotify.js"

import { streamAudio } from "../browsing/stream-audio"
import { abortIfUndefined } from "base-core/lib/debug.js"
import { ControllerHandle, useControllerState } from "../utils/controller"
import { runEffectScope, useDebugValues } from "../utils/hooks"
import { useRef, useEffect, useCallback, useMemo } from "react"

export interface SpotifyPlayerControllerConnected {
  mediaStream: MediaStream
  playerStatus: Os2SpotifyPlayerStatus | undefined
  debugNoVncUrl: string
  disconnect: () => void
  handlePlayerControl: (playerControl: Os2SpotifyPlayerControl) => void
}

export interface SpotifyPlayerController {
  phase: OneOf<{
    none: {
      connect: (
        spotifyLoginStorage: string | undefined,
        pushClientMessage: (
          spotifyClientMessage: Os2ClientMessageSpotify
        ) => void,
        serverMessageBroadcast: Broadcast<Os2ServerMessageSpotify>
      ) => void
    }
    connecting: {
      disconnect: () => void
    }
    connected: SpotifyPlayerControllerConnected
  }>
}

export function useSpotifyPlayerController(): SpotifyPlayerController {
  const debugEnabled = useDebugValues().includes("browsing")

  const { state, stateRef, updateState } = useControllerState<{
    phase: OneOf<{
      none: {}
      connecting: {}
      connected: {
        mediaStream: MediaStream
        playerStatus: Os2SpotifyPlayerStatus | undefined
        debugNoVncUrl: string
      }
    }>
  }>({
    phase: {
      kind: "none",
      value: {},
    },
  })

  const cancelCtrl = useRef<{
    cancel: (reason: Error) => void
    attachment: ScopeAttachment
  }>()

  const pushClientMessageRef =
    useRef<(spotifyClientMessage: Os2ClientMessageSpotify) => void>()
  const serverMessageBroadcastRef = useRef<Broadcast<Os2ServerMessageSpotify>>()

  const connect = useCallback(
    (
      spotifyLoginStorage: string | undefined,
      pushClientMessage: (
        spotifyClientMessage: Os2ClientMessageSpotify
      ) => void,
      serverMessageBroadcast: Broadcast<Os2ServerMessageSpotify>
    ) => {
      pushClientMessageRef.current = pushClientMessage
      serverMessageBroadcastRef.current = serverMessageBroadcast
      pushClientMessage({
        playerConnect: {
          storage: spotifyLoginStorage,
          debugEnabled,
        },
      })
      updateState({
        ...stateRef.current,
        phase: {
          kind: "connecting",
          value: {},
        },
      })
      cancelCtrl.current = buildAttachmentForCancellation(true)
    },
    [
      pushClientMessageRef,
      serverMessageBroadcastRef,
      debugEnabled,
      updateState,
      stateRef,
    ]
  )

  const disconnect = useCallback(() => {
    abortIfUndefined(pushClientMessageRef.current)({
      playerDisconnect: {},
    })
    abortIfUndefined(cancelCtrl.current).cancel(
      new Error("Player is disconnected")
    )
    cancelCtrl.current = undefined
    updateState({
      ...stateRef.current,
      phase: {
        kind: "none",
        value: {},
      },
    })
  }, [pushClientMessageRef, updateState, stateRef])

  const handlePlayerControl = useCallback(
    (playerControl: Os2SpotifyPlayerControl) => {
      abortIfUndefined(pushClientMessageRef.current)({
        playerControl,
      })
    },
    [pushClientMessageRef]
  )

  const active =
    state.phase.kind === "connecting" || state.phase.kind === "connected"

  useEffect(
    () =>
      runEffectScope(async (scope, cancel) => {
        if (!active) {
          return
        }
        let playerStatusBeforeConnected: Os2SpotifyPlayerStatus | undefined
        abortIfUndefined(serverMessageBroadcastRef.current).listen(
          scope,
          (serverMessage) => {
            if (serverMessage.playerReady !== undefined) {
              if (stateRef.current.phase.kind !== "connecting") {
                cancel(new Error("Player is not connecting"))
                return
              }
              const { serviceUrl, iceServersJson, debugNoVncUrl } =
                serverMessage.playerReady
              launchBackgroundScope(scope, async (scope) => {
                await Scope.with(
                  undefined,
                  [abortIfUndefined(cancelCtrl.current).attachment],
                  async (scope) => {
                    const mediaStream = await streamAudio(
                      scope,
                      cancel,
                      buildHttpServiceClient(
                        browsingMinionHttpServiceSchema,
                        defaultBuildHttpServiceClientOptions(serviceUrl)
                      ),
                      iceServersJson
                    )
                    updateState({
                      ...stateRef.current,
                      phase: {
                        kind: "connected",
                        value: {
                          mediaStream,
                          playerStatus: playerStatusBeforeConnected,
                          debugNoVncUrl,
                        },
                      },
                    })
                    await sleepUntilCancel(scope)
                  }
                )
              })
            }
            if (serverMessage.playerStatus !== undefined) {
              if (stateRef.current.phase.kind !== "connected") {
                playerStatusBeforeConnected = serverMessage.playerStatus
                return
              }
              updateState({
                ...stateRef.current,
                phase: {
                  kind: "connected",
                  value: {
                    ...stateRef.current.phase.value,
                    playerStatus: serverMessage.playerStatus,
                  },
                },
              })
            }
          }
        )
        scope.onLeave(async () => {
          if (stateRef.current.phase.kind === "connected") {
            pushClientMessageRef.current?.({
              playerDisconnect: {},
            })
          }
        })
        await sleepUntilCancel(scope)
      }),
    [
      serverMessageBroadcastRef,
      pushClientMessageRef,
      stateRef,
      updateState,
      active,
    ]
  )

  return useMemo<SpotifyPlayerController>(
    () => ({
      phase: dispatchOneOf(state.phase, {
        none: (x) => ({
          kind: "none",
          value: {
            ...x,
            connect,
          },
        }),
        connecting: (x) => ({
          kind: "connecting",
          value: {
            ...x,
            disconnect,
          },
        }),
        connected: (x) => ({
          kind: "connected",
          value: {
            ...x,
            disconnect,
            handlePlayerControl,
          },
        }),
      }),
    }),
    [state, connect, disconnect, handlePlayerControl]
  )
}
