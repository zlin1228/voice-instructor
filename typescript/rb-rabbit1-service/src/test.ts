import { Scope, runParallelScopes } from "base-core/lib/scope.js"
import { runMainScope } from "base-node/lib/main-scope.js"
import { buildRandomStringId } from "base-mongodb/lib/mongodb.js"
import { log } from "base-core/lib/logging.js"
import { arrayRepeat } from "base-core/lib/array.js"
import { buildDefaultProfile } from "./profile.js"

async function main(scope: Scope, cancel: (error: Error) => void) {
  const profile = await buildDefaultProfile(scope)
  const response = await profile.service.post_test(scope, {
    requestData: "hello",
  })
  console.log(response)
}

void (async () => {
  await runMainScope(main)
  // process.exit()
})()
