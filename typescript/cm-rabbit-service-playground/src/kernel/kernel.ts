import { log } from "base-core/lib/logging.js"
import { OneOf } from "base-core/lib/one-of.js"
import {
  Scope,
  launchBackgroundScope,
  ScopeAttachment,
  HandlingQueue,
  runCancellableScope,
} from "base-core/lib/scope.js"
import { buildAttachmentForCancellation } from "base-core/lib/scope.js"
import { chatFragmentIterToChatPieceIter } from "./chat.js"
import { streamingConversation } from "./conversation.js"
import { ModelClient, UserStorage } from "../model.js"
import { azureTextToSpeech } from "./tts-azure.js"
import {
  Os2ClientMessage,
  Os2ServerMessage,
} from "cm-rabbit-common/lib/schema/schema.js"
import {
  CallgraphSharedParameter,
  CallgraphNode,
} from "../callgraph/graph.js"
import {
  sleepSeconds,
  checkAndGetCancelToken,
} from "base-core/lib/scope.js"
import { SpotifySession } from "../rabbits/spotify/spotify-session.js"
import {
  buildOpenAiLlmClient,
  openAiModel_Gpt35_Turbo_16K,
  openAiModel_Gpt4_32K,
  OpenAiLlmClient,
} from "base-nli/lib/llm/openai.js"
import {
  buildSentenceTransformerEmbeddingClient
} from "base-nli/lib/embedding/sentencetransformer.js"
import { EmbeddingClient } from "base-nli/lib/embedding/client.js"
import {
  buildAnthropicLlmClient,
  anthropicModel_ClaudeInstant1,
  AnthropicLlmClient,
} from "base-nli/lib/llm/anthropic.js"
import {
  LlmModelClient,
  buildLlmCompletionLogger,
} from "base-nli/lib/llm/log.js"
import {
  getUserDocCreateIfNotExist,
  wavToRaw,
} from "./kernel-common.js"
import Deepgram from "@deepgram/sdk"
import { MilvusClient } from "@zilliz/milvus2-sdk-node"
import { fileExists } from "base-node/lib/file.js"
import { addToConversationMemory, retrieveRecentConversationMemory, retrieveConversationMemory, MemoryRecord } from "../memory/conversation.js"
import { updateIntentionByUserUtterance } from "./intention.js"
import { InstructClient } from "base-nli/lib/instruct/client.js"
import { openAiModel_Gpt35_Turbo_Instruct, buildOpenAiInstructClient } from "base-nli/lib/instruct/openai.js"
import { BroadcastController } from "base-core/lib/scope.js"
import { formatDbMessage } from "./kernel-common.js"
import { callgraphPattern } from "../callgraph/kernel-interface.js"
import { kernelRunCallgraphScheduleStep } from "../callgraph/executor.js"
import { flushBunnyMailbox } from "../callgraph/mailbox.js"

export class Kernel {
  readonly #scope: Scope
  readonly serverMessageQueue: HandlingQueue<
    OneOf<{
      json: Os2ServerMessage
      binary: Uint8Array
    }>
  >
  readonly modelClient: ModelClient
  #speechStream: any
  userId: string
  language: string
  #mimeType: string
  hostIp: string
  timeZone: string
  #done: boolean
  musicPlaying: boolean
  listening: boolean
  #spotifySession: SpotifySession
  cancelHandler: (reason: Error) => void
  cancelAttachment: ScopeAttachment
  openAillmClient: OpenAiLlmClient | null = null
  openAiInstructClient: InstructClient | null = null
  openAiGPT4LlmClient: OpenAiLlmClient | null = null
  embeddingClient: EmbeddingClient | null = null
  anthropicLlmClient: AnthropicLlmClient | null = null
  milvusClient: MilvusClient | null = null
  milvusCollectionName: string = "prod"
  milvusInit: boolean = false
  salientMemory: string[] = []
  bunnyMailbox: { bunnyId: string, result: string, flush: boolean }[] = []
  isGreeting: boolean = false
  isFlushing: boolean = false
  #callgraphScheduleStep = -1
  sharedParameter: CallgraphSharedParameter | null = null
  textBuffer: string = ""
  userUtteranceInProgress: boolean = false
  flushNext: boolean = false

  private constructor(
    scope: Scope,
    serverMessageQueue: HandlingQueue<
      OneOf<{
        json: Os2ServerMessage
        binary: Uint8Array
      }>
    >,
    spotifySession: SpotifySession,
    modelClient: ModelClient,
    iteration: number,
    musicPlaying: boolean,
    userDocOperationBroadcast: BroadcastController<UserStorage>,
  ) {
    this.#scope = scope
    this.serverMessageQueue = serverMessageQueue
    this.modelClient = modelClient
    this.#speechStream = null
    this.userId = ""
    this.language = ""
    this.#mimeType = ""
    this.hostIp = ""
    this.timeZone = ""

    launchBackgroundScope(scope, async (_: Scope) => {
      if (process.env["KUBERNETES_SERVICE_HOST"] !== undefined) {
        log.info("Running in Kubernetes environment - use prod milvus cluster")
        this.milvusClient = new MilvusClient({ address: 'dev-milvus.milvus.svc.cluster.local:19530' })
        this.milvusCollectionName = "prod"
      } else if (await fileExists("/.dockerenv")) {
        log.info("Running in Docker environment - use prod milvus cluster")
        this.milvusClient = new MilvusClient({ address: 'dev-milvus.milvus.svc.cluster.local:19530' })
        this.milvusCollectionName = "prod"
      } else {
        log.info("Running in non-Kubernetes environment - use dev milvus cluster")
        this.milvusClient = new MilvusClient({ address: 'localhost:27017' })
        this.milvusCollectionName = "dev"
      }

      /*
      const create = await this.milvusClient.createCollection({
        collection_name: this.milvusCollectionName,
        fields: [
          {
            name: 'id',
            description: 'ID field',
            data_type: DataType.Int64,
            is_primary_key: true,
            autoID: true,
          },
          {
            name: 'vector',
            description: 'Vector field',
            data_type: DataType.FloatVector,
            dim: 384,
          },
          {
            name: 'text',
            description: 'text',
            data_type: DataType.VarChar,
            max_length: 12800,
          },
          {
            name: 'timestamp',
            description: 'Timestamp',
            data_type: DataType.Int64,
          },
          {
            name: 'ord',
            description: 'ord',
            data_type: DataType.Int64,
          },
          {
            name: 'userId',
            description: 'User ID',
            data_type: DataType.VarChar,
            max_length: 128,
          },
        ],
      });

      console.log('Collection is created', create);

      // create index
      const createIndex = await this.milvusClient.createIndex({
        collection_name: this.milvusCollectionName,
        field_name: 'vector',
        metric_type: 'L2',
      });

      console.log('Index is created', createIndex);

      // need load collection before search
      const load = await this.milvusClient.loadCollectionSync({
        collection_name: this.milvusCollectionName,
      });
      console.log('Collection is loaded.', load);
      */
      console.log('Create milvus collection is finished.', this.milvusCollectionName);
      this.milvusInit = true
    })

    const cancelToken = checkAndGetCancelToken(scope)
    cancelToken.onCancel(async () => {
      this.#done = true
    })
    this.#done = false
    this.musicPlaying = musicPlaying
    this.listening = false
    this.#spotifySession = spotifySession
    var { cancel, attachment } = buildAttachmentForCancellation(true)
    this.cancelHandler = cancel
    this.cancelAttachment = attachment

    launchBackgroundScope(scope, async (scope: Scope) => {
      const userStorageCollection = this.modelClient.userStorageCollections.get(
        "en"
      )
      while (this.userId === "") {
        await sleepSeconds(scope, 0.1)
        console.log("Waiting for userId to be set...")
      }
      const userDoc = await getUserDocCreateIfNotExist(
        scope,
        this.modelClient,
        this.language,
        this.userId
      )
      const assistantName = userDoc?.assistant_name ?? "Assistant"
      const speaker = userDoc?.speaker ?? "female"
      if (userStorageCollection === undefined) {
        throw new Error("userStorageCollection is undefined")
      }
      const bunnyMailbox = (await userStorageCollection.getById(scope, this.userId))?.bunny_mailbox ?? []
      this.bunnyMailbox = [...bunnyMailbox];

      console.log('userDocOperationBroadcast: ', userDocOperationBroadcast)
      await runCancellableScope(scope, async (scope: Scope, cancel: any) => {
        const cancelToken = checkAndGetCancelToken(scope)

        userDocOperationBroadcast.listen(scope, (userOperationDoc: UserStorage) => {
          if (userOperationDoc._id === this.userId) {
            var newBunnyMailbox = (userOperationDoc.bunny_mailbox as unknown as { bunnyId: string, result: string, flush: boolean }[]) ?? []
            var newScheduleStep = userOperationDoc.current_callgraph.current_step
            if (newScheduleStep !== undefined && newScheduleStep !== this.#callgraphScheduleStep) { // schedule updated.
              this.#callgraphScheduleStep = newScheduleStep
              if (newScheduleStep == userOperationDoc.current_callgraph.schedule.length) {
                if (this.isFlushing) {
                  console.log("Already flushing bunny mailbox. Skipping...")
                  return
                }
                console.log("New schedule step. Schedule finished. Flushing bunny mailbox...")
                flushBunnyMailbox(scope, modelClient, serverMessageQueue, speaker, assistantName, newBunnyMailbox, this, attachment, true)
                this.#callgraphScheduleStep = -1
              } else if (newScheduleStep >= 0) {
                console.log("Running schedule step: ", newScheduleStep)
                const newSchedule = userOperationDoc.current_callgraph.schedule[newScheduleStep]
                if (newSchedule !== undefined) {
                  const callgraphNodes = userOperationDoc.current_callgraph.nodes
                  const newScheduleStep: CallgraphNode[] = newSchedule.map((nodeId: number) => {
                    const callgraphNode = callgraphNodes.find((x: any) => x.nodeId === nodeId)
                    if (callgraphNode === undefined) {
                      throw new Error("callgraphNode is undefined.")
                    }
                    return {
                      _id: nodeId,
                      action: callgraphNode.bunnyName,
                      value: callgraphNode.bunnyArgs,
                    }
                  })

                  kernelRunCallgraphScheduleStep(scope, attachment, { nodes: newScheduleStep }, this)
                } else {
                  console.log("ERROR: newSchedule is undefined.")
                }
              } else { // potential flushing element
                const lastElement = newBunnyMailbox[newBunnyMailbox.length - 1]
                if (lastElement !== undefined && lastElement.flush) {
                  console.log("Flushing bunny mailbox...")
                  console.log("userOperationDoc: ", userOperationDoc)
                  if (this.isFlushing) {
                    console.log("Already flushing bunny mailbox. Skipping...")
                    return
                  }
                  flushBunnyMailbox(scope, modelClient, serverMessageQueue, speaker, assistantName, newBunnyMailbox, this, attachment, false)
                  return // do not run schedule step
                } else {
                  console.log("Not flushing bunny mailbox...")
                }
              }
            }
          } else {
            console.log("Filtering out operations for other users.")
          }
        })

        while (cancelToken.cancelReason === undefined) {
          await sleepSeconds(scope, 0.5)
        }
      })
    })

    launchBackgroundScope(scope, async (_: any) => {
      this.openAillmClient = await buildOpenAiLlmClient(scope, {
        apiKey: "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",
        model: openAiModel_Gpt35_Turbo_16K,
        completionLogger: await buildLlmCompletionLogger(
          await LlmModelClient.build(
            scope,
            "mongodb+srv://info:eLVGtLSn2qmKZAgp@rabbit-os.fu6px.mongodb.net/?retryWrites=true&w=majority",
            "llm-logs-server"
          ),
          openAiModel_Gpt35_Turbo_16K
        ),
      })
    })

    launchBackgroundScope(scope, async (_: any) => {
      this.openAiGPT4LlmClient = await buildOpenAiLlmClient(scope, {
        apiKey: "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",
        model: openAiModel_Gpt4_32K,
        completionLogger: await buildLlmCompletionLogger(
          await LlmModelClient.build(
            scope,
            "mongodb+srv://info:eLVGtLSn2qmKZAgp@rabbit-os.fu6px.mongodb.net/?retryWrites=true&w=majority",
            "llm-logs-server"
          ),
          openAiModel_Gpt4_32K
        ),
      })
    })

    launchBackgroundScope(scope, async (_: any) => {
      this.anthropicLlmClient = await buildAnthropicLlmClient(scope, {
        apiKey:
          "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",
        model: anthropicModel_ClaudeInstant1,
        completionLogger: await buildLlmCompletionLogger(
          await LlmModelClient.build(
            scope,
            "mongodb+srv://info:eLVGtLSn2qmKZAgp@rabbit-os.fu6px.mongodb.net/?retryWrites=true&w=majority",
            "llm-logs-server"
          ),
          anthropicModel_ClaudeInstant1
        ),
      })
    })

    launchBackgroundScope(scope, async (_: any) => {
      this.openAiInstructClient = await buildOpenAiInstructClient(scope, {
        apiKey: "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",
        model: openAiModel_Gpt35_Turbo_Instruct,
      })
    })

    launchBackgroundScope(scope, async (_: any) => {
      this.embeddingClient = await buildSentenceTransformerEmbeddingClient(scope)
    })
  }

  setUserId(userId: string): void {
    this.userId = userId
  }

  setLanguage(language: string): void {
    this.language = language
  }

  setMimeType(mimeType: string): void {
    this.#mimeType = mimeType
  }

  setHostIp(hostIp: string): void {
    this.hostIp = hostIp
  }

  setTimeZone(timeZone: string): void {
    this.timeZone = timeZone
  }

  getMusicPlaying(): boolean {
    return this.musicPlaying
  }

  startListening(): void {
    this.listening = true
  }

  stopListening(): void {
    this.listening = false
  }

  getListening(): boolean {
    return this.listening
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
    spotifySession: SpotifySession,
    modelClient: ModelClient,
    iteration: number,
    musicPlaying: boolean,
    userDocOperationBroadcast: any,
  ): Promise<Kernel> {
    return new Kernel(
      scope,
      serverMessageQueue,
      spotifySession,
      modelClient,
      iteration,
      musicPlaying,
      userDocOperationBroadcast
    )
  }

  async getUserState(scope: Scope): Promise<string> {
    const playerStatus = this.#spotifySession.playerStatus()
    const trackName =
      playerStatus === undefined
        ? ""
        : `Name: ${playerStatus.trackName} | Artist: ${playerStatus.artistName}`
    return this.#spotifySession.isLoginStorageAvailable()
      ? `--- Begin Spotify Status ---
Spotify is logged in.
Current track: ${trackName}>
--- End Spotify Status ---`
      : `--- Begin Spotify Status ---
Spotify is not logged in.
--- End Spotify Status ---
`
  }

  async launchAudioHandler(scope: Scope): Promise<void> {
    console.log("Launching kernel audio handler...")

    await Scope.with(undefined, [], async (scope: any) => {
      try {
        while (true) {
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
            endpointing: 40,
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
                  "Appending audio message: ",
                  requestText,
                  "confidence: ",
                  confidence
                )
                this.textBuffer = (this.textBuffer + " " + requestText).trimStart()
                if (this.flushNext) {
                  // deep copy str
                  const buf = this.textBuffer
                  this.textBuffer = ""
                  this.flushNext = false
                  await this.handleTextMessage(buf, scope)
                }
              }
            } catch (e) {
              // console.log("ERROR: ", e)
            }
          })

          speechStream.addListener("error", (error: any) => {
            console.log("STT: ERROR", error)
            throw new Error("STT: ERROR")
          })

          speechStream.addListener("close", () => {
            console.log("STT: CLOSE")
            done = true
          })

          this.#speechStream = speechStream
          while (!done && this.listening) {
            await sleepSeconds(scope, 0.1)
          }
        }
      } catch (e) {
        console.log("launchAudioHandler ERROR: ", e)
      }
    })

    console.log("Kernel audio handler done.")
  }

  async handleTextMessage(requestText: string, scope: Scope): Promise<void> {
    console.log("Handling text message...", `(${requestText})`)

    this.cancelHandler(new Error("New text message received."))
    var { cancel, attachment } = buildAttachmentForCancellation(true)
    this.cancelHandler = cancel
    this.cancelAttachment = attachment

    if (requestText.trim().length > 0) {
      const userDoc = await getUserDocCreateIfNotExist(
        scope,
        this.modelClient,
        this.language,
        this.userId
      )
      const userName: string = userDoc?.user_name ?? "User"
      const assistantName: string = userDoc?.assistant_name ?? "Assistant"
      const speaker: string = userDoc?.speaker ?? "female"
      const userMessage: string = formatDbMessage(userName, requestText)

      const userState = await this.getUserState(scope)
      const timeZone = this.timeZone

      var firstFragmentDelivered = { current: false }

      try {
        var attachment = this.cancelAttachment
        await Scope.with(undefined, [attachment], async (scope: any) => {
          while (this.openAillmClient == null) {
            await sleepSeconds(scope, 0.1)
            console.log("Waiting for openAillmClient to be initialized...")
          }
          const llmClient = this.openAillmClient

          let chatPieceTime = 0
          let assistantResponse = ""
          const language = this.language

          var callgraphDetermined = false
          var chunks = 0
          var embeddingClient = this.embeddingClient
          var vectorDBClient = this.milvusClient
          var collectionName = this.milvusCollectionName
          var userId = this.userId
          const semanticMemory = await retrieveConversationMemory(scope, userMessage, 10, embeddingClient, vectorDBClient, userId, collectionName);
          const recallMemory = await retrieveRecentConversationMemory(
            scope, userDoc, 4, this.milvusClient, this.userId, this.milvusCollectionName
          )
          // concat the two, and remove duplicates, and sort by timestamp
          var memory = semanticMemory.concat(recallMemory)
          memory = memory.filter((v, i, a) => a.findIndex(t => (t.text === v.text)) === i)
          memory = memory.sort((a, b) => (a.timestamp > b.timestamp) ? 1 : -1)

          const salientMemory = [... this.salientMemory];

          this.salientMemory.push("User: " + requestText)
          this.salientMemory.push("Assistant: " + assistantResponse)

          for await (var chatAccumulator of chatFragmentIterToChatPieceIter(
            (async function* () {
              for await (const chatFragment of streamingConversation(
                userMessage,
                language,
                userDoc,
                userState,
                llmClient,
                scope,
                memory,
                salientMemory,
                timeZone
              )) {
                yield chatFragment
              }
            })()
          )) {
            if (this.userUtteranceInProgress) {
              console.log("User utterance in progress. Skipping...")
              return
            }
            if (chatPieceTime === 0) {
              chatPieceTime = Date.now()
            }

            var chatPiece = chatAccumulator.fragment
            var fullyAccumulatedChatPiece = chatAccumulator.fragmentLookAhead

            // trim non-alphanumeric characters from assistantName
            var assistantName : string = userDoc?.assistant_name ?? "Assistant"
            assistantName = assistantName.replace(/[^a-zA-Z0-9]/g, '')
            chatPiece = chatPiece.replace(`${assistantName}:`, "").trimStart()
            chatPiece = chatPiece.replace(`${userName}:`, "").trimStart()
            chatPiece = chatPiece.replace(`Assistant:`, "").trimStart()
            chatPiece = chatPiece.replace(`User:`, "").trimStart()
            chatPiece = chatPiece.replace(new RegExp(`${assistantName}\\s*:`), "").trimStart()

            if (
              "How can I assist you further?" === chatPiece.trim() ||
              "How may I assist you today?" === chatPiece.trim() ||
              "How can I assist you today?" === chatPiece.trim() ||
              "Is there anything else I can assist you with?" === chatPiece.trim() ||
              "How may I assist you now?" === chatPiece.trim() ||
              "How can I assist you now?" === chatPiece.trim() ||
              "Is there anything else I can help you with?" === chatPiece.trim()
            ) {
              console.log("\t WARNING: Filtering out: ", chatPiece)
              continue
            }

            this.salientMemory[this.salientMemory.length - 1] = this.salientMemory[this.salientMemory.length - 1] + chatPiece

            log.info(`AI: ${chatPiece}`)

            assistantResponse += chatPiece
            if (chatPiece.trim().length > 1) {
              chunks += 1
              if (this.listening) {
                console.log("Sending audio response...")
                const responseAudio = await azureTextToSpeech(
                  scope,
                  chatPiece,
                  this.language,
                  speaker
                )
                console.log("responseAudio.duration: ", responseAudio.duration)
                this.serverMessageQueue.pushBack({
                  kind: "json",
                  value: {
                    kernel: {
                      assistantResponse: chatPiece,
                    },
                  },
                })
                this.serverMessageQueue.pushBack({
                  kind: "binary",
                  value: responseAudio.data,
                })
                await sleepSeconds(scope, responseAudio.duration / 10000000)

                firstFragmentDelivered.current = true
              } else {
                console.log("Sending text response...")
                this.serverMessageQueue.pushBack({
                  kind: "json",
                  value: {
                    kernel: {
                      assistantResponse: chatPiece,
                    },
                  },
                })
                await sleepSeconds(scope, 0.07 * chatPiece.length)
                firstFragmentDelivered.current = true
              }
            }

            if (chunks > 1 && userDoc != undefined && !callgraphDetermined) {
              callgraphDetermined = true
              console.log("Launching callgraph pattern after the second fragment...")
              console.log("Current response: ", assistantResponse, "fully accumulated: ", fullyAccumulatedChatPiece)
              launchBackgroundScope(scope, async (_: Scope) => {
                await Scope.with(undefined, [], async (iscope: any) => {
                  launchBackgroundScope(iscope, async (_: Scope) => {
                    try {
                      while (this.openAiInstructClient == null) {
                        await sleepSeconds(iscope, 0.2)
                        console.log("Waiting for openAillmClient to be initialized...")
                      }
                      const newIntention = await updateIntentionByUserUtterance(iscope, this.modelClient, this.openAiInstructClient, this.userId, requestText, this.salientMemory)
                      console.log("newIntention: ", newIntention)
                      await callgraphPattern(
                        iscope,
                        userDoc,
                        userMessage,
                        newIntention,
                        assistantName,
                        fullyAccumulatedChatPiece,
                        memory,
                        firstFragmentDelivered,
                        this,
                      )
                    } catch (e) {
                      log.info(`callgraph failed: [${String(e)}]`)
                    }
                  })
                })
              })
            }
          }

          if (userDoc != undefined && !callgraphDetermined) {
            console.log("Launching callgraph pattern after end of response...")
            await Scope.with(undefined, [], async (scope: any) => {
              while (this.openAiInstructClient == null) {
                await sleepSeconds(scope, 0.2)
                console.log("Waiting for openAillmClient to be initialized...")
              }
              const newIntention = await updateIntentionByUserUtterance(scope, this.modelClient, this.openAiInstructClient, this.userId, requestText, this.salientMemory)
              console.log("newIntention: ", newIntention)
              await callgraphPattern(
                scope,
                userDoc,
                userMessage,
                newIntention,
                assistantName,
                assistantResponse,
                memory,
                firstFragmentDelivered,
                this,
              )
            })
          } else {
            console.log("callgraph already determined.")
          }
        })
      } catch (e) {
        log.info(`streamingConversation failed: [${String(e)}]`)
      }
    }
  }

  async push(data: Uint8Array) {
    const rawData = await wavToRaw(data)
    // console.log("Pushing audio data...")
    if (this.#speechStream?.getReadyState() === 1) {
      this.#speechStream?.send(rawData)
      // console.log("Pushing audio data...")
    } else {
      console.log("speechStream not ready")
    }
    // this.#speechStream?.write(rawData)
  }
}
