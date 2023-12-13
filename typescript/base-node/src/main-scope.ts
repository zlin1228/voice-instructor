import process from "node:process"

import { Scope, buildAttachmentForCancellation } from "base-core/lib/scope.js"
import { log } from "base-core/lib/logging.js"

import { init } from "./init.js"

export async function runMainScope(
  body: (scope: Scope, cancel: (error: Error) => void) => Promise<void>
): Promise<void> {
  init()
  const { cancel, attachment } = buildAttachmentForCancellation(true)
  await Scope.with(undefined, [attachment], async (scope) => {
    console.log("----------------------------------------")
    console.log(`Main scope started. PID=${process.pid}`)
    console.log("----------------------------------------")
    process.once("SIGINT", () => {
      console.log()
      console.log("----------------------------------------")
      console.log("Received SIGINT, cancelling the scope")
      console.log("----------------------------------------")
      cancel(new Error("SIGINT"))
    })
    process.once("SIGTERM", () => {
      console.log("----------------------------------------")
      console.log("Received SIGTERM, cancelling the scope")
      console.log("----------------------------------------")
      cancel(new Error("SIGTERM"))
    })
    await body(scope, cancel)
    console.log("----------------------------------------")
    console.log("Main scope ran to completion")
    console.log("----------------------------------------")
  })
}
