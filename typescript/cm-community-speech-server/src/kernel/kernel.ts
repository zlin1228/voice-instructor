import { log } from "base-core/lib/logging.js"
import { OneOf } from "base-core/lib/one-of.js"
import {
  Scope,
  launchBackgroundScope,
  ScopeAttachment,
  HandlingQueue,
} from "base-core/lib/scope.js"
import { buildPromise, flyingPromise } from "base-core/lib/utils.js"
import {
  googleSpeechStream,
  googleSpeechStreamIterateResult,
} from "./stt-google.js"
import { ModelClient } from "../model.js"
import { elevenlabsTextToSpeech } from "./tts-elevenlabs.js"
import { azureTextToSpeech } from "./tts-azure.js"
import {
  CmClientMessage,
  CmServerMessage,
} from "../schema/schema.js"
import {
  sleepSeconds,
  TimeoutError,
  checkAndGetCancelToken,
} from "base-core/lib/scope.js"
import Pumpify from "pumpify"
import fs from "fs"
import ffmpeg from "fluent-ffmpeg"
import { Readable, PassThrough } from "stream"
import { v4 as uuidv4 } from 'uuid';

export async function* handleKernelSimplified(
  scope: Scope,
  requestIter: AsyncIterable<
    OneOf<{ json: CmClientMessage; binary: Uint8Array }>
  >
): AsyncGenerator<
  OneOf<{
    json: CmServerMessage
    binary: Uint8Array
  }>
> { }

interface VoiceChunk {
  audio: string
  utterance: string
  duration: number
  worldId: string
  npcId: string
  visemeAudioOffsets: number[]
  visemeIds: string[]
}

export class Kernel {
  readonly #scope: Scope
  readonly #serverMessageQueue: HandlingQueue<
    OneOf<{
      json: CmServerMessage
      binary: Uint8Array
    }>
  >
  readonly #modelClient: ModelClient
  #speechStream: Pumpify | null
  #userId: string
  #language: string = "en"
  #mimeType: string = "wav"
  #hostIp: string
  #timeZone: string
  #iteration: number
  #messagePushQueue: OneOf<{
    json: CmServerMessage
    binary: Uint8Array
  }>[]
  #audioPushQueue: VoiceChunk[]
  #pushingPromise = buildPromise()
  #done: boolean
  #listening: boolean
  #key: string

  private constructor(
    scope: Scope,
    serverMessageQueue: HandlingQueue<
      OneOf<{
        json: CmServerMessage
        binary: Uint8Array
      }>
    >,
    modelClient: ModelClient,
    iteration: number,
  ) {
    this.#scope = scope
    this.#serverMessageQueue = serverMessageQueue
    this.#modelClient = modelClient
    this.#speechStream = null
    this.#userId = ""
    this.#language = ""
    this.#mimeType = ""
    this.#hostIp = ""
    this.#timeZone = ""
    this.#iteration = iteration
    this.#key = ""

    this.#messagePushQueue = []
    this.#audioPushQueue = []
    this.#pushingPromise = buildPromise()
    const cancelToken = checkAndGetCancelToken(scope)
    cancelToken.onCancel(async () => {
      this.#done = true
      this.#pushingPromise.resolve()
      this.#pushingPromise = buildPromise()
    })
    this.#done = false
    this.#listening = true

    launchBackgroundScope(scope, async (scope) => {
      try {
        const cancelToken = checkAndGetCancelToken(scope)
        while (cancelToken.cancelReason === undefined) {
          const data = this.#messagePushQueue.shift()
          if (data === undefined) {
            await this.#pushingPromise.promise
            if (this.#done) return
          } else {
            if (data.kind === "json") {
              log.info(`Sending websocket data: ${JSON.stringify(data.value)}`)
              this.#serverMessageQueue.pushBack({
                kind: "json",
                value: data.value,
              })
            } else {
              log.info(`Sending websocket data: ${data.value.byteLength}`)
              this.#serverMessageQueue.pushBack({
                kind: "binary",
                value: data.value,
              })
            }
          }
        }
      } catch (e) {
        log.info(`pushResponse failed: [${String(e)}]`)
        // TODO: Cancel the outer scope
      }
    })
    launchBackgroundScope(scope, async (scope) => {
      try {
        const cancelToken = checkAndGetCancelToken(scope)
        while (cancelToken.cancelReason === undefined) {
          const data = this.#audioPushQueue.shift()
          if (data === undefined) {
            await this.#pushingPromise.promise
            if (this.#done) return
          } else {
            log.info(`Sending audio data: ${data.duration}`)
            this.#serverMessageQueue.pushBack({
              kind: "json",
              value: {
                kernel: {
                  utterance: data.utterance,
                  audio: data.audio,
                  duration: data.duration,
                  worldId: data.worldId,
                  npcId: data.npcId,
                  visemeAudioOffsets: data.visemeAudioOffsets,
                  visemeIds: data.visemeIds,
                },
              },
            })
            await sleepSeconds(scope, data.duration / 10000000)
          }
        }
      } catch (e) {
        log.info(`pushResponse failed: [${String(e)}]`)
        // TODO: Cancel the outer scope
      }
    })
  }

  setUserId(userId: string): void {
    this.#userId = userId
  }

  setLanguage(language: string): void {
    this.#language = language
  }

  setMimeType(mimeType: string): void {
    this.#mimeType = mimeType
  }

  setHostIp(hostIp: string): void {
    this.#hostIp = hostIp
  }

  setTimeZone(timeZone: string): void {
    this.#timeZone = timeZone
  }

  setKey(key: string): void {
    this.#key = key
  }

  startListening(): void {
    this.#listening = true
  }

  stopListening(): void {
    this.#listening = false
  }

  getListening(): boolean {
    return this.#listening
  }

  getUser(): string {
    return this.#userId
  }

  destroy(): void {
    this.#done = true
  }

  static async build(
    scope: Scope,
    serverMessageQueue: HandlingQueue<
      OneOf<{
        json: CmServerMessage
        binary: Uint8Array
      }>
    >,
    modelClient: ModelClient,
    iteration: number,
  ): Promise<Kernel> {
    return new Kernel(
      scope,
      serverMessageQueue,
      modelClient,
      iteration,
    )
  }

  async launch(scope: Scope, greet: boolean): Promise<void> {
    console.log("Launching kernel...", greet)

    launchBackgroundScope(scope, async (scope) => {
      console.log("Watching for speech output...")
      const speechOutputChangeStream = this.#modelClient.speechOutputCollection.findAndWatch(
        scope,
        (pipeline) => pipeline
      )
      for await (const speechOutputChange of speechOutputChangeStream) {
        if (speechOutputChange.kind === "create") {
          const speechOutput = speechOutputChange.value
          const key = speechOutput.key
          if (key !== this.#key) {
            console.log("Speech output key does not match, skipping...")
            continue
          } else {
            console.log("Speech output key matches, processing...")
            const chatPiece = speechOutput.content
            const characterVoiceId = speechOutput.speechProfile.voiceId
            const speechProvider = speechOutput.speechProfile.provider
            var responseAudio;
            if (speechProvider !== "elevenlabs") {
              console.log("Using Azure TTS...")
              responseAudio = await azureTextToSpeech(
                scope,
                chatPiece,
                this.#language,
                characterVoiceId
              )
            } else {
              console.log("Using Elevenlabs TTS...")
              responseAudio = await elevenlabsTextToSpeech(
                scope,
                chatPiece,
                this.#language,
                characterVoiceId
              )
            }
            this.#audioPushQueue = [
              ...this.#audioPushQueue,
              {
                utterance: chatPiece,
                duration: responseAudio.duration,
                audio: responseAudio.data,
                worldId: speechOutput.speechProfile.worldId,
                npcId: speechOutput.speechProfile.npcId,
                visemeAudioOffsets: responseAudio.visemeAudioOffsets,
                visemeIds: responseAudio.visemeIds,
              },
            ]
            this.#pushingPromise.resolve()
            this.#pushingPromise = buildPromise()
          }
        }
      }
    })

    try {
      const speechStream = googleSpeechStream(this.#language, this.#mimeType)

      const cancelToken = checkAndGetCancelToken(scope)
      cancelToken.onCancel(async () => {
        speechStream.end()
        speechStream.destroy()
        console.log("Canceling speechStream...")
      })

      this.#speechStream = speechStream

      let speechId = 0
      let speechFinalized = true
      let recognizationId = -1
      let lastRecognizedFragmentText = ""
      let lastRecognizedFragmentTime = Date.now() - 1000
      let finalizedTime = 0
      let speechFinalizePromise = buildPromise<number>()
      let done = false

      try {
        for await (const sttRecognizedFragment of googleSpeechStreamIterateResult(
          speechStream
        )) {
          if (speechFinalized) {
            speechFinalized = false
            ++speechId
            recognizationId = -1
          }
          const finalized = sttRecognizedFragment.final
          const textChanged =
            sttRecognizedFragment.text !== lastRecognizedFragmentText
          const requestText = sttRecognizedFragment.text
          if (
            !finalized &&
            (!textChanged ||
              sttRecognizedFragment.text.trim().split(" ").length <= 2)
          ) {
            continue
          }
          const now = Date.now()
          if (textChanged) {
            lastRecognizedFragmentText = sttRecognizedFragment.text
            lastRecognizedFragmentTime = now
            ++recognizationId
          }
          log.info(
            `Human${finalized ? "*" : ""
            }: [${speechId}/${recognizationId}:${now}] ${requestText}`
          )

          this.#messagePushQueue = [
            {
              kind: "json",
              value: finalized
                ? {
                  speechRecognized: {
                    speechId,
                    recognizationId,
                    text: requestText,
                  },
                }
                : {
                  speechRecognizing: {
                    speechId,
                    recognizationId,
                    text: requestText,
                  },
                },
            },
            ...(textChanged ? [] : this.#messagePushQueue),
          ]
          this.#pushingPromise.resolve()
          this.#pushingPromise = buildPromise()
          if (!finalized) {
            this.#audioPushQueue = []
          }
          console.log("Confidence: ", sttRecognizedFragment.confidence)

          const characterVoiceId = "zh-CN-YunxiNeural";
          const chatPiece = requestText

          if (finalized && requestText.trim().length > 1 && sttRecognizedFragment.confidence !== undefined && sttRecognizedFragment.confidence > 0.5) {
            try {

              if (this.#key === "") {
                console.log("Echo mode, directly returning the voice...")
                const responseAudio = await azureTextToSpeech(
                  scope,
                  chatPiece,
                  this.#language,
                  characterVoiceId
                )
                this.#audioPushQueue = [
                  ...this.#audioPushQueue,
                  {
                    utterance: chatPiece,
                    duration: responseAudio.duration,
                    audio: responseAudio.data,
                    worldId: "worldId",
                    npcId: "npcId",
                    visemeAudioOffsets: responseAudio.visemeAudioOffsets,
                    visemeIds: responseAudio.visemeIds,
                  },
                ]
                this.#pushingPromise.resolve()
                this.#pushingPromise = buildPromise()

              } else {
                const utterance = requestText

                var speechInputDoc = {
                  _id: uuidv4(),
                  key: this.#key,
                  time: new Date(),
                  content: utterance
                }

                console.log("Saving speech input to database...", this.#key)
                await this.#modelClient.speechInputCollection.createIfNotExists(scope, speechInputDoc);

                // testing script
                /*
                console.log("Testing... Writing to speechOutputCollection...")
                var speechOutputDoc = {
                  _id: uuidv4(),
                  time: new Date(),
                  key: this.#key,
                  content: utterance,
                  speechProfile: {
                    provider: "azure",
                    voiceId: "zh-CN-YunxiNeural"
                    worldId: "worldId",
                    npcId: "npcId",
                  }
                }
                await this.#modelClient.speechOutputCollection.createIfNotExists(scope, speechOutputDoc);

                console.log("Testing... Writing irrelevant key to speechOutputCollection...")
                var speechOutputDoc = {
                  _id: uuidv4(),
                  time: new Date(),
                  key: uuidv4(),
                  content: utterance,
                  speechProfile: {
                    provider: "elevenlabs",
                    voiceId: characterVoiceId,
                    worldId: "worldId",
                    npcId: "npcId",
                  }
                }
                await this.#modelClient.speechOutputCollection.createIfNotExists(scope, speechOutputDoc);
                */
              }
              
            } catch (e) {
              log.info(`streamingConversation failed: [${String(e)}]`)
            }
          }
          if (finalized) {
            finalizedTime = now
            speechFinalizePromise.resolve(recognizationId)
            speechFinalizePromise = buildPromise()
            lastRecognizedFragmentText = ""
            lastRecognizedFragmentTime = Date.now()
          }
          speechFinalized = finalized
        }
      } finally {
        console.log("speechStreamIterateResult done.")
        done = true
      }
    } catch (e) {
      log.info(`handleKernel failed: [${String(e)}]`)
      console.log(e)
    }
    console.log("Kernel launch complete.")
  }

  async handleAudioMessage(audio: string, scope: Scope): Promise<void> {
    console.log("handleAudioMessage")
    // decode audio from base64
    const data = Buffer.from(audio, 'base64');

    function convert_to_raw(data: Uint8Array) {
      return new Promise((resolve, reject) => {
        try {
          const inputBufferStream = new Readable()
          inputBufferStream.push(data)
          inputBufferStream.push(null)

          const outputBufferStream = new PassThrough()

          let outputData = Buffer.alloc(0)

          outputBufferStream.on("data", (chunk) => {
            outputData = Buffer.concat([outputData, chunk])
          })

          outputBufferStream.on("end", () => {
            resolve(new Uint8Array(outputData))
          })

          ffmpeg(inputBufferStream)
            .inputFormat("wav")
            .audioFrequency(16000)
            .audioChannels(1)
            .outputFormat("s16le")
            .on("error", (err) => {
              console.error(err)
              reject(data)
            })
            .pipe(outputBufferStream)
        } catch (e) {
          console.error(e)
          reject(data)
        }
      })
    }
    const rawData = await convert_to_raw(data)
    this.#speechStream?.write(rawData)
  }
}
