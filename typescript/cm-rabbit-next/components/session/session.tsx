import { useState, useRef, useEffect } from "react"

import { useAuth, useClerk } from "@clerk/nextjs"

import { OneOf } from "base-core/lib/one-of.js"
import {
  Broadcast,
  BroadcastController,
  buildAttachmentForCancellation,
  Scope,
} from "base-core/lib/scope.js"
import { flyingPromise } from "base-core/lib/utils.js"
import {
  Os2ClientMessage,
  os2ClientMessageType,
  Os2ServerMessage,
  os2ServerMessageType,
} from "cm-rabbit-common/lib/schema/schema.js"
import { Os2ServerMessageGlobal } from "cm-rabbit-common/lib/session/session-global.js"

import { connectWebSocket } from "./websocket"
import JsonDisplay from "../JsonDisplay"
import { ControllerHandle, useControllerState } from "../utils/controller"
import { useDebugValueHas } from "../utils/hooks"

export interface SessionController {
  phase: OneOf<{
    none: {
      connect: (token: string, listening: boolean) => void
    }
    connecting: {
      disconnect: () => void
    }
    connected: {
      pushClientMessage: (
        clientMessage: OneOf<{
          json: Os2ClientMessage
          binary: Uint8Array | Blob
        }>
      ) => void
      serverMessageBroadcast: Broadcast<
        OneOf<{ json: Os2ServerMessage; binary: Uint8Array }>
      >
      disconnect: () => void
    }
  }>
  // How much the client's clock is ahead of the server's clock
  timeOffsetSeconds: number
}
export function useSessionController(
  webSocketAddress: string,
  language: string = "en",
  mimeType: string = "opus"
): SessionController {
  const enableBinaryMessageLogging = useDebugValueHas("log-binary")
  const handleGlobalMessage = (global: Os2ServerMessageGlobal) => {
    if (global.initialize !== undefined) {
      const initialize = global.initialize
      updateState({
        ...stateRef.current,
        timeOffsetSeconds:
          (Date.now() - initialize.currentTime.getTime()) / 1000,
      })
    }
  }
  const connect = (token: string, listening: boolean) => {
    updateState({
      ...stateRef.current,
      phase: {
        kind: "connecting",
        value: {
          disconnect,
        },
      },
    })
    const { cancel, attachment } = buildAttachmentForCancellation(true)
    cancelRef.current = cancel
    flyingPromise(async () => {
      try {
        await Scope.with(undefined, [attachment], async (scope) => {
          // handle complete
          await connectWebSocket(
            scope,
            webSocketAddress,
            os2ClientMessageType,
            os2ServerMessageType,
            enableBinaryMessageLogging,
            async (scope, serverMessageIter, clientMessageQueue) => {
              const serverMessageBroadcast = new BroadcastController<
                OneOf<{ json: Os2ServerMessage; binary: Uint8Array }>
              >()
              updateState({
                ...stateRef.current,
                phase: {
                  kind: "connected",
                  value: {
                    pushClientMessage: (clientMessage) => {
                      clientMessageQueue.pushBack(clientMessage)
                    },
                    serverMessageBroadcast,
                    disconnect,
                  },
                },
              })
              var timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
              if (timeZone === undefined) {
                console.log("WARNING: unrecognized timezone");
                let offset = new Date().getTimezoneOffset();

                let sign = offset < 0 ? "+" : "-";
                let hours = Math.abs(Math.floor(offset / 60));
                let minutes = Math.abs(offset % 60);

                timeZone = `UTC${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
              }
              
              clientMessageQueue.pushBack({
                kind: "json",
                value: {
                  global: {
                    initialize: {
                      token,
                      language: language,
                      mimeType: mimeType,
                      greet: true,
                      timeZone: timeZone,
                      listening: listening,
                      evaluate: false,
                    },
                  },
                },
              })
              for await (const serverMessage of serverMessageIter) {
                if (serverMessage.kind === "json") {
                  if (serverMessage.value.global !== undefined) {
                    handleGlobalMessage(serverMessage.value.global)
                  }
                }
                serverMessageBroadcast.emit(serverMessage)
              }
            }
          )
        })
      } finally {
        if (
          stateRef.current.phase.kind === "connected" ||
          stateRef.current.phase.kind === "connecting"
        ) {
          updateState({
            ...stateRef.current,
            phase: {
              kind: "none",
              value: {
                connect,
              },
            },
          })
        }
      }
    })
  }
  const disconnect = () => {
    cancelRef.current?.(new Error("Session controller disconnected"))
    updateState({
      ...stateRef.current,
      phase: {
        kind: "none",
        value: {
          connect,
        },
      },
    })
  }
  const { state, updateState, stateRef } =
    useControllerState<SessionController>({
      phase: {
        kind: "none",
        value: {
          connect,
        },
      },
      timeOffsetSeconds: 0,
    })

  const cancelRef = useRef<(reason: Error) => void>()

  return state
}

export function SessionDebugPanel(props: { controller: SessionController }) {
  const { getToken } = useAuth()
  const clerk = useClerk()

  const [token, setToken] = useState<string | undefined>()
  const { controller } = props
  const connect =
    controller.phase.kind === "none" && token !== undefined
      ? controller.phase.value.connect
      : undefined
  const disconnect =
    controller.phase.kind !== "none"
      ? controller.phase.value.disconnect
      : undefined

  useEffect(() => {
    flyingPromise(async () => {
      const token = await getToken()
      setToken(token ?? undefined)
    })
  }, [getToken])

  return (
    <div>
      <div>
        {token === undefined && (
          <div>
            Not logged in
            <button
              onClick={() => {
                clerk.redirectToSignIn()
              }}
            >
              Log in
            </button>
          </div>
        )}
        <button
          onClick={() => token !== undefined && connect?.(token, true)}
          disabled={connect === undefined || token === undefined}
        >
          Connect
        </button>
        <button
          onClick={() => disconnect?.()}
          disabled={disconnect === undefined}
        >
          Disconnect
        </button>
      </div>
      <div>
        <JsonDisplay value={controller} />
      </div>
    </div>
  )
}
