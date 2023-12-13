import { createAndUploadTrainingFile, createFinetuningJob } from "./generateChatGPTData.js"
import { log } from "base-core/lib/logging.js"
import { Scope } from "base-core/lib/scope.js"


import { runMainScope } from "base-node/lib/main-scope.js"

const port = parseInt(process.env["PORT"] ?? "8080")

async function main(scope: Scope, cancel: (error: Error) => void) {
    log.info("Hi :)")
    const fileID = await createAndUploadTrainingFile()
    const jobID = await createFinetuningJob(fileID.train, fileID.valid)
}

void (async () => {
    await runMainScope(main)
    process.exit()
})()
