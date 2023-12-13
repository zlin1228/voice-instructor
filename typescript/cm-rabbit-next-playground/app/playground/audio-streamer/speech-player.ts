import {
  OneOf,
  ValueOrError,
  asValueOrThrow,
  dispatchOneOf,
  dispatchOneOfAsync,
} from "base-core/lib/one-of"
import {
  PendingValue,
  Scope,
  Signal,
  SignalController,
} from "base-core/lib/scope"
import { buildPromise, flyingPromise } from "base-core/lib/utils"

// Reference: https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData

export type AudioBufferPlayerSpec = OneOf<{
  readonly idle: undefined
  readonly playing: {
    readonly audioBuffer: AudioBuffer
    readonly onFinish: () => void
  }
}>

export class AudioBufferPlayer {
  private readonly audioCtx: AudioContext
  private spec: AudioBufferPlayerSpec = {
    kind: "idle",
    value: undefined,
  }
  private audioNode: AudioBufferSourceNode | undefined = undefined

  constructor(audioCtx: AudioContext) {
    this.audioCtx = audioCtx
  }

  private removeAudioNode() {
    if (this.audioNode === undefined) return
    this.audioNode.stop()
    this.audioNode.disconnect()
    this.audioNode = undefined
  }

  updateSpec(spec: AudioBufferPlayerSpec) {
    this.spec = spec
    dispatchOneOf(this.spec, {
      idle: () => {
        this.removeAudioNode()
      },
      playing: ({ audioBuffer, onFinish }) => {
        this.removeAudioNode()
        this.audioNode = new AudioBufferSourceNode(this.audioCtx, {
          buffer: audioBuffer,
        })
        this.audioNode.addEventListener("ended", (ev) => {
          onFinish()
        })
        this.audioNode.connect(this.audioCtx.destination)
        this.audioNode.start()
      },
    })
  }
}

export type AudioBufferSignalPlayerSpec = OneOf<{
  readonly idle: undefined
  readonly playing: {
    readonly audioBufferSignal: Signal<ValueOrError<AudioBuffer>>
    readonly onFinish: (why: "complete" | "error") => void
  }
}>

export class AudioBufferSignalPlayer {
  private readonly scope: Scope
  private readonly audioBufferPlayer: AudioBufferPlayer
  private spec: AudioBufferSignalPlayerSpec = {
    kind: "idle",
    value: undefined,
  }

  constructor(scope: Scope, audioBufferPlayer: AudioBufferPlayer) {
    this.scope = scope
    this.audioBufferPlayer = audioBufferPlayer
  }

  updateSpec(spec: AudioBufferSignalPlayerSpec) {
    this.spec = spec
    this.reconcile()
  }

  private reconcile() {
    dispatchOneOf(this.spec, {
      idle: () => {
        this.audioBufferPlayer.updateSpec({
          kind: "idle",
          value: undefined,
        })
      },
      playing: ({ audioBufferSignal, onFinish }) => {
        dispatchOneOf(audioBufferSignal.get(), {
          pending: () => {
            audioBufferSignal.onceReady(this.scope, () => {
              this.reconcile()
            })
            this.audioBufferPlayer.updateSpec({
              kind: "idle",
              value: undefined,
            })
          },
          ready: (audioBufferOrError) => {
            if (audioBufferOrError.kind === "value") {
              this.audioBufferPlayer.updateSpec({
                kind: "playing",
                value: {
                  audioBuffer: audioBufferOrError.value,
                  onFinish: () => {
                    onFinish("complete")
                  },
                },
              })
            } else {
              this.audioBufferPlayer.updateSpec({
                kind: "idle",
                value: undefined,
              })
              onFinish("error")
            }
          },
        })
      },
    })
  }
}

export type SpeechPlayerSpec = OneOf<{
  readonly idle: undefined
  readonly playing: {
    readonly messageId: number
    readonly onFinish: () => void
  }
}>

type SpeechPlayerAudioPieceState = {
  audioBufferSignal: SignalController<ValueOrError<AudioBuffer>>
}

export class SpeechPlayer {
  private readonly audioCtx: AudioContext
  private readonly pendingAudioBufferPlayer: AudioBufferSignalPlayer
  private readonly audioPieces = new Map<string, SpeechPlayerAudioPieceState>()

  private spec: SpeechPlayerSpec = {
    kind: "idle",
    value: undefined,
  }
  private state: OneOf<{
    idle: undefined
    playing: {
      messageId: number
      pieceIndex: number
      pending: boolean
    }
  }> = {
    kind: "idle",
    value: undefined,
  }

  constructor(scope: Scope, audioCtx: AudioContext) {
    this.audioCtx = audioCtx
    this.pendingAudioBufferPlayer = new AudioBufferSignalPlayer(
      scope,
      new AudioBufferPlayer(audioCtx)
    )
  }

  private getAudioPieceKey(messageId: number, pieceIndex: number): string {
    return `${messageId}:${pieceIndex}`
  }

  addAudioPiece(
    messageId: number,
    pieceIndex: number,
    arrayBuffer: ArrayBuffer
  ) {
    const key = this.getAudioPieceKey(messageId, pieceIndex)
    const audioBufferPromise = this.audioCtx.decodeAudioData(arrayBuffer)
    this.audioPieces.set(key, {
      audioBufferSignal: new SignalController(),
    })
    flyingPromise(async () => {
      try {
        const audioBuffer = await audioBufferPromise
        const state = this.audioPieces.get(key)
        if (state === undefined) return
        state.audioBufferSignal.emit({
          kind: "value",
          value: audioBuffer,
        })
      } catch (e) {
        const state = this.audioPieces.get(key)
        if (state === undefined) return
        state.audioBufferSignal.emit({
          kind: "error",
          value: e instanceof Error ? e : new Error(String(e)),
        })
      }
      this.reconcile()
    })
    this.reconcile()
  }

  updateSpec(spec: SpeechPlayerSpec) {
    this.spec = spec
    this.reconcile()
  }

  private reconcile() {
    dispatchOneOf(this.spec, {
      idle: () => {
        this.state = {
          kind: "idle",
          value: undefined,
        }
        this.pendingAudioBufferPlayer.updateSpec({
          kind: "idle",
          value: undefined,
        })
      },
      playing: (spec) => {
        // Move the state to the right message/piece, no matter if the piece is ready or not
        this.state = {
          kind: "playing",
          value: dispatchOneOf(this.state, {
            // no playing message => play the message from the beginning
            idle: () => ({
              messageId: spec.messageId,
              pieceIndex: 0,
              pending: true,
            }),
            playing: (state) =>
              state.messageId === spec.messageId
                ? // same message => keep playing the current piece
                  state
                : // different message => play the message from the beginning
                  {
                    messageId: spec.messageId,
                    pieceIndex: 0,
                    pending: true,
                  },
          }),
        }

        // Start playing the piece if it is ready but not playing
        if (this.state.value.pending) {
          const key = this.getAudioPieceKey(
            this.state.value.messageId,
            this.state.value.pieceIndex
          )
          const pieceState = this.audioPieces.get(key)
          if (pieceState === undefined) {
            // The piece is still not ready
            this.pendingAudioBufferPlayer.updateSpec({
              kind: "idle",
              value: undefined,
            })
          } else {
            // The piece is ready now. Start playing it.
            this.state = {
              kind: "playing",
              value: {
                messageId: this.state.value.messageId,
                pieceIndex: this.state.value.pieceIndex,
                pending: false,
              },
            }
            this.pendingAudioBufferPlayer.updateSpec({
              kind: "playing",
              value: {
                audioBufferSignal: pieceState.audioBufferSignal,
                onFinish: (why) => {
                  if (why === "complete") {
                    // play the next piece if we still want to play the same message
                    if (
                      this.state.kind === "playing" &&
                      this.state.value.messageId === spec.messageId
                    ) {
                      this.state = {
                        kind: "playing",
                        value: {
                          messageId: this.state.value.messageId,
                          pieceIndex: this.state.value.pieceIndex + 1,
                          pending: true,
                        },
                      }
                      this.reconcile()
                    }
                  }
                },
              },
            })
          }
        }
      },
    })
  }
}
