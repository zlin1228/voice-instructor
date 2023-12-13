import { log } from "base-core/lib/logging.js"
import { Scope } from "base-core/lib/scope.js"

// import { Room } from "./streamer/room"

import "base-node/lib/init.js"

export async function entrypoint() {
  log.info("Entrypoint enter")
  await Scope.with(undefined, [], async (scope) => {
    // const room = Room.build(scope)
    // console.log(room)
  })
  log.info("Entrypoint leave")
}
