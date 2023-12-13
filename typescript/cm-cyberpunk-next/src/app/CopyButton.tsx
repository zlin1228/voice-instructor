"use client"

import React, { useEffect, useState } from "react"

export function CopyButton(props: { content: string }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setTimeout(() => {
      if (copied) {
        setCopied(false)
      }
    }, 2000)
  })

  return (
    <button
      style={
        copied
          ? {
              background:
                "linear-gradient(-135deg, transparent 5px, #00c1e0 0)",
              color: "#040a0b",
              padding: "5px",
              marginRight: "10px",
              width: "70px",
            }
          : {
              background:
                "linear-gradient(-135deg, transparent 5px, #040a0b 0)",
              color: "#00c1e0",
              padding: "5px",
              marginRight: "10px",
              width: "70px",
            }
      }
      onClick={(e) => {
        e.preventDefault()
        navigator.clipboard.writeText(props.content)
        setCopied(!copied)
      }}
    >
      {copied ? "COPIED" : "COPY"}
    </button>
  )
}
