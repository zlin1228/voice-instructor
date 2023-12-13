"use client"

import { useCallback, useEffect, useMemo, useRef } from "react"

import {
  Os2ClientMessageSpotify,
  Os2ServerMessageSpotify,
} from "cm-rabbit-common/lib/session/session-spotify.js"
import {
  Broadcast,
  Scope,
  buildAttachmentForCancellation,
  sleepUntilCancel,
} from "base-core/lib/scope.js"
import { flyingPromise } from "base-core/lib/utils.js"

import {
  readSpotifyLoginStorage,
  useSpotifyLoginStorageKey,
  writeSpotifyLoginStorage,
} from "./spotify-storage"
import { OneOf, dispatchOneOf } from "base-core/lib/one-of.js"
import { useControllerState } from "../utils/controller"
import { runEffectScope, useDebugValues } from "../utils/hooks"
import { abortIfUndefined } from "base-core/lib/debug.js"

export interface SpotifyLoginController {
  storage: OneOf<{
    none: {}
    unavailable: {}
    available: {
      logout: () => void
    }
  }>
  phase: OneOf<{
    none: {
      initiate: (
        pushClientMessage: (
          spotifyClientMessage: Os2ClientMessageSpotify
        ) => void,
        serverMessageBroadcast: Broadcast<Os2ServerMessageSpotify>
      ) => void
    }
    loadingLogin: {
      cancel: () => void
    }
    loginReady: {
      noVncUrl: string
      debugNoVncUrl: string
      cancel: () => void
    }
    loginComplete: {
      succeeded: boolean
      initiate: (
        pushClientMessage: (
          spotifyClientMessage: Os2ClientMessageSpotify
        ) => void,
        serverMessageBroadcast: Broadcast<Os2ServerMessageSpotify>
      ) => void
    }
  }>
}

export function useSpotifyLoginController(): SpotifyLoginController {
  const debugEnabled = useDebugValues().includes("browsing")
  const storageKey = useSpotifyLoginStorageKey()

  const { state, stateRef, updateState } = useControllerState<{
    storage: OneOf<{
      none: {}
      unavailable: {}
      available: {}
    }>
    phase: OneOf<{
      none: {}
      loadingLogin: {}
      loginReady: {
        noVncUrl: string
        debugNoVncUrl: string
      }
      loginComplete: {
        succeeded: boolean
      }
    }>
  }>({
    storage: {
      kind: "none",
      value: {},
    },
    phase: {
      kind: "none",
      value: {},
    },
  })

  const pushClientMessageRef =
    useRef<(spotifyClientMessage: Os2ClientMessageSpotify) => void>()
  const serverMessageBroadcastRef = useRef<Broadcast<Os2ServerMessageSpotify>>()

  const initiate = useCallback(
    (
      pushClientMessage: (
        spotifyClientMessage: Os2ClientMessageSpotify
      ) => void,
      serverMessageBroadcast: Broadcast<Os2ServerMessageSpotify>
    ) => {
      pushClientMessageRef.current = pushClientMessage
      serverMessageBroadcastRef.current = serverMessageBroadcast
      pushClientMessage({
        logInInitiate: {
          debugEnabled,
        },
      })
      updateState({
        ...stateRef.current,
        phase: {
          kind: "loadingLogin",
          value: {},
        },
      })
    },
    [debugEnabled, stateRef, updateState]
  )

  const cancel = useCallback(() => {
    abortIfUndefined(pushClientMessageRef.current)({
      logInCancel: {},
    })
    updateState({
      ...stateRef.current,
      phase: {
        kind: "none",
        value: {},
      },
    })
  }, [pushClientMessageRef, stateRef, updateState])

  const logout = useCallback(() => {
    writeSpotifyLoginStorage(storageKey, undefined)
    updateState({
      ...stateRef.current,
      storage: {
        kind: "none",
        value: {},
      },
    })
  }, [stateRef, storageKey, updateState])

  useEffect(() => {
    updateState({
      ...stateRef.current,
      storage:
        readSpotifyLoginStorage(storageKey) !== undefined
          ? {
              kind: "available",
              value: {},
            }
          : {
              kind: "unavailable",
              value: {},
            },
    })
  }, [])

  const loginActive =
    state.phase.kind === "loadingLogin" || state.phase.kind === "loginReady"

  useEffect(
    () =>
      runEffectScope(async (scope) => {
        if (!loginActive) {
          return
        }
        abortIfUndefined(serverMessageBroadcastRef.current).listen(
          scope,
          (serverMessage) => {
            if (serverMessage.logInReady !== undefined) {
              const noVncUrl = serverMessage.logInReady.noVncUrl
              const debugNoVncUrl = serverMessage.logInReady.debugNoVncUrl
              updateState({
                ...stateRef.current,
                phase: {
                  kind: "loginReady",
                  value: {
                    noVncUrl,
                    debugNoVncUrl,
                  },
                },
              })
            }
            if (serverMessage.logInComplete !== undefined) {
              const loginComplete = serverMessage.logInComplete
              const succeeded = loginComplete.storage !== undefined
              if (succeeded) {
                writeSpotifyLoginStorage(storageKey, loginComplete.storage)
              }
              updateState({
                storage: succeeded
                  ? {
                      kind: "available",
                      value: {},
                    }
                  : stateRef.current.storage,
                phase: {
                  kind: "loginComplete",
                  value: {
                    succeeded,
                  },
                },
              })
            }
          }
        )
        await sleepUntilCancel(scope)
      }),
    [serverMessageBroadcastRef, loginActive, storageKey, stateRef, updateState]
  )

  return useMemo<SpotifyLoginController>(
    () => ({
      storage: dispatchOneOf(state.storage, {
        none: (x) => ({
          kind: "none",
          value: {},
        }),
        unavailable: (x) => ({
          kind: "unavailable",
          value: {},
        }),
        available: (x) => ({
          kind: "available",
          value: {
            logout,
          },
        }),
      }),
      phase: dispatchOneOf(state.phase, {
        none: (x) => ({
          kind: "none",
          value: {
            ...x,
            initiate,
          },
        }),
        loadingLogin: (x) => ({
          kind: "loadingLogin",
          value: {
            ...x,
            cancel,
          },
        }),
        loginReady: (x) => ({
          kind: "loginReady",
          value: {
            ...x,
            cancel,
          },
        }),
        loginComplete: (x) => ({
          kind: "loginComplete",
          value: {
            ...x,
            initiate,
          },
        }),
      }),
    }),
    [state, cancel, initiate, logout]
  )
}
