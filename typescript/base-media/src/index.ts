import { log } from "base-core/lib/logging.js"
import { Scope } from "base-core/lib/scope.js"
import { runMainScope } from "base-node/lib/main-scope.js"
import { createFileReadable } from "base-node/lib/file.js"
import { readableToAsyncIterable } from "base-core/lib/stream.js"

import { DeepgramSttClient, modelNova } from "./stt-deepgram.js"

async function buildDeepgramClient(scope: Scope) {
  return await DeepgramSttClient.build(
    scope,
    "6a15981971ff56343fa2e5b4f0c8d245241ef63f"
  )
}

async function testStream(scope: Scope) {
  const deepgramSttClient = await buildDeepgramClient(scope)
  const transcriptIter = deepgramSttClient.recognizeStream(
    scope,
    readableToAsyncIterable(createFileReadable("test.mp3")),
    {
      mimeType: "audio/mp3",
      language: "en-US",
      model: modelNova,
    }
  )
  for await (const transcript of transcriptIter) {
    log.info(transcript)
  }
}

async function testRecorded(scope: Scope) {
  const deepgramSttClient = await buildDeepgramClient(scope)
  const response = await deepgramSttClient.recognizeRecorded(
    scope,
    readableToAsyncIterable(createFileReadable("test.mp3")),
    {
      mimeType: "audio/mp3",
      language: "en-US",
      model: modelNova,
    }
  )
  console.log(response)
}

async function main(scope: Scope, cancel: (error: Error) => void) {
  log.info("base-media test")

  await testStream(scope)
  // await testRecorded(scope)
}

void (async () => {
  await runMainScope(main)
  // process.exit()
})()
