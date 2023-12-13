import NoVncClient from "@novnc/novnc/core/rfb"
import { useCallback, useRef, useState } from "react"

export function NoVncPanel(props: { noVncUrl: string }) {
  const [connected, setConnected] = useState(false)
  const { noVncUrl } = props
  const clientRef = useRef<NoVncClient>()
  const divRef = useCallback(
    (div: HTMLDivElement | null) => {
      if (div === null) {
        setConnected(false)
        clientRef.current?.disconnect()
        return
      }
      const client = new NoVncClient(div, noVncUrl)
      // client.clipViewport = true
      // client.qualityLevel = 8
      client.background = "black"
      clientRef.current = client
      client.addEventListener("connect", () => {
        setConnected(true)
        client.focus()
      })
      client.addEventListener("disconnect", () => {
        setConnected(false)
      })
    },
    [noVncUrl]
  )
  return (
    <div
      ref={divRef}
      style={{
        display: connected ? undefined : "none",
        width: "100%",
        height: "100%",
      }}
    ></div>
  )
}
