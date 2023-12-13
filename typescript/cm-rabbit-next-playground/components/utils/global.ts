import { log } from "base-core/lib/logging.js"
import { useEffect } from "react"

let initialized = false

export function init() {
  if (initialized) return
  initialized = true
  if (window.location.hostname !== "demo.rabbit.tech") {
    log.info = console.log
  }
  //   log.registerListener((logEntity) => {
  //     logEntity.
  //   })
}

export function useInit() {
  useEffect(() => {
    init()
  }, [])
}
