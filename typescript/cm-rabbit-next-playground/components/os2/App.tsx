import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import MediaStreamRecorder from "msr"
import { useAuth, useUser } from "@clerk/nextjs"
import Image from "next/image"

import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query"

import * as Tone from "tone"
import audioLoad from "audio-loader"
import Modal from "../../os2/Modal"
import Rabbit from "../../os2/Rabbit"
import {
  powerGroteskRegular,
  untitledSansRegular,
  untitledSansLight,
} from "../../app/fonts/fonts"

import {
  Broadcast,
  SignalController,
  launchBackgroundScope,
  mapBroadcast,
  sleepSeconds,
} from "base-core/lib/scope.js"

import { Scope, sleepUntilCancel } from "base-core/lib/scope.js"
import { useSessionController } from "../session/session"
import {
  Os2ClientMessage,
  Os2ServerMessage,
  metaResponseType,
} from "cm-rabbit-common/lib/schema/schema.js"
import { OneOf } from "base-core/lib/one-of.js"
import {
  useSpotifyLoginStorage,
  useSpotifyLoginStorageKey,
} from "../spotify/spotify-storage"
import {
  SpotifyPlayerController,
  SpotifyPlayerControllerConnected,
  useSpotifyPlayerController,
} from "../spotify/spotify-player-controller"
import {
  Os2ClientMessageSpotify,
  Os2ServerMessageSpotify,
} from "cm-rabbit-common/lib/session/session-spotify"
import { SpotifyPlayerUI } from "../spotify/spotify-player-ui"
import { SpotifyPlayerDebugPanel } from "../spotify/spotify-player-debug-panel"
import {
  SpotifyLoginController,
  useSpotifyLoginController,
} from "../spotify/spotify-login-controller"
import { SpotifyLoginDebugPanel } from "../spotify/spotify-login-debug-panel"
import {
  runEffectScope,
  useBroadcast,
  useCancelAttachment,
  useDebugValueHas,
  useStateRef,
} from "../utils/hooks"
import { NoVncPanel } from "../novnc/novnc"
import { Os2SpotifyPlayerControl } from "cm-rabbit-common/lib/spotify/spotify"
import { flyingPromise } from "base-core/lib/utils.js"
import { abortIfUndefined } from "base-core/lib/debug.js"
import {
  LogPanel,
  UILogStyle,
  appendDebugLog,
  useShowDebugPanel,
} from "../utils/debug"
import { writeSpotifyLoginStorage } from "../spotify/spotify-storage"
import SpotifyLoginPanel from "./SpotifyLoginPanel"
import { MediaRecorder, register } from "extendable-media-recorder"
import { connect } from "extendable-media-recorder-wav-encoder"
import { commonNormalizer } from "base-core/lib/types-common"
import { space } from "postcss/lib/list"

const queryClient = new QueryClient()

const BASEURL = "https://storage.googleapis.com/quantum-engine-public"

const userActionLogStyle: UILogStyle = {
  disabled: false,
  color: "#0000ff",
}
const userChatLogStyle: UILogStyle = {
  disabled: false,
  color: "#00ff00",
}
const assistantChatLogStyle: UILogStyle = {
  disabled: false,
  color: "#ffff00",
}
const spotifyLogStyle: UILogStyle = {
  disabled: false,
  color: "#00ffff",
}
const debugLogStyle: UILogStyle = {
  disabled: false,
  color: "#888888",
}

// Create an OfflineAudioContext which will generate the silent audio
var audioContext = new OfflineAudioContext(1, 44100 * 0.2, 44100);

var silentBlob: Blob;
// Generate the silent audio
audioContext.startRendering().then(function(buffer) {
    // Convert the audio buffer to a WAV Blob
    silentBlob = bufferToWave(buffer, buffer.length);
});

// This function converts an audio buffer to a WAV Blob
function bufferToWave(abuffer: any, len: any) {
    var numOfChan = abuffer.numberOfChannels,
        length = len * numOfChan * 2 + 44,
        buffer = new ArrayBuffer(length),
        view = new DataView(buffer),
        channels = [], i, sample,
        offset = 0,
        pos = 0;

    // write WAVE header
    setUint32(0x46464952);                         // "RIFF"
    setUint32(length - 8);                         // file length - 8
    setUint32(0x45564157);                         // "WAVE"

    setUint32(0x20746d66);                         // "fmt " chunk
    setUint32(16);                                 // length = 16
    setUint16(1);                                  // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(abuffer.sampleRate);
    setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2);                      // block-align
    setUint16(16);                                 // 16-bit (hardcoded in this demo)

    setUint32(0x61746164);                         // "data" - chunk
    setUint32(length - pos - 4);                   // chunk length

    // write interleaved data
    for(i = 0; i < abuffer.numberOfChannels; i++)
        channels.push(abuffer.getChannelData(i));

    while(pos < length) {
        for(i = 0; i < numOfChan; i++) {             // interleave channels
            sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0; // scale to 16-bit signed int
            view.setInt16(pos, sample, true);          // write 16-bit sample
            pos += 2;
        }
        offset++                                     // next source sample
    }

    // create Blob
    return new Blob([buffer], {type: "audio/wav"});

    function setUint16(data: any) {
        view.setUint16(pos, data, true);
        pos += 2;
    }

    function setUint32(data: any) {
        view.setUint32(pos, data, true);
        pos += 4;
    }
}

function SpotifyPlayerPanel(props: {
  controller: SpotifyPlayerController
  spotifyLoginStorage: string
  timeOffsetSeconds: number
  pushClientMessage: (spotifyClientMessage: Os2ClientMessageSpotify) => void
  serverMessageBroadcast: Broadcast<Os2ServerMessageSpotify>
  volume: number
  onVolumeChange: (volume: number) => void
  listening: boolean
}) {
  const os2DebugEnabled = useDebugValueHas("os2-debug")
  const { controller } = props
  const mediaStream =
    controller.phase.kind === "connected"
      ? controller.phase.value.mediaStream
      : undefined
  const mediaStreamRef = useRef<MediaStream>()
  const volumeRef = useRef(props.volume)
  const audioRef = useRef<HTMLAudioElement>()
  const audioCallback = useCallback(
    (audio: HTMLAudioElement | null) => {
      audioRef.current = audio ?? undefined
      if (audio === null) {
        return
      }
      if (mediaStream !== undefined && mediaStreamRef.current !== mediaStream) {
        mediaStreamRef.current = mediaStream
        audio.srcObject = mediaStream
        audio.volume = volumeRef.current
      }
    },
    [mediaStream, mediaStreamRef, volumeRef]
  )
  useEffect(() => {
    if (audioRef.current !== undefined) {
      audioRef.current.volume = props.volume
    }
  }, [props.volume])
  const handleVolumeChange = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.buttons !== 1) return
    const { x, width } = e.currentTarget.getBoundingClientRect()
    const value = (e.clientX - x) / width
    props.onVolumeChange(Math.min(Math.max(value, 0), 1))
    e.preventDefault()
  }
  if (os2DebugEnabled) {
    return (
      <div>
        <h3>Spotify Player</h3>
        <SpotifyPlayerDebugPanel
          controller={controller}
          spotifyLoginStorage={props.spotifyLoginStorage}
          pushClientMessage={props.pushClientMessage}
          serverMessageBroadcast={props.serverMessageBroadcast}
        />
      </div>
    )
  }

  return (
    <div style={{ padding: "24px" }}>
      <audio ref={audioCallback} autoPlay />
      {controller.phase.kind === "connected" &&
        controller.phase.value.playerStatus !== undefined && (
          <div>
            <SpotifyPlayerUI
              timeOffsetSeconds={props.timeOffsetSeconds}
              playerStatus={controller.phase.value.playerStatus}
              handlePlayerControl={controller.phase.value.handlePlayerControl}
              listening={props.listening}
              volume={props.volume}
              onVolumeChange={props.onVolumeChange}
            />
          </div>
        )}
    </div>
  )
}

const streamAudioToServer = async (
  scope: Scope,
  pushClientMessage: (
    clientMessage: OneOf<{
      json: Os2ClientMessage
      binary: Uint8Array | Blob
    }>
  ) => void,
  mime: string,
  listeningRef: { current: boolean },
  spacePressedRef: { current: boolean },
  deviceId?: string
): Promise<{
  ms: MediaStream | undefined
  mr: MediaRecorder | any
}> => {
  let stream: MediaStream | undefined
  let mediaRecorder: MediaRecorder | any
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: false,
        sampleRate: mime === "opus" ? 48000 : 16000,
        sampleSize: 16,
        channelCount: 1,
        deviceId: deviceId,
      },
    })
    if (mime === "opus") {
      /*
      mediaRecorder = new MediaRecorder(stream, {
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
      })

      mediaRecorder.start(125)
      scope.onLeave(async () => {
        mediaRecorder.stop()
      })
      mediaRecorder.ondataavailable = function (blob: any) {
        // console.log(blob);
        // if (ws.readyState === WebSocket.OPEN) ws.send(blob.data)
        if (listeningRef.current) {
          pushClientMessage({
            kind: "binary",
            value: blob.data,
          })
        }
      }*/
    } else {
      mediaRecorder = new MediaStreamRecorder(stream)
      mediaRecorder.mimeType = "audio/wav"
      mediaRecorder.audioChannels = 1
      mediaRecorder.start(200)
      scope.onLeave(async () => {
        mediaRecorder.stop()
      })

      mediaRecorder.ondataavailable = function (blob: Blob) {
        // console.log(stream)
        if (listeningRef.current) {
          if (spacePressedRef.current) {
            pushClientMessage({
              kind: "binary",
              value: blob,
            })
            // console.log("pushed blob")
          } else {
            // send silent blob
            pushClientMessage({
              kind: "binary",
              value: silentBlob,
            })
          }
        }
      }
    }
  } catch (e) {
    console.log(e)
    stream = undefined
    mediaRecorder = null
  }

  return {
    ms: stream,
    mr: mediaRecorder,
  }
}

function SignOutButton(props: {}) {
  const { signOut } = useAuth()
  const spotifyLoginStorageKey = useSpotifyLoginStorageKey()
  const handleClick = () => {
    flyingPromise(async () => {
      writeSpotifyLoginStorage(spotifyLoginStorageKey, undefined)
      await signOut()
      window.location.href = "/"
    })
  }
  return (
    <div
      style={{
        height: 20,
        cursor: "pointer",
      }}
      onClick={handleClick}
    >
      <img
        height={20}
        style={{
          marginTop: 20,
          marginRight: 10,
        }}
        src={BASEURL + "/logout.png"}
      ></img>
    </div>
  )
}

function MobilePanel(props: {}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          flex: 1,
          padding: "15%",
        }}
      >
        <img
          src={BASEURL + "/ROS_fav_256x256.png"}
          style={{
            width: "40vw",
            maxWidth: "200px",
            marginBottom: 30,
            transform: "scale(1.1, 1.1)",
          }}
        />
        <div
          style={{ color: "#ffffff", textAlign: "center" }}
          className={untitledSansRegular.className}
        >
          Please visit{" "}
          <span style={{ textDecoration: "underline" }}>demo.rabbit.tech</span> on
          desktop browser.
        </div>
      </div>
      <div
        style={{ color: "#6c6c6c", fontSize: "0.6em", padding: "16px" }}
        className={untitledSansLight.className}
      >
        © 2023 rabbit inc.
      </div>
    </div>
  )
}

function Os2App(props: { mode: string }) {
  const { mode } = props
  const debugNoBlob = useDebugValueHas("noblob")
  const { getToken } = useAuth()

  const showDebugPanel = useShowDebugPanel()

  const sessionController = useSessionController("/session", mode, "wav")
  const sessionControllerRef = useStateRef(sessionController)
  const sessionControllerBroadcast = useBroadcast(sessionController)
  const mediaStreamRef = useRef<MediaStream>()
  const mediaRecorderRef = useRef<MediaRecorder | any>()

  const connectedState =
    sessionController.phase.kind === "connected"
      ? sessionController.phase.value
      : undefined
  const pushSpotifyClientMessage = useMemo(
    () =>
      connectedState === undefined
        ? undefined
        : (spotifyClientMessage: Os2ClientMessageSpotify) => {
          connectedState.pushClientMessage({
            kind: "json",
            value: {
              spotify: spotifyClientMessage,
            },
          })
        },
    [connectedState]
  )
  const pushSpotifyClientMessageRef = useStateRef(pushSpotifyClientMessage)

  const spotifyServerMessageBroadcast = useMemo(
    () =>
      connectedState === undefined
        ? undefined
        : mapBroadcast(
          connectedState.serverMessageBroadcast,
          (serverMessage) => {
            if (serverMessage.kind !== "json") return undefined
            if (serverMessage.value.spotify === undefined) return undefined
            return serverMessage.value.spotify
          }
        ),
    [connectedState]
  )
  const spotifyServerMessageBroadcastRef = useStateRef(
    spotifyServerMessageBroadcast
  )

  const spotifyLoginStorage = useSpotifyLoginStorage()
  const spotifyLoginStorageRef = useStateRef(spotifyLoginStorage)
  const spotifyLoginStorageBroadcast = useBroadcast(spotifyLoginStorage)
  const spotifyLoginController = useSpotifyLoginController()
  const spotifyLoginControllerRef = useStateRef(spotifyLoginController)
  const spotifyLoginControllerBroadcast = useBroadcast(spotifyLoginController)
  const spotifyPlayerController = useSpotifyPlayerController()
  const spotifyPlayerControllerRef = useStateRef(spotifyPlayerController)
  const spotifyPlayerControllerBroadcast = useBroadcast(spotifyPlayerController)

  const [speaking, setSpeaking] = useState(false)
  const [listening, setListening] = useState(false)
  const [textmodeActive, setTextmodeActive] = useState(false)
  const textmodeActiveRef = useStateRef(textmodeActive)
  const listeningRef = useStateRef(listening)
  const [sessionActive, setSessionActive] = useState(false)
  const playerRef = useRef<Tone.Player | null>(null)
  const playbackAllowedRef = useRef(true)
  const [volume, setVolume] = useState(0.5)
  const volumeRef = useStateRef(volume)
  const [micAvailable, setMicAvailable] = useState(true)

  const [textMessage, setTextMessage] = useState("")
  const [assistantResponse, setAssistantResponse] = useState("")
  const assistantResponseTimeoutRef = useRef<NodeJS.Timeout>()
  const volumeTimeoutRef = useRef<NodeJS.Timeout>()

  const spacePressedRef = useRef<boolean>(false)
  const [spacePressed, setSpacePressed] = useState(false)

  const spotifyPlayerControllerConnected =
    spotifyPlayerController.phase.kind === "connected"
      ? spotifyPlayerController.phase.value
      : undefined

  useEffect(() => {
    const reg = async () => {
      await register(await connect())
    }
    reg().catch(console.log)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: any) => {
      if (event.code === 'Space' && textmodeActiveRef.current === false) {
        console.log("space pressed")
        if (spacePressedRef.current === false) {
          if (sessionControllerRef.current.phase.kind === "connected") {
            sessionControllerRef.current.phase.value.pushClientMessage({
              kind: "json",
              value: {
                kernel: {
                  utteranceMark: true,
                },
              },
            })
          }
        }
        spacePressedRef.current = true;
        flushAudioContext()

        setSpacePressed(true);
      }
    };

    const handleKeyUp = (event: any) => {
      if (event.code === 'Space' && textmodeActiveRef.current === false) {
        console.log("space released")
        spacePressedRef.current = false;
        if (sessionControllerRef.current.phase.kind === "connected") {
          sessionControllerRef.current.phase.value.pushClientMessage({
            kind: "json",
            value: {
              kernel: {
                utteranceMark: false,
              },
            },
          })
        } else {
          console.log("WARNING: session controller not connected")
        }
        setSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [sessionControllerRef])

  useEffect(
    () =>
      runEffectScope(async (scope, cancel) => {
        if (spotifyPlayerControllerConnected === undefined) return
        try {
          await sleepSeconds(scope, 60 * 60 * 3)
          if (
            spotifyPlayerControllerRef.current.phase.kind === "connected" &&
            spotifyPlayerControllerRef.current.phase.value ===
            spotifyPlayerControllerConnected
          ) {
            appendDebugLog(
              spotifyLogStyle,
              "Forcely disconnecting from Spotify due to timeout"
            )
            spotifyPlayerControllerRef.current.phase.value.disconnect()
          }
        } catch (e) { }
      }),
    [spotifyPlayerControllerConnected, spotifyPlayerControllerRef]
  )

  const [screenUnfit, setScreenUnfit] = useState(false)
  const [hideBall, setHideBall] = useState(false)
  const x = 300 // Set the desired width limit
  const y = 500 // Set the desired height limit
  const a = 0.3 // Set the lower bound for aspect ratio
  const b = 2.5 // Set the upper bound for aspect ratio

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      const aspectRatio = width / height

      if (width < x || height < y || aspectRatio < a || aspectRatio > b) {
        setScreenUnfit(true)
      } else {
        setScreenUnfit(false)
      }
    }

    window.addEventListener("resize", handleResize)

    // Call the function initially to set the state based on the initial window size
    handleResize()

    // Clean up the event listener when the component is unmounted
    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [x, y, a, b])

  useEffect(() => {
    const handleResize = () => {
      const height = window.innerHeight
      //console.log(height)
      if (height < 550) {
        setHideBall(true)
      } else {
        setHideBall(false)
      }
    }

    window.addEventListener("resize", handleResize)

    // Call the function initially to set the state based on the initial window size
    handleResize()

    // Clean up the event listener when the component is unmounted
    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [])

  useEffect(() => {
    if (connectedState === undefined) {
      return
    }
    connectedState.pushClientMessage({
      kind: "json",
      value: {
        spotify: {
          logInStatus: {
            storageAvailable: spotifyLoginStorage !== undefined,
          },
        },
      },
    })
  }, [connectedState, pushSpotifyClientMessageRef, spotifyLoginStorage])

  const audioPlay = useMemo(
    () =>
      async (
        buffer: string | ArrayBuffer,
        gain?: number,
        loop?: boolean,
        force?: boolean
      ) => {
        gain = gain || 1
        loop = loop || false
        force = force || false

        if (buffer && (force || listeningRef.current)) {
          const audioBuffer = await audioLoad(buffer)
          const player = new Tone.Player(audioBuffer)
          if (gain != 1) {
            const gainNode = new Tone.Gain(gain).toDestination()
            player.connect(gainNode)
          } else {
            player.toDestination()
          }
          await Tone.loaded()
          if (playerRef.current !== null) {
            playerRef.current.mute = true
            playerRef.current.stop()
            Tone.Transport.stop()
          }
          playerRef.current = player
          player.start()
          const previousVolume = volumeRef.current
          setVolume(0.1)
          if (volumeTimeoutRef.current !== undefined) {
            clearTimeout(volumeTimeoutRef.current)
          }
          volumeTimeoutRef.current = setTimeout(() => {
            setVolume(previousVolume)
          }, audioBuffer.duration * 1000 * 1.2)
        }
      },
    [listeningRef, volumeTimeoutRef]
  )

  useEffect(
    () =>
      runEffectScope(async (scope) => {
        if (!sessionActive) {
          return
        }
        const token = await getToken({ template: "test" })
        if (token === null) {
          console.log("token is null")
          return
        }
        if (sessionControllerRef.current.phase.kind !== "none") {
          console.log("Invalid session controller state")
          return
        }
        sessionControllerRef.current.phase.value.connect(token, listeningRef.current)
        sessionControllerBroadcast.listen(scope, () => {
          launchBackgroundScope(scope, async (scope) => {
            await sleepSeconds(scope, 1)
            if (sessionControllerRef.current.phase.kind === "none") {
              sessionControllerRef.current.phase.value.connect(token, listeningRef.current)
            }
          })
        })
        scope.onLeave(async () => {
          if (sessionControllerRef.current.phase.kind !== "none") {
            sessionControllerRef.current.phase.value.disconnect()
          }
        })
        await audioPlay(
          "https://storage.googleapis.com/quantum-engine-public/audio/OS2_INTRO_3s.mp3",
          0.5,
          false,
          true
        )
        await sleepUntilCancel(scope)
      }),
    [
      sessionActive,
      getToken,
      sessionControllerRef,
      sessionControllerBroadcast,
      audioPlay,
    ]
  )

  async function getDefaultOutputDevice() {
    const devices = await navigator.mediaDevices.enumerateDevices()
    const defaultOutputDevice = devices.find(
      (device) => device.kind === "audiooutput" && device.deviceId === "default"
    )
    return defaultOutputDevice
  }

  async function getDefaultInputDevice() {
    const devices = await navigator.mediaDevices.enumerateDevices()
    const defaultInputDevice = devices.find(
      (device) => device.kind === "audioinput" && device.deviceId === "default"
    )
    return defaultInputDevice
  }

  useEffect(() => {
    // disable on mobile
    if (
      !/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      ) &&
      navigator.mediaDevices !== undefined
    ) {
      navigator.mediaDevices.ondevicechange = async (event) => {
        console.log("device change")
        Tone.Transport.stop()
        Tone.start()

        const mediaStream =
          spotifyPlayerControllerRef.current.phase.kind === "connected"
            ? spotifyPlayerControllerRef.current.phase.value.mediaStream
            : undefined

        if (mediaStream !== undefined) {
          // Get the new default output device
          const defaultOutputDevice = await getDefaultOutputDevice()
          // Set the new output device for each audio track in the media stream
          mediaStream.getAudioTracks().forEach((audioTrack) => {
            audioTrack.applyConstraints({
              deviceId: defaultOutputDevice?.deviceId,
            })
          })
        }

        if (
          mediaStreamRef.current !== undefined &&
          connectedState !== undefined
        ) {
          // Get the new default input device
          const defaultInputDevice = await getDefaultInputDevice()
          console.log("defaultInputDevice", defaultInputDevice)
          runEffectScope(async (scope) => {
            if (mediaStreamRef.current !== undefined) {
              mediaRecorderRef.current?.stop()
            }
            const results = await streamAudioToServer(
              scope,
              connectedState.pushClientMessage,
              "wav",
              listeningRef,
              spacePressedRef,
              defaultInputDevice?.deviceId
            )
            mediaStreamRef.current = results.ms
            mediaRecorderRef.current = results.mr
          })
        }
      }
    }
  }, [spotifyLoginControllerRef, connectedState, mediaStreamRef])

  const flushAudioContext = useCallback(() => {
    Tone.Transport.stop()
    if (playerRef.current) {
      playerRef.current.mute = true
      playerRef.current.stop()
      playerRef.current = null
    }
  }, [playerRef])

  const playSpotifyUriWithName = useCallback(
    async (scope: Scope, spotifyUri: string, name: string) => {
      if (
        pushSpotifyClientMessageRef.current === undefined ||
        spotifyServerMessageBroadcastRef.current === undefined
      ) {
        console.log(
          "Cannot play anything yet because connection is not established"
        )
        return
      }
      const spotifyLoginStorage = await (async () => {
        if (spotifyLoginStorageRef.current === undefined) {
          appendDebugLog(
            spotifyLogStyle,
            "You haven't logged into Spotify yet. Allocating your Spotify Login."
          )
          const spotifyLoginStorageSignal = new SignalController<string>()
          spotifyLoginStorageBroadcast.listen(scope, (spotifyLoginStorage) => {
            if (spotifyLoginStorage !== undefined) {
              if (spotifyLoginStorageSignal.get().kind === "pending") {
                spotifyLoginStorageSignal.emit(spotifyLoginStorage)
              }
            }
          })
          if (
            spotifyLoginControllerRef.current.phase.kind === "none" ||
            spotifyLoginControllerRef.current.phase.kind === "loginComplete"
          ) {
            spotifyLoginControllerRef.current.phase.value.initiate(
              abortIfUndefined(pushSpotifyClientMessageRef.current),
              abortIfUndefined(spotifyServerMessageBroadcastRef.current)
            )
          }
          appendDebugLog(
            spotifyLogStyle,
            "Now it's your turn. Please log into Spotify."
          )
          return await spotifyLoginStorageSignal.waitUntilReady(scope)
        } else {
          return spotifyLoginStorageRef.current
        }
      })()
      const controllerConnected = await (async () => {
        if (spotifyPlayerControllerRef.current.phase.kind !== "connected") {
          appendDebugLog(spotifyLogStyle, "Allocating your Spotify Player.")
          const playerControlHandlerSignal =
            new SignalController<SpotifyPlayerControllerConnected>()
          spotifyPlayerControllerBroadcast.listen(
            scope,
            (spotifyPlayerController) => {
              if (spotifyPlayerController.phase.kind === "connected") {
                if (playerControlHandlerSignal.get().kind === "pending") {
                  playerControlHandlerSignal.emit(
                    spotifyPlayerController.phase.value
                  )
                }
              }
            }
          )
          if (spotifyPlayerControllerRef.current.phase.kind === "none") {
            spotifyPlayerControllerRef.current.phase.value.connect(
              spotifyLoginStorage,
              abortIfUndefined(pushSpotifyClientMessageRef.current),
              abortIfUndefined(spotifyServerMessageBroadcastRef.current)
            )
          }
          const controllerConnected =
            await playerControlHandlerSignal.waitUntilReady(scope)
          appendDebugLog(
            debugLogStyle,
            `Your Spotify Player is ready. It's at: ${controllerConnected.debugNoVncUrl}`
          )
          return controllerConnected
        } else {
          return spotifyPlayerControllerRef.current.phase.value
        }
      })()
      appendDebugLog(
        spotifyLogStyle,
        `Spotify Player starts playing [${name}]. Enjoy!`
      )
      controllerConnected.handlePlayerControl({
        playSpotifyUriWithName: {
          spotifyUri,
          name,
        },
      })
      await sleepUntilCancel(scope)
    },
    [
      pushSpotifyClientMessageRef,
      spotifyServerMessageBroadcastRef,
      spotifyLoginStorageRef,
      spotifyLoginStorageBroadcast,
      spotifyLoginControllerRef,
      spotifyPlayerControllerRef,
      spotifyPlayerControllerBroadcast,
    ]
  )

  const playSpotifyLikedSong = useCallback(
    async (scope: Scope) => {
      if (
        pushSpotifyClientMessageRef.current === undefined ||
        spotifyServerMessageBroadcastRef.current === undefined
      ) {
        console.log(
          "Cannot play anything yet because connection is not established"
        )
        return
      }
      const spotifyLoginStorage = await (async () => {
        if (spotifyLoginStorageRef.current === undefined) {
          appendDebugLog(
            spotifyLogStyle,
            "You haven't logged into Spotify yet. Allocating your Spotify Login."
          )
          const spotifyLoginStorageSignal = new SignalController<string>()
          spotifyLoginStorageBroadcast.listen(scope, (spotifyLoginStorage) => {
            if (spotifyLoginStorage !== undefined) {
              if (spotifyLoginStorageSignal.get().kind === "pending") {
                spotifyLoginStorageSignal.emit(spotifyLoginStorage)
              }
            }
          })
          if (
            spotifyLoginControllerRef.current.phase.kind === "none" ||
            spotifyLoginControllerRef.current.phase.kind === "loginComplete"
          ) {
            spotifyLoginControllerRef.current.phase.value.initiate(
              abortIfUndefined(pushSpotifyClientMessageRef.current),
              abortIfUndefined(spotifyServerMessageBroadcastRef.current)
            )
          }
          appendDebugLog(
            spotifyLogStyle,
            "Now it's your turn. Please log into Spotify."
          )
          return await spotifyLoginStorageSignal.waitUntilReady(scope)
        } else {
          return spotifyLoginStorageRef.current
        }
      })()
      const playerControlHandler: (
        playerControl: Os2SpotifyPlayerControl
      ) => void = await (async () => {
        if (spotifyPlayerControllerRef.current.phase.kind !== "connected") {
          appendDebugLog(spotifyLogStyle, "Allocating your Spotify Player.")
          const playerControlHandlerSignal = new SignalController<
            (playerControl: Os2SpotifyPlayerControl) => void
          >()
          spotifyPlayerControllerBroadcast.listen(
            scope,
            (spotifyPlayerController) => {
              console.log("Spotify Player Controller", spotifyPlayerController)
              if (spotifyPlayerController.phase.kind === "connected") {
                if (playerControlHandlerSignal.get().kind === "pending") {
                  playerControlHandlerSignal.emit(
                    spotifyPlayerController.phase.value.handlePlayerControl
                  )
                }
              }
            }
          )
          if (spotifyPlayerControllerRef.current.phase.kind === "none") {
            spotifyPlayerControllerRef.current.phase.value.connect(
              spotifyLoginStorage,
              abortIfUndefined(pushSpotifyClientMessageRef.current),
              abortIfUndefined(spotifyServerMessageBroadcastRef.current)
            )
          }
          console.log("Waiting for Spotify Player to be connected")
          return await playerControlHandlerSignal.waitUntilReady(scope)
        } else {
          return spotifyPlayerControllerRef.current.phase.value
            .handlePlayerControl
        }
      })()
      appendDebugLog(
        spotifyLogStyle,
        `Controllig your Spotify Player to play your liked songs.`
      )
      playerControlHandler({
        playLikedSongs: {},
      })
      await sleepUntilCancel(scope)
    },
    [
      pushSpotifyClientMessageRef,
      spotifyServerMessageBroadcastRef,
      spotifyLoginStorageRef,
      spotifyLoginStorageBroadcast,
      spotifyLoginControllerRef,
      spotifyPlayerControllerRef,
      spotifyPlayerControllerBroadcast,
    ]
  )

  const playSpotifyQuery = useCallback(
    async (scope: Scope, spotifyQuery: string) => {
      if (
        pushSpotifyClientMessageRef.current === undefined ||
        spotifyServerMessageBroadcastRef.current === undefined
      ) {
        console.log(
          "Cannot play anything yet because connection is not established"
        )
        return
      }
      const spotifyLoginStorage = await (async () => {
        if (spotifyLoginStorageRef.current === undefined) {
          appendDebugLog(
            spotifyLogStyle,
            "You haven't logged into Spotify yet. Allocating your Spotify Login."
          )
          const spotifyLoginStorageSignal = new SignalController<string>()
          spotifyLoginStorageBroadcast.listen(scope, (spotifyLoginStorage) => {
            if (spotifyLoginStorage !== undefined) {
              if (spotifyLoginStorageSignal.get().kind === "pending") {
                spotifyLoginStorageSignal.emit(spotifyLoginStorage)
              }
            }
          })
          if (
            spotifyLoginControllerRef.current.phase.kind === "none" ||
            spotifyLoginControllerRef.current.phase.kind === "loginComplete"
          ) {
            spotifyLoginControllerRef.current.phase.value.initiate(
              abortIfUndefined(pushSpotifyClientMessageRef.current),
              abortIfUndefined(spotifyServerMessageBroadcastRef.current)
            )
          }
          appendDebugLog(
            spotifyLogStyle,
            "Now it's your turn. Please log into Spotify."
          )
          return await spotifyLoginStorageSignal.waitUntilReady(scope)
        } else {
          return spotifyLoginStorageRef.current
        }
      })()
      const controllerConnected = await (async () => {
        if (spotifyPlayerControllerRef.current.phase.kind !== "connected") {
          appendDebugLog(spotifyLogStyle, "Allocating your Spotify Player.")
          const playerControlHandlerSignal =
            new SignalController<SpotifyPlayerControllerConnected>()
          spotifyPlayerControllerBroadcast.listen(
            scope,
            (spotifyPlayerController) => {
              if (spotifyPlayerController.phase.kind === "connected") {
                if (playerControlHandlerSignal.get().kind === "pending") {
                  playerControlHandlerSignal.emit(
                    spotifyPlayerController.phase.value
                  )
                }
              }
            }
          )
          if (spotifyPlayerControllerRef.current.phase.kind === "none") {
            spotifyPlayerControllerRef.current.phase.value.connect(
              spotifyLoginStorage,
              abortIfUndefined(pushSpotifyClientMessageRef.current),
              abortIfUndefined(spotifyServerMessageBroadcastRef.current)
            )
          }
          const controllerConnected =
            await playerControlHandlerSignal.waitUntilReady(scope)
          appendDebugLog(
            debugLogStyle,
            `Your Spotify Player is ready. It's at: ${controllerConnected.debugNoVncUrl}`
          )
          return controllerConnected
        } else {
          return spotifyPlayerControllerRef.current.phase.value
        }
      })()
      appendDebugLog(
        spotifyLogStyle,
        `Spotify Player starts playing [${spotifyQuery}]. Enjoy!`
      )
      controllerConnected.handlePlayerControl({
        playSearchTop: {
          query: spotifyQuery,
        },
      })
      await sleepUntilCancel(scope)
    },
    [
      pushSpotifyClientMessageRef,
      spotifyServerMessageBroadcastRef,
      spotifyLoginStorageRef,
      spotifyLoginStorageBroadcast,
      spotifyLoginControllerRef,
      spotifyPlayerControllerRef,
      spotifyPlayerControllerBroadcast,
    ]
  )

  const elementRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (elementRef.current !== null) {

      const animateScroll = (duration: number) => {
        if (elementRef.current === null) {
          return;
        }
        var start = elementRef.current.scrollTop;
        var end = elementRef.current.scrollHeight;
        var change = end - start;
        var increment = 20;
        const easeInOut = (currentTime: number, start: number, change: number, duration: number) => {
          // by Robert Penner
          currentTime /= duration / 2;
          if (currentTime < 1) {
            return change / 2 * currentTime * currentTime + start;
          }
          currentTime -= 1;
          return -change / 2 * (currentTime * (currentTime - 2) - 1) + start;
        }
        const animate = (elapsedTime: number) => {
          elapsedTime += increment;
          var position = easeInOut(elapsedTime, start, change, duration);
          if (elementRef.current === null) {
            return;
          }
          elementRef.current.scrollTop = position;
          if (elapsedTime < duration) {
            setTimeout(function () {
              animate(elapsedTime);
            }, increment)
          }
        }
        animate(0);
      }

      animateScroll(assistantResponse.length * 75);

    }
  }, [assistantResponse])

  useEffect(
    () =>
      runEffectScope(async (scope) => {
        if (connectedState === undefined) return
        const handleControlMessage = (serverMessage: Os2ServerMessage) => {
          console.log("Received server message", serverMessage)
          const assistantResponseMsg: string | undefined =
            serverMessage.kernel?.assistantResponse
          if (assistantResponseMsg !== undefined) {
            if (assistantResponseTimeoutRef.current !== undefined) {
              clearTimeout(assistantResponseTimeoutRef.current)
            }
            setAssistantResponse(assistantResponseMsg)
            assistantResponseTimeoutRef.current = setTimeout(() => {
              setAssistantResponse("")
            }, 40 * 1000)
          }
          const debugChat = serverMessage.kernel?.debugChat
          if (debugChat !== undefined) {
            appendDebugLog(
              assistantChatLogStyle,
              `${debugChat.assistantName}: ${debugChat.assistantResponse}`
            )
          }
          if (serverMessage.speechRecognizing) {
            flushAudioContext()
            playbackAllowedRef.current = false
          }
          if (serverMessage.speechRecognized) {
            appendDebugLog(
              userChatLogStyle,
              `You say: ${serverMessage.speechRecognized.text}`
            )
            setSpeaking(true)
            //console.log(speaking);
            setTimeout(() => {
              setSpeaking(false)
            }, 5000)
            playbackAllowedRef.current = true
          }
          const playSpotifyList = serverMessage.kernel?.playSpotifyList
          if (playSpotifyList !== undefined) {
            appendDebugLog(
              spotifyLogStyle,
              `You asked to play: [${playSpotifyList[0]?.name ?? "(nothing?)"}]`
            )
            const spotifyUri = playSpotifyList[0]?.uri
            const name = playSpotifyList[0]?.name
            if (spotifyUri !== undefined && name !== undefined) {
              flyingPromise(async () => {
                await Scope.with(undefined, [], async (scope) => {
                  await playSpotifyUriWithName(scope, spotifyUri, name)
                })
              })
            }
          }
          const playSpotifyLikedSongMsg =
            serverMessage.kernel?.playSpotifyLikedSong
          if (playSpotifyLikedSongMsg !== undefined) {
            appendDebugLog(
              spotifyLogStyle,
              `You asked to play your liked songs.`
            )
            flyingPromise(async () => {
              await Scope.with(undefined, [], async (scope) => {
                await playSpotifyLikedSong(scope)
              })
            })
          }
          const playSpotifyQueryMsg = serverMessage.kernel?.playSpotifyQuery
          if (playSpotifyQueryMsg !== undefined) {
            appendDebugLog(
              spotifyLogStyle,
              `You asked to play: [${playSpotifyQueryMsg}]`
            )
            flyingPromise(async () => {
              await Scope.with(undefined, [], async (scope) => {
                await playSpotifyQuery(scope, playSpotifyQueryMsg)
              })
            })
          }
        }
        const { serverMessageBroadcast } = connectedState
        serverMessageBroadcast.listen(scope, (message) => {
          if (message.kind === "json") {
            handleControlMessage(message.value)
          } else {
            audioPlay(message.value.buffer)
          }
        })
        const results = await streamAudioToServer(
          scope,
          connectedState.pushClientMessage,
          "wav",
          listeningRef,
          spacePressedRef
        )
        mediaStreamRef.current = results.ms
        mediaRecorderRef.current = results.mr
        await sleepUntilCancel(scope)
      }),
    [
      connectedState,
      flushAudioContext,
      playbackAllowedRef,
      audioPlay,
      playSpotifyUriWithName,
    ]
  )

  const handleMicActive = () => {
    appendDebugLog(userActionLogStyle, `listening => ${!listening}`)
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        if (connectedState !== undefined) {
          connectedState.pushClientMessage({
            kind: "json",
            value: {
              kernel: {
                listening: !listening,
              },
            },
          })
        }
        setListening(!listening)
        if (!sessionActive) {
          setSessionActive(true)
          Tone.start()
          return
        }
        if (listening) {
          flushAudioContext()
        }
        setMicAvailable(true)
      })
      .catch((err) => {
        appendDebugLog(userActionLogStyle, `Mic error => ${err}`)
        setMicAvailable(false)
        setAssistantResponse(
          "Please make sure you have a functional microphone, or allow microphone access in your browser settings."
        )
      })
  }

  const handleTextmodeActive = () => {
    appendDebugLog(userActionLogStyle, `textmodeActive => ${!textmodeActive}`)
    setTextmodeActive(!textmodeActive)
    if (!sessionActive) {
      setSessionActive(true)
      Tone.start()
      flushAudioContext()
      return
    }
  }

  const handleVolumeChange = (volume: number) => {
    setVolume(volume)
  }

  const handleTextMessage = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTextMessage(e.target.value.replace("\n", "") ?? "")
  }

  const handleOnKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (connectedState === undefined) return
    if (e.key === "Enter") {
      e.preventDefault()
      var text = textMessage.trim()
      appendDebugLog(userChatLogStyle, `You type: ${text}`)
      if (connectedState !== undefined) {
        connectedState.pushClientMessage({
          kind: "json",
          value: {
            kernel: {
              userText: {
                text,
              },
            },
          },
        })
      } else {
        console.log(
          `Cannot send message yet because connection is not established: ${text}`
        )
      }
      setTextMessage("")
    }
  }

  useEffect(() => {
    console.log(`
                                                  
                                                  
                          !.                      
                       .Y@@?                      
                     .P@@@@?  !&B                 
                    !@@@@@@!7&@@&                 
                    J@@@@5P&@@@@&                 
                 .~!B@@J  @@@@@B:                 
             .7G&@@@@@@&GY@@@P.                   
           ^&@@@@@@@@@@@@@@@J                     
           ?@@@@@@@@@@@@@@@@P                     
           7@@&@@@@@@@@@@@@@5                     
           ^&&J#@@5B@@@@@@@@#J7:                  
             .7B&@@@@@@@@@@@@@@@@B7.              
           .5#&&&B7!@@@@@@@@@@@@@@@@&             
           J@@@@@@^ @@@@@@@@@@@@@@@@@.            
            ^JGG?~#@@@@@@@@@@@@@@@@@@J.           
                  #@@@@@@@@@@@@@@@@@@@@^          
                 :?#@@@@@@@@@@@@@@@@@&5.          
                B@@@@@@@@@@@@@@@@@@@#             
                !#@@@&Y#@@@@@@@@&G!.              
                   ..  &@@@@@@7:                  
                       ~P&@&P~                    
                                                  
                                                  
    intuitive/sensitive/obessive
    info@rabbit.tech


`)
  }, [])

  /*
{!/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
            navigator.userAgent
          ) && (
            <a
              href="https://n21r7yj4cqg.typeform.com/os2-feedback"
              target="_blank"
            >
              <img
                height={20}
                style={{
                  marginTop: 20,
                }}
                src={BASEURL + "/feedback_button_white.png"}
              ></img>
            </a>
          )}
  */

  return !/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  ) ? (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        backgroundColor: "#000000",
      }}
    >
      {!debugNoBlob && (
        <Rabbit
          hide={hideBall}
          loggedIn={listening}
          playerPanel={
            connectedState !== undefined &&
            pushSpotifyClientMessage !== undefined &&
            spotifyServerMessageBroadcast !== undefined &&
            spotifyLoginStorage !== undefined &&
            spotifyPlayerController.phase.kind === "connected" &&
            spotifyPlayerController.phase.value.playerStatus !== undefined
          }
          speaking={speaking}
          thinking={false}
        />
      )}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
        }}
      >
        <div
          style={{
            flex: 1,
          }}
        ></div>
        {connectedState !== undefined &&
          pushSpotifyClientMessage !== undefined &&
          spotifyServerMessageBroadcast !== undefined && (
            <SpotifyLoginPanel
              controller={spotifyLoginController}
              pushClientMessage={pushSpotifyClientMessage}
              serverMessageBroadcast={spotifyServerMessageBroadcast}
            />
          )}
        {connectedState !== undefined &&
          pushSpotifyClientMessage !== undefined &&
          spotifyServerMessageBroadcast !== undefined &&
          spotifyLoginStorage !== undefined && (
            <SpotifyPlayerPanel
              controller={spotifyPlayerController}
              spotifyLoginStorage={spotifyLoginStorage}
              timeOffsetSeconds={sessionController.timeOffsetSeconds}
              pushClientMessage={pushSpotifyClientMessage}
              serverMessageBroadcast={spotifyServerMessageBroadcast}
              onVolumeChange={handleVolumeChange}
              volume={volume}
              listening={true}
            />
          )}
        {!screenUnfit && (
          <textarea
            role="textbox"
            aria-label="user request"
            style={{
              backgroundColor: "#000000",
              fontSize: 18,
              outline: "none",
              borderTop: "0",
              borderLeft: "0",
              borderRight: "0",
              borderBottom: "1.5px solid #ffffff",
              padding: 8,
              textAlign: "center",
              verticalAlign: "middle",
              color: "#dce3e5",
              overflowX: "scroll",
              overflowY: "hidden",
              whiteSpace: "nowrap",
              height: "20px",
              minHeight: "20px",
              lineHeight: "20px",
              width: "30%",
              opacity: textmodeActive ? 1 : 0,
              transition: "all 0.5s",
              marginBottom: "6%",
              marginTop: "0%",
              display: "inline",
              cursor: textmodeActive ? "auto" : "default",
            }}
            readOnly={!textmodeActive}
            value={textMessage}
            className={`textMessage ${powerGroteskRegular.className}`}
            onChange={handleTextMessage}
            onKeyDown={handleOnKeyDown}
          ></textarea>
        )}
        <div
          className={`assistantResponse ${powerGroteskRegular.className}`}
          id={"assistantResponse"}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            position: "absolute",
            bottom: "65%",
            backgroundColor: "transparent",
            fontSize: 17,
            color: "#ffffff",
            maxWidth: "45%",
            minHeight: "10%",
            textAlign: "center",
          }}
        >
          <div
            style={{
              position: "absolute",
              opacity: assistantResponse.trim()?.length > 0 ? 1 : 0,
              top: "2px",
              height: 3,
              width: "90%",
              borderTop: "10px solid #000",
              zIndex: 2,
            }}
          ></div>
          <div
            role="alert"
            aria-label="assistant response"
            aria-live="polite"
            className="assistantResponseContent"
            ref={elementRef}
            style={{
              zIndex: 0,
              borderRadius: 8,
              border: assistantResponse.trim()?.length > 0 ? "2px solid #ffffff" : "none",
              overflowY: "scroll",
            }}
          >
            <p
              style={{
                margin: "20px",
                maxHeight: "100%",
                zIndex: 0,
              }}
            >{assistantResponse}</p>
          </div>
          <div
            style={{
              transform: "translateY(-12px)",
              opacity: assistantResponse.trim()?.length > 0 ? 1 : 0,
              height: 3,
              width: "90%",
              borderTop: "10px solid #000",
              zIndex: 4,
            }}
          ></div>
          <div
            style={{
              opacity: assistantResponse.trim()?.length > 0 ? 1 : 0,
              zIndex: 3,
              transform: "translateY(-15px)",
            }}
          >
            <div style={{
              width: '0',
              height: '0',
              borderLeft: '18px solid transparent',
              borderRight: '18px solid transparent',
              borderTop: '18px solid #fff'
            }}></div>
            <div style={{
              position: 'relative',
              top: '-22px',
              left: '2px',
              width: '0',
              height: '0',
              borderLeft: '16px solid transparent',
              borderRight: '16px solid transparent',
              borderTop: '16px solid #000'
            }}></div>
          </div>
        </div>
        <div style={{ height: 40 }}></div>
        <div
          style={{
            position: "absolute",
            bottom: "2%",
            left: "2%",
            display: "flex",
            flexDirection: "row",
            opacity: screenUnfit ? 0 : 1,
          }}
        >
          {listening ? (
            <img
              width={40}
              style={{
                cursor: "pointer",
                marginLeft: 10,
                marginRight: 5,
                marginBottom: 3,
                opacity: micAvailable ? 1 : 0.5,
              }}
              src="https://storage.googleapis.com/rabbit-public/svg/rabbit_os_assets_switches__mic_on.svg"
              onClick={handleMicActive}
            ></img>
          ) : (
            <img
              width={40}
              style={{
                cursor: "pointer",
                marginLeft: 10,
                marginRight: 5,
                marginBottom: 3,
                opacity: micAvailable ? 1 : 0.5,
              }}
              src="https://storage.googleapis.com/rabbit-public/svg/rabbit_os_assets_switches__mic_off.svg"
              onClick={handleMicActive}
            ></img>
          )}
        </div>
        <div
          style={{
            position: "absolute",
            bottom: "2%",
            display: "flex",
            textAlign: "center",
            color: "#ffffff",
            zIndex: 1,
          }}
          className={`${powerGroteskRegular.className}`}
        >
          <img width={175} src="https://storage.googleapis.com/rabbit-public/png/rabbit_os_demo.png"></img>
        </div>
        <div
          style={{
            position: "absolute",
            bottom: "2%",
            right: "2%",
            display: "flex",
            flexDirection: "row",
            opacity: screenUnfit ? 0 : 1,
          }}
        >
        </div>
        <div style={{ height: 40 }}></div>
        {false && <Modal listening={listening} mode={mode} />}
        <div style={{ height: 20 }}></div>
      </div>
      {showDebugPanel && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
            position: "absolute",
            backgroundColor: "rgba(0,0,0,0.1)",
            borderRadius: 8,
            top: "4%",
            bottom: "4%",
            left: "2%",
            right: "60%",
            color: "rgba(0, 0, 0, 0.9)",
            padding: "16px",
          }}
        >
          <LogPanel />
        </div>
      )}
    </div>
  ) : (
    <MobilePanel />
  )
}

function AppMeta(props: { mode: string }) {
  const { user } = useUser()
  console.log(user)
  const { isLoading, error, data } = useQuery({
    queryKey: ["meta"],
    queryFn: async () => {
      const url =
        window.location.hostname === "localhost"
          ? "https://dev.rabbit.tech/meta"
          : "/meta"
      const res = await fetch(url)
      return commonNormalizer(metaResponseType, await res.json())
    },
    refetchInterval: 1000 * 60,
    refetchIntervalInBackground: true,
  })
  if (isLoading) return null
  return <Os2App mode={props.mode} />
  // if (
  //   data === undefined ||
  //   data.serviceUp ||
  //   user?.emailAddresses.some(
  //     (emailAddress) =>
  //       emailAddress.emailAddress === "dev-test1+os2@cybermanufacture.co"
  //   ) === true
  // ) {
  //   return <Os2App mode={props.mode} />
  // }
  // return <Unavailable listening={false} mode={props.mode} />
}

export default function App(props: { mode: string }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AppMeta mode={props.mode} />
    </QueryClientProvider>
  )
}
