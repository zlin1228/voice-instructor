import { log } from "base-core/lib/logging.js"
import { OneOf } from "base-core/lib/one-of.js"
import {
  Scope,
  launchBackgroundScope,
  ScopeAttachment,
  HandlingQueue,
} from "base-core/lib/scope.js"
import { buildPromise, flyingPromise } from "base-core/lib/utils.js"
import { chatFragmentIterToChatPieceIter, ChatMessage } from "./chat.js"
import {
  streamingConversation,
  streamingProactiveConversation,
} from "./conversation.js"
import { openAiCompleteChatNonStreaming } from "./openai.js"
import {
  googleSpeechStream,
  googleSpeechStreamIterateResult,
} from "./stt-google.js"
import { ModelClient } from "../model.js"
import { elevenlabsTextToSpeech } from "./tts-elevenlabs.js"
import {
  Os2ClientMessage,
  Os2ServerMessage,
} from "cm-cyberpunk-common/lib/schema/schema.js"
import Deepgram from "@deepgram/sdk"
import {
  sleepSeconds,
  TimeoutError,
  checkAndGetCancelToken,
} from "base-core/lib/scope.js"
import Pumpify from "pumpify"
import fs from "fs"
import ffmpeg from "fluent-ffmpeg"
import { Readable, PassThrough } from "stream"

import { performance } from 'perf_hooks';
import { hi } from "date-fns/locale"

class DecayingCounter {
  private counts: { [key: string]: number };
  private decayRate: number;
  private lastUpdate: number;

  constructor(decayRate: number) {
    this.counts = {};
    this.decayRate = decayRate;
    this.lastUpdate = performance.now();
  }

  increment(value: string): void {
    this.decayCounts();
    if (!(value in this.counts)) {
      this.counts[value] = 0;
    }
    this.counts[value]++;
  }

  private decayCounts(): void {
    const currentTime = performance.now();
    const elapsedTime = currentTime - this.lastUpdate;
    const decayFactor = Math.exp(-this.decayRate * elapsedTime);

    for (const value in this.counts) {
      this.counts[value] *= decayFactor;
    }

    this.lastUpdate = currentTime;
  }

  maxCount(): [string, number] | null {
    this.decayCounts();
    if (Object.keys(this.counts).length === 0) {
      return null;
    }
    // @ts-ignore
    const maxKey = Object.keys(this.counts).reduce((a, b) => this.counts[a] > this.counts[b] ? a : b);
    // @ts-ignore
    return [maxKey, this.counts[maxKey]];
  }
}

function formatDbMessage(speaker: string, message: string): string {
  const formattedTime = new Date().toUTCString()
  return `${speaker}:${message}[${formattedTime}]`
}

export async function* handleKernelSimplified(
  scope: Scope,
  requestIter: AsyncIterable<
    OneOf<{ json: Os2ClientMessage; binary: Uint8Array }>
  >
): AsyncGenerator<
  OneOf<{
    json: Os2ServerMessage
    binary: Uint8Array
  }>
> { }

interface VoiceChunk {
  audio: string
  utterance: string
  duration: number
}

export class Kernel {
  readonly #scope: Scope
  readonly #serverMessageQueue: HandlingQueue<
    OneOf<{
      json: Os2ServerMessage
      binary: Uint8Array
    }>
  >
  readonly #modelClient: ModelClient
  #speechStream: any
  #userId: string
  #language: string = "en"
  #mimeType: string = "wav"
  #hostIp: string
  #timeZone: string
  #iteration: number
  #messagePushQueue: OneOf<{
    json: Os2ServerMessage
    binary: Uint8Array
  }>[]
  #audioPushQueue: VoiceChunk[]
  #pushingPromise = buildPromise()
  #done: boolean
  #musicPlaying: boolean
  #listening: boolean
  #decayCounter: DecayingCounter

  private constructor(
    scope: Scope,
    serverMessageQueue: HandlingQueue<
      OneOf<{
        json: Os2ServerMessage
        binary: Uint8Array
      }>
    >,
    modelClient: ModelClient,
    iteration: number,
    musicPlaying: boolean
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
    this.#musicPlaying = musicPlaying
    this.#listening = true
    this.#decayCounter = new DecayingCounter(0.5)

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
                  assistantResponse: data.utterance,
                  audio: data.audio,
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

  getMusicPlaying(): boolean {
    return this.#musicPlaying
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
        json: Os2ServerMessage
        binary: Uint8Array
      }>
    >,
    modelClient: ModelClient,
    iteration: number,
    musicPlaying: boolean
  ): Promise<Kernel> {
    return new Kernel(
      scope,
      serverMessageQueue,
      modelClient,
      iteration,
      musicPlaying
    )
  }

  async handleRecognizedText(scope: Scope, requestText: string, confidence: number): Promise<void> {
    try {
      log.info(
        `Human: ${requestText}`
      )
      // get max count
      const [character, maxCount] = this.#decayCounter.maxCount() ?? ["_", 0];
      // split maxKey into character and uuid by _
      console.log("maxCount: ", maxCount, "character: ", character);

      // get character from characterStorageCollection
      var characterDoc = await this.#modelClient.characterStorageCollection.getById(scope, character);
      // if doc is empty, choose a random character from characterBankCollection that is not 'selected'
      if (characterDoc === undefined) {
        console.log("characterDoc is undefined. Generating a new one.")
        // determine classification (masculine or feminine or neutral)
        const classificationMessages = [
          { role: "user", content: `Classify the following name into masculine, feminine, or neutral. Only output one of the three strings. ${character}` },
        ]
        var resp = (await openAiCompleteChatNonStreaming(classificationMessages, 0.0, "gpt-3.5-turbo-16k")).trim();
        var classification = resp === "masculine" ? "masculine" : resp === "feminine" ? "feminine" : "neutral";
        console.log("classification: ", classification);

        var bankDoc = await this.#modelClient.characterBankCollection.findOne(scope, { selected: false, classification: classification });
        console.log("bankDoc: ", bankDoc)
        if (bankDoc === undefined) {
          console.log("Every character is selected. Repetition is allowed.");
          bankDoc = await this.#modelClient.characterBankCollection.findOne(scope, { classification: classification });
        }

        var voiceBankDoc = await this.#modelClient.voiceBankCollection.findOne(scope, { selected: false, classification: classification });
        console.log("voiceBankDoc: ", voiceBankDoc)
        if (voiceBankDoc === undefined) {
          console.log("Every voice is selected. Repetition is allowed.");
          voiceBankDoc = await this.#modelClient.voiceBankCollection.findOne(scope, { classification: classification });
        }

        if (bankDoc === undefined || voiceBankDoc === undefined) {
          console.log("Something is wrong.", bankDoc, voiceBankDoc);
        } else {

          // update characterBankCollection
          var bankDoc_ = {
            _id: bankDoc._id,
            selected: true,
          }

          // update voiceBankCollection
          var voiceBankDoc_ = {
            _id: voiceBankDoc._id,
            selected: true,
          }

          await this.#modelClient.characterBankCollection.bulkMergeFields(scope, [bankDoc_]);
          await this.#modelClient.voiceBankCollection.bulkMergeFields(scope, [voiceBankDoc_]);

          // update characterStorageCollection
          var characterDoc_ = {
            _id: character,
            classification: classification,
            name: bankDoc.name,
            description: bankDoc.description,
            voice_id: voiceBankDoc.voice_id,
          }
          await this.#modelClient.characterStorageCollection.createIfNotExists(scope, characterDoc_);
          // update characterDoc
          characterDoc = characterDoc_;
        }

      } else {
        if (confidence !== undefined && confidence > 0.8) {
          console.log("characterDoc is defined. Using it: ", characterDoc);
        }
      }

      // get character name and description
      const characterName = characterDoc?.name ?? "K";
      const characterId = characterDoc?._id ?? "K";
      const characterDescription = characterDoc?.description ?? "Resident of Night City";
      const characterVoiceId = characterDoc?.voice_id ?? "1oyaCI6ZhojlfCyULTn1";

      console.log("Confidence: ", confidence)
      if (requestText.trim().length > 1 && confidence !== undefined && confidence > 0.8) {
        const userDoc = await this.#modelClient.userStorageCollections
          .get(this.#language)
          ?.getById(scope, this.#userId)
        if (userDoc === undefined) {
          console.log("Creating new user doc...")
          await this.#modelClient.userStorageCollections
            .get(this.#language)
            ?.createIfNotExists(scope, {
              _id: this.#userId,
              conversation_context: [],
              history: [],
              conversation_summary: "",
              last_summarized_length: 0,
              listening: true,
              user_name: "V",
              search_config: {
                location: "United States",
                hl: "en",
                google_domain: "google.com",
              },
            })
        }
        const userName = userDoc?.user_name ?? "V"
        const userMessage = formatDbMessage(userName, requestText)

        const userState = ""

        launchBackgroundScope(scope, async (scope) => {
          try {
            let chatFragmentTime = 0
            let chatPieceTime = 0
            let audioChunkTime = 0
            let audioResponseTime = 0
            let assistantResponse = ""
            let hardFilter = true
            const language = this.#language
            for await (var chatPiece of chatFragmentIterToChatPieceIter(
              (async function* () {
                for await (const chatFragment of streamingConversation(
                  userMessage,
                  language,
                  userDoc,
                  characterName,
                  characterDescription,
                  userState,
                  characterId,
                  71
                )) {
                  yield chatFragment
                }
              })()
            )) {
              if (chatPieceTime === 0) {
                chatPieceTime = Date.now()
              }
              //if (Math.random() > 0.2) {
              //  chatPiece = chatPiece.replace(userName, " ")
              //}
              log.info(`AI: ${chatPiece}`)
              hardFilter =
                hardFilter &&
                !chatPiece.trim().toLowerCase().includes("is there s") &&
                !chatPiece.trim().toLowerCase().includes("is there an") &&
                !chatPiece.trim().toLowerCase().includes("我为您做些什么")
              if (hardFilter) {
                assistantResponse += chatPiece
                if (chatPiece.trim().length > 5) {
                  const responseAudio = await elevenlabsTextToSpeech(
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
                    },
                  ]
                  this.#pushingPromise.resolve()
                  this.#pushingPromise = buildPromise()
                }
              } else {
                break
              }
            }


            if (userDoc != undefined) {
              var history = [...userDoc.history] ?? []
              /*
              {
                name: "history", type: arrayType(
                  objectType([
                    { name: "character", type: stringType },
                    { name: "conversation", type: arrayType(stringType) },
                  ] as const)
                )
              },
              */
              const characterMessage = formatDbMessage(characterName, assistantResponse);
              this.#messagePushQueue = [
                {
                  kind: "json",
                  value: {
                    kernel: {
                      assistantResponseFinalized: assistantResponse,
                    },
                  },
                },
                ...this.#messagePushQueue,
              ]
              this.#pushingPromise.resolve()
              this.#pushingPromise = buildPromise()

              // search for history that matches characterId
              const characterHistoryExists = history.some((history) => history.character === characterId);
              if (characterHistoryExists) {
                // if history exists, append assistantResponse to conversation in exustingHistory
                history = history.map((history) => {
                  if (history.character === characterId) {
                    return {
                      ...history,
                      conversation: [...history.conversation, userMessage,
                        characterMessage],
                    }
                  }
                  return history
                })
              } else {
                // if history does not exist, create a new history object and append to existingHistory
                const newHistoryItem = {
                  character: characterId,
                  conversation: [userMessage,
                    formatDbMessage(characterName, assistantResponse)],
                }
                history.push(newHistoryItem)
              }

              // bulkMergeFields
              const userDoc_ = {
                _id: userDoc._id,
                history: history,
              }
              await this.#modelClient.userStorageCollections
                .get(this.#language)
                ?.bulkMergeFields(scope, [userDoc_])

            }

          } catch (e) {
            log.info(`streamingConversation failed: [${String(e)}]`)
          }
        })
      }
    } catch (e) {
      log.info(`handleKernel failed: [${String(e)}]`)
      console.log(e)
    }
  }

  async launch(scope: Scope, greet: boolean): Promise<void> {
    console.log("Launching kernel audio handler...")

    await Scope.with(undefined, [], async (scope) => {
      try {
        const deepgram = new Deepgram.Deepgram(
          "3b9218a28dbe170e3a655d7082b53869889ae18a"
        )
        const speechStream: any = deepgram.transcription.live({
          punctuate: true,
          interim_results: false,
          language: "en-US",
          model: "nova-2-ea",
          encoding: "linear16",
          sample_rate: 16000,
          smart_format: true,
          endpointing: 1000,
        })
        var done = false

        await sleepSeconds(scope, 0.1)

        speechStream.addListener("transcriptReceived", async (message: any) => {
          const data = JSON.parse(message)
          try {
            const requestText = data.channel.alternatives[0].transcript
            const confidence = data.channel.alternatives[0].confidence
            if (confidence > 0 && requestText.trim().length > 0) {
              console.log(
                "Handling audio message: ",
                requestText,
                "confidence: ",
                confidence
              )
              await this.handleRecognizedText(scope, requestText, confidence)
            }
          } catch (e) {
            // console.log("ERROR: ", e)
          }
        })

        speechStream.addListener("error", (error: any) => {
          console.log("STT: ERROR", error)
          done = true
        })

        speechStream.addListener("close", () => {
          console.log("STT: CLOSE")
          done = true
        })

        this.#speechStream = speechStream
        while (!done && this.#listening) {
          await sleepSeconds(scope, 0.1)
        }
      } catch (e) {
        console.log("launchAudioHandler ERROR: ", e)
      }
    })

    console.log("Kernel audio handler done.")
  }


  async handleTextMessage(requestText: string, character: string, scope: Scope): Promise<void> {
    console.log("Handling text message...", requestText, "character: ", character);

    // get character from characterStorageCollection
    var characterDoc = await this.#modelClient.characterStorageCollection.getById(scope, character);
    // if doc is empty, choose a random character from characterBankCollection that is not 'selected'
    if (characterDoc === undefined) {
      console.log("characterDoc is undefined. Generating a new one.")
      // determine classification (masculine or feminine or neutral)
      const classificationMessages = [
        { role: "user", content: `Classify the following name into masculine, feminine, or neutral. Only output one of the three strings. ${character}` },
      ]
      var resp = (await openAiCompleteChatNonStreaming(classificationMessages, 0.0, "gpt-3.5-turbo-16k")).trim();
      var classification = resp === "masculine" ? "masculine" : resp === "feminine" ? "feminine" : "neutral";
      console.log("classification: ", classification);

      var bankDoc = await this.#modelClient.characterBankCollection.findOne(scope, { selected: false, classification: classification });
      console.log("bankDoc: ", bankDoc)
      if (bankDoc === undefined) {
        console.log("Every character is selected. Repetition is allowed.");
        bankDoc = await this.#modelClient.characterBankCollection.findOne(scope, { classification: classification });
      }

      var voiceBankDoc = await this.#modelClient.voiceBankCollection.findOne(scope, { selected: false, classification: classification });
      console.log("voiceBankDoc: ", voiceBankDoc)
      if (voiceBankDoc === undefined) {
        console.log("Every voice is selected. Repetition is allowed.");
        voiceBankDoc = await this.#modelClient.voiceBankCollection.findOne(scope, { classification: classification });
      }

      if (bankDoc === undefined || voiceBankDoc === undefined) {
        console.log("Something is wrong.", bankDoc, voiceBankDoc);
      } else {

        // update characterBankCollection
        var bankDoc_ = {
          _id: bankDoc._id,
          selected: true,
        }

        // update voiceBankCollection
        var voiceBankDoc_ = {
          _id: voiceBankDoc._id,
          selected: true,
        }

        await this.#modelClient.characterBankCollection.bulkMergeFields(scope, [bankDoc_]);
        await this.#modelClient.voiceBankCollection.bulkMergeFields(scope, [voiceBankDoc_]);

        // update characterStorageCollection
        var characterDoc_ = {
          _id: character,
          classification: classification,
          name: bankDoc.name,
          description: bankDoc.description,
          voice_id: voiceBankDoc.voice_id,
        }
        await this.#modelClient.characterStorageCollection.createIfNotExists(scope, characterDoc_);
        // update characterDoc
        characterDoc = characterDoc_;
      }

    } else {
      console.log("characterDoc is defined. Using it: ", characterDoc);
    }

    // get character name and description
    const characterName = characterDoc?.name ?? "K";
    const characterId = characterDoc?._id ?? "K";
    const characterDescription = characterDoc?.description ?? "Resident of Night City";
    const characterVoiceId = characterDoc?.voice_id ?? "1oyaCI6ZhojlfCyULTn1";

    if (requestText.trim().length > 1) {
      const userDoc = await this.#modelClient.userStorageCollections
        .get(this.#language)
        ?.getById(scope, this.#userId)
      if (userDoc === undefined) {
        console.log("Creating new user doc...")
        await this.#modelClient.userStorageCollections
          .get(this.#language)
          ?.createIfNotExists(scope, {
            _id: this.#userId,
            conversation_context: [],
            history: [],
            conversation_summary: "",
            last_summarized_length: 0,
            listening: true,
            user_name: "V",
            search_config: {
              location: "United States",
              hl: "en",
              google_domain: "google.com",
            },
          })
      }
      const userName = userDoc?.user_name ?? "V"
      const userMessage = formatDbMessage(userName, requestText)

      const userState = ""

      launchBackgroundScope(scope, async (scope) => {
        try {
          let chatFragmentTime = 0
          let chatPieceTime = 0
          let audioChunkTime = 0
          let audioResponseTime = 0
          let assistantResponse = ""
          let hardFilter = true
          const language = this.#language
          for await (var chatPiece of chatFragmentIterToChatPieceIter(
            (async function* () {
              for await (const chatFragment of streamingConversation(
                userMessage,
                language,
                userDoc,
                characterName,
                characterDescription,
                userState,
                characterId,
                71
              )) {
                if (chatFragmentTime === 0) {
                  chatFragmentTime = Date.now()
                }
                yield chatFragment
              }
            })()
          )) {
            if (chatPieceTime === 0) {
              chatPieceTime = Date.now()
            }

            log.info(`AI: [to text] ${chatPiece}`)
            hardFilter =
              hardFilter &&
              !chatPiece.trim().toLowerCase().includes("is there s") &&
              !chatPiece.trim().toLowerCase().includes("is there an") &&
              !chatPiece.trim().toLowerCase().includes("我为您做些什么")
            if (hardFilter) {
              assistantResponse += chatPiece
              if (chatPiece.trim().length > 5) {
                const responseAudio = await elevenlabsTextToSpeech(
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
                  },
                ]
                this.#pushingPromise.resolve()
                this.#pushingPromise = buildPromise()
              }
            } else {
              break
            }
          }

          if (userDoc != undefined) {
            var history = [...userDoc.history] ?? []
            const characterMessage = formatDbMessage(characterName, assistantResponse);
            this.#messagePushQueue = [
              {
                kind: "json",
                value: {
                  kernel: {
                    assistantResponseFinalized: assistantResponse,
                  },
                },
              },
              ...this.#messagePushQueue,
            ]
            this.#pushingPromise.resolve()
            this.#pushingPromise = buildPromise()

            // search for history that matches characterId
            const characterHistoryExists = history.some((history) => history.character === characterId);
            if (characterHistoryExists) {
              // if history exists, append assistantResponse to conversation in exustingHistory
              history = history.map((history) => {
                if (history.character === characterId) {
                  return {
                    ...history,
                    conversation: [...history.conversation, userMessage,
                      characterMessage],
                  }
                }
                return history
              })
            } else {
              // if history does not exist, create a new history object and append to existingHistory
              const newHistoryItem = {
                character: characterId,
                conversation: [userMessage,
                  formatDbMessage(characterName, assistantResponse)],
              }
              history.push(newHistoryItem)
            }

            // bulkMergeFields
            const userDoc_ = {
              _id: userDoc._id,
              history: history,
            }
            await this.#modelClient.userStorageCollections
              .get(this.#language)
              ?.bulkMergeFields(scope, [userDoc_])

          }
        } catch (e) {
          log.info(`streamingConversation failed: [${String(e)}]`)
        }
      })
    }
  }

  async handleAudioMessage(character: string, audio: string, uuid: string, scope: Scope): Promise<void> {
    console.log("handleAudioMessage: ", character, uuid)
    // call increment on the decay counter
    this.#decayCounter.increment(character);
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
    if (this.#speechStream?.getReadyState() === 1) {
      console.log("Writing to speechStream...")
      this.#speechStream?.send(rawData)
    } else {
      console.log("speechStream not ready")
    }
  }
}
