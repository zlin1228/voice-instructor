import { use, useEffect, useState } from "react"

import { BroadcastController, sleepUntilCancel } from "base-core/lib/scope"
import { runEffectScope } from "./hooks"

export interface UILogStyle {
  disabled: boolean
  color: string
}

export interface UILog {
  style: UILogStyle
  time: Date
  message: string
}

const uiLogBroadcast = new BroadcastController<UILog>()
const uiLogs: UILog[] = []

export function LogPanel() {
  const [logs, setLogs] = useState<UILog[]>([])
  useEffect(
    () =>
      runEffectScope(async (scope) => {
        setLogs(uiLogs)
        uiLogBroadcast.listen(scope, (log) => {
          setLogs(uiLogs)
        })
        await sleepUntilCancel(scope)
      }),
    []
  )
  return (
    <div
      style={{ display: "flex", flexDirection: "column", maxHeight: "100%" }}
    >
      <h1>Debug Log</h1>
      <ul style={{ flex: 1, overflowY: "auto" }}>
        {logs.map((log, index) => {
          const hh = log.time.getHours().toFixed(0).padStart(2, "0")
          const mm = log.time.getMinutes().toFixed(0).padStart(2, "0")
          const ss = log.time.getSeconds().toFixed(0).padStart(2, "0")
          return (
            <li
              key={index}
              style={{
                color: log.style.color,
              }}
            >
              {hh}:{mm}:{ss} {log.message}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function appendDebugLog(style: UILogStyle, message: string) {
  const uiLog: UILog = { style, time: new Date(), message }
  uiLogs.push(uiLog)
  uiLogBroadcast.emit(uiLog)
}

export function useShowDebugPanel(): boolean {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key === "F2" && window.location.hostname !== "demo.rabbit.tech") {
        setShow((show) => !show)
      }
    }
    document.addEventListener("keydown", listener)
    return () => {
      document.removeEventListener("keydown", listener)
    }
  }, [])
  return show
}
