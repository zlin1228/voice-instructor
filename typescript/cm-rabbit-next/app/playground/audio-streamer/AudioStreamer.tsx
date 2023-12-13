import { useRef, useState } from "react"

import ReactPlayer from "react-player"

import {
  SignalController,
  launchBackgroundScope,
  sleepSeconds,
  sleepUntilCancel,
} from "base-core/lib/scope.js"
import { Scope } from "base-core/lib/scope.js"
import { buildPromise, flyingPromise } from "base-core/lib/utils.js"
import { buildAttachmentForCancellation } from "base-core/lib/scope.js"
import { commonNormalizer } from "base-core/lib/types-common.js"
import { resolveUrl } from "base-core/lib/web.js"
import { stringRemovePrefix } from "base-core/lib/string.js"
import { log } from "base-core/lib/logging.js"

import { os2ServerMessageType } from "cm-rabbit-common/lib/schema/schema.js"

import { SpeechPlayer } from "./speech-player"

async function captureAudioStream(
  scope: Scope,
  onBlobAvailable: (blob: Blob) => void
) {
  log.info("Start capturing audio")
  try {
    if (
      !navigator.mediaDevices ||
      !(navigator.mediaDevices as unknown as Record<string, unknown>)[
        "getUserMedia"
      ]
    ) {
      log.info(
        "Failed to capture audio due to navigator.mediaDevices.getUserMedia being unavailable"
      )
      throw new Error(
        "Browser not supported due to navigator.mediaDevices.getUserMedia being unavailable"
      )
    }
    const mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: false,
        sampleRate: 16000,
        sampleSize: 16,
        channelCount: 1,
      },
    })
    log.info("navigator.mediaDevices.getUserMedia() succeeded")
    scope.onLeave(async () => {
      try {
        for (const track of mediaStream.getTracks()) {
          track.stop()
        }
      } catch (e) {
        log.info("Failed to stop tracks in MediaStream")
      }
    })
    const startTime = Date.now()
    const mediaRecorder = new MediaRecorder(mediaStream, {
      // What to use? See:
      //  - https://developer.mozilla.org/en-US/docs/Web/Media/Formats
      //  - https://developer.mozilla.org/en-US/docs/Web/Media/Formats/Audio_codecs
      //  - https://cloud.google.com/speech-to-text/docs/best-practices-provide-speech-data
      // Notes:
      //  - "If you need to minimize latency during music playback, you should strongly consider Opus"
      //  - "The codecs generally used on the web that are used for voice-only encoding are G.722 and AMR.
      //    AMR is a narrowband codec, encoding only the frequencies between 200 Hz and 3,400 Hz at bit rates
      //    typically around 7.4 kbps, while G.722 is a wideband codec that expands the audio bandwidth to
      //    50 Hz to 7,000 Hz at much higher bit rates—usually 64 kbps."
      //  - "Use a lossless codec to record and transmit audio. FLAC or LINEAR16 is recommended."
      //  - "If your application must use a lossy codec to conserve bandwidth, we recommend the AMR_WB, OGG_OPUS
      //     or SPEEX_WITH_HEADER_BYTE codecs, in that preferred order."
      mimeType: "audio/webm;codecs=opus",
      // mimeType: "audio/mp4;codecs=mp4a",
    })
    log.info("Created MediaRecorder")
    mediaRecorder.ondataavailable = (ev) => {
      const currentTime = Date.now()
      // console.log(`${currentTime - startTime} ${ev.data.size}`)
      onBlobAvailable(ev.data)
    }
    const pauseListener = () => {
      log.info("MediaRecorder paused")
    }
    mediaRecorder.addEventListener("pause", pauseListener)
    scope.onLeave(async () => {
      mediaRecorder.removeEventListener("pause", pauseListener)
    })
    const resumeListener = () => {
      log.info("MediaRecorder resumed")
    }
    mediaRecorder.addEventListener("resume", resumeListener)
    scope.onLeave(async () => {
      mediaRecorder.removeEventListener("resume", resumeListener)
    })
    const stopListener = () => {
      log.info("MediaRecorder stopped")
    }
    mediaRecorder.addEventListener("stop", stopListener)
    scope.onLeave(async () => {
      mediaRecorder.removeEventListener("stop", stopListener)
    })

    const timer = setInterval(() => {
      try {
        mediaRecorder.resume()
      } catch (e) {
        log.info(`Failed to repeatedly resume MediaRecorder: [${String(e)}]`)
      }
    }, 1000)
    scope.onLeave(async () => {
      clearInterval(timer)
    })

    const visibilityListener = () => {
      if (document.hidden) {
        const suspend = (async () => {
          log.info(`Pause MediaRecorder`)
          mediaRecorder.pause()
          await sleepSeconds(scope, 0.5)
          log.info(`Resume MediaRecorder after pause`)
          mediaRecorder.resume()
        })()
        suspend.catch((e) => {
          log.info(`Failed to pause/resume MediaRecorder: ${String(e)}`)
        })
      } else {
        try {
          log.info(`Resume MediaRecorder`)
          mediaRecorder.resume()
        } catch (e) {
          log.info(`Failed to resume MediaRecorder: ${String(e)}`)
        }
      }
    }
    document.addEventListener("visibilitychange", visibilityListener)
    scope.onLeave(async () => {
      document.removeEventListener("visibilitychange", visibilityListener)
    })

    mediaRecorder.start(50)
    log.info("Called mediaRecorder.start()")
    scope.onLeave(async () => {
      try {
        log.info("Called mediaRecorder.stop()")
        mediaRecorder.stop()
      } catch (e) {
        log.info("Failed to stop MediaRecorder")
      }
    })
  } catch (e) {
    log.info(`Audio failed: ${String(e)}`)
    throw e
  }
  await sleepUntilCancel(scope)
}

function buildWebSocketUrl(relativeUrl: string): string {
  const httpUrl = resolveUrl(window.location.href, "./kernel-os2-ws")
  const s1 = stringRemovePrefix(httpUrl, "http://")
  if (s1 !== undefined) {
    return `ws://${s1}`
  }
  const s2 = stringRemovePrefix(httpUrl, "https://")
  if (s2 !== undefined) {
    return `wss://${s2}`
  }
  throw new Error(`Invalid WebSocket relative URL: [${relativeUrl}]`)
}

const webSocketUrl = "ws://localhost:8080/kernel-os2-ws"
// const webSocketUrl = buildWebSocketUrl("./kernel-os2-ws")

export function AudioStreamer(props: {}) {
  const cancelRef = useRef<(reason: Error) => void>()
  const [activated, setActivated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [videoPlayed, setVideoPlayed] = useState(false)

  const handleStart = () => {
    log.info("Start")
    setActivated(true)
    flyingPromise(async () => {
      const { cancel, attachment } = buildAttachmentForCancellation(true)
      cancelRef.current = cancel
      await Scope.with(undefined, [attachment], async (scope) => {
        const audioCtx = new AudioContext()
        setInterval(() => {
          audioCtx.resume().catch((e) => {
            log.info(
              `Failed to repeatedly resume AudioContext due to ${String(e)}`
            )
          })
        }, 1000)
        const listener = () => {
          if (document.hidden) {
            const suspend = (async () => {
              log.info("Suspend AudioContext")
              await audioCtx.suspend()
              // log.info("Sleep a bit")
              // await sleepSeconds(scope, 0.5)
              // log.info("Try to resume AudioContext again!")
              // await audioCtx.resume()
            })()
            suspend.catch((e) => {
              log.info(`Failed to suspend AudioContext: ${String(e)}`)
            })
          } else {
            log.info("Resume AudioContext")
            audioCtx.resume().catch((e) => {
              log.info(`Failed to resume AudioContext: ${String(e)}`)
            })
          }
        }
        document.addEventListener("visibilitychange", listener)
        scope.onLeave(async () => {
          document.removeEventListener("visibilitychange", listener)
        })
        const audioPlayer = new SpeechPlayer(scope, audioCtx)
        try {
          const webSocket = new WebSocket(webSocketUrl)
          let currentSpeechId = 0
          let currentRecongnizationId = -1
          let currentPieceIndex = 0
          webSocket.binaryType = "arraybuffer"
          const { promise, resolve } = buildPromise()
          webSocket.addEventListener("open", (event) => resolve())
          log.info("Connecting WebSocket ...")
          await promise
          log.info("WebSocket connected")
          webSocket.addEventListener("message", (ev) => {
            if (typeof ev.data === "string") {
              log.info(`Control message: ${ev.data}`)
              const response = commonNormalizer(
                os2ServerMessageType,
                JSON.parse(ev.data)
              )
              if (response.speechRecognizing !== undefined) {
                if (
                  currentSpeechId !== response.speechRecognizing.speechId ||
                  currentRecongnizationId !==
                    response.speechRecognizing.recognizationId
                ) {
                  currentSpeechId = response.speechRecognizing.speechId
                  currentRecongnizationId =
                    response.speechRecognizing.recognizationId
                  currentPieceIndex = 0
                }
              } else if (response.speechRecognized !== undefined) {
                if (
                  currentSpeechId !== response.speechRecognized.speechId ||
                  currentRecongnizationId !==
                    response.speechRecognized.recognizationId
                ) {
                  currentSpeechId = response.speechRecognized.speechId
                  currentRecongnizationId =
                    response.speechRecognized.recognizationId
                  currentPieceIndex = 0
                }
                audioPlayer.updateSpec({
                  kind: "playing",
                  value: {
                    messageId: currentSpeechId * 1000 + currentRecongnizationId,
                    onFinish: () => {
                      // do nothing
                    },
                  },
                })
              } else if (response.latencyProfile !== undefined) {
                log.info(response.latencyProfile)
              }
            } else {
              const arrayBuffer = ev.data as ArrayBuffer
              log.info(`Received audio message: ${arrayBuffer.byteLength}`)
              audioPlayer.addAudioPiece(
                currentSpeechId * 1000 + currentRecongnizationId,
                currentPieceIndex,
                arrayBuffer
              )
              ++currentPieceIndex
            }
          })
          // TODO: handle websocket close
          await captureAudioStream(scope, (blob) => {
            webSocket.send(blob)
          })
          webSocket.close()
          log.info("Finish")
        } catch (e) {
          log.info(e)
        }
      })
    })
  }
  const handleStop = () => {
    setActivated(false)
    setVideoPlayed(false)
    cancelRef.current?.(new Error("Stop streaming audio"))
  }
  const handleDetectMime = () => {
    const codecs = [
      "audio/webm;codecs=opus",
      'audio/webm;codecs="opus"',
      "audio/webm",
      "audio/wav",
      "audio/wave",
      "audio/mp3",
      "audio/mp4",
      "audio/mp4;codecs=mp4a",
      "audio/mp4;codecs=mp4a.40",
      "audio/mp4;codecs=mp4a.40.2",
      "audio/mp4;codecs=mp4a.40.5",
      "audio/mpeg",
      "audio/mpeg;codecs=h264",
      "audio/ogg",
      "audio/ogg; codecs=vorbis",
      "audio/3gpp",
      "audio/aac",
      "audio/aac;codecs=h264",
      "audio/aac;codecs=h265",
      "audio/webm;codecs=vp8",
      "audio/webm;codecs=vp9",
      "audio/webm;codecs=h264",
    ]
    for (const codec of codecs) {
      const supported = MediaRecorder.isTypeSupported(codec)
      log.info(`${codec}: ${supported ? "Yes" : "No"}`)
    }
  }

  return (
    <div>
      <div>
        <button onClick={handleStart} disabled={activated || loading}>
          Activate
        </button>
        <button onClick={handleStop} disabled={!activated || loading}>
          Deactivate
        </button>
        {loading && "Video is loading ..."}
      </div>
      <div>
        {!videoPlayed && (
          <ReactPlayer
            playing={activated && !loading}
            muted={false}
            width="300px"
            height="175px"
            controls={false}
            playsinline={true}
            onReady={() => setLoading(false)}
            onEnded={() => setVideoPlayed(true)}
            // style={{
            //   position: "absolute",
            //   pointerEvents: "none",
            //   opacity: 1,
            //   zIndex: 2,
            // }}
            // url="https://storage.googleapis.com/quantum-engine-public/kernel-os2/intro-safari.mov"
            url="https://storage.googleapis.com/quantum-engine-public/Q_INTRO-webm.webm"
            // onEnded={handleVideoEnd}
          />
        )}
      </div>
      <div>
        <button onClick={handleDetectMime}>
          Detect supported audio MIME types
        </button>
      </div>
    </div>
  )
}
