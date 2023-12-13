import Image from "next/image"

import styles from "./SpotifyTrack.module.css"
import rollingStyles from "./RollingText.module.css"

import albumIcon from "./icons/album.svg"
import previousIcon from "./icons/previous.svg"
import nextIcon from "./icons/next.svg"
import repeatOffIcon from "./icons/repeat-off.svg"
import repeatTrackIcon from "./icons/repeat-track.svg"
import repeatContextIcon from "./icons/repeat-context.svg"
import playIcon from "./icons/play.svg"
import pauseIcon from "./icons/pause.svg"
import shuffleOffIcon from "./icons/shuffle-off.svg"
import shuffleOnIcon from "./icons/shuffle-on.svg"
import spotifyIcon from "./icons/spotify.svg"
import volumeL1Icon from "./icons/OS2_Spotify_Volume_lvl1.svg"
import volumeL2Icon from "./icons/OS2_Spotify_Volume_lvl2.svg"
import volumeL3Icon from "./icons/OS2_Spotify_Volume_lvl3.svg"
import volumeNoSoundIcon from "./icons/OS2_Spotify_Volume_NoSound.svg"
import progressPointerIcon from "./icons/progress-pointer.svg"
import {
  Os2SpotifyPlayerControl,
  Os2SpotifyPlayerStatus,
} from "cm-rabbit-common/lib/spotify/spotify.js"

import { useCurrentTime } from "../utils/hooks"
import { useEffect, useRef, useState } from "react"
import {
  fontAvenirNextBold,
  fontAvenirNextMedium,
  fontAvenirNextRegular,
} from "../../app/fonts/fonts"

function SpotifyPlayerProgressBar(props: {
  playedSeconds: number
  durationSeconds: number
  onSeek: (playedRatio: number) => void
}) {
  const realPlayedSeconds = Math.min(
    props.durationSeconds,
    Math.max(0, props.playedSeconds)
  )
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.buttons !== 1) return
    const { x, width } = e.currentTarget.getBoundingClientRect()
    const value = (e.clientX - x) / width
    props.onSeek(Math.min(Math.max(value, 0), 1))
    e.preventDefault()
  }
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: 6,
          justifyContent: "space-between",
          height: "10px",
          fontWeight: 500,
        }}
      >
        <div className={fontAvenirNextRegular.className}>
          {secondsToText(realPlayedSeconds)}
        </div>
        <div className={fontAvenirNextRegular.className}>
          {secondsToText(props.durationSeconds)}
        </div>
      </div>
      <div
        style={{
          height: "18px",
        }}
      >
        <div
          style={{
            height: "6px",
            display: "flex",
            alignItems: "center",
          }}
          onMouseDown={handleSeek}
          onMouseMove={handleSeek}
        >
          <div
            style={{
              flex: 1,
              height: "2px",
              borderRadius: "1px",
              backgroundColor: "rgb(218, 229, 232)",
              display: "flex",
              alignItems: "center",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${(realPlayedSeconds / props.durationSeconds) * 100}%`,
                backgroundColor: "#ffffff",
              }}
            ></div>
            {/* <div
              style={{
                position: "relative",
                width: 0,
                height: 0,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Image
                style={{ position: "absolute" }}
                src={progressPointerIcon}
                alt=""
              />
            </div> */}
          </div>
        </div>
      </div>
    </div>
  )
}

function SpotifyPlayerImageButton(props: {
  imageSrc: string
  alt: string
  onClick: () => void
}) {
  return (
    <button
      style={{
        border: "none",
        background: "transparent",
        marginTop: 0, // TODO: remove this line once we delete the global styling in Intro.css
        width: "auto", // TODO: remove this line once we delete the global styling in Intro.css
      }}
      onClick={() => props.onClick()}
    >
      <Image priority src={props.imageSrc} alt={props.alt} />
    </button>
  )
}

function SpotifyPlayerControlBar(props: {
  playing: boolean
  shuffle: boolean
  repeatMode: string
  onShuffleChange: () => void
  onSkipToPrevious: () => void
  onSkipToNext: () => void
  onPlayChange: () => void
  onRepeatModeChange: () => void
  volume: number
  onVolumeChange: (volume: number) => void
}) {
  const [volumeShow, setVolumeShow] = useState(false)

  const volumeIcon =
    props.volume <= 0
      ? volumeNoSoundIcon
      : props.volume <= 0.33
      ? volumeL1Icon
      : props.volume <= 0.66
      ? volumeL2Icon
      : volumeL3Icon

  const handleVolumeChange = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.buttons !== 1) return
    const { y, height } = e.currentTarget.getBoundingClientRect()
    const value = 1 - (e.clientY - y) / height
    const v = Math.min(Math.max(value, 0), 1)
    props.onVolumeChange(v <= 0.1 ? 0 : v >= 0.9 ? 1 : v)
    e.preventDefault()
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-around",
        height: "32px",
      }}
    >
      <SpotifyPlayerImageButton
        imageSrc={props.shuffle ? shuffleOnIcon : shuffleOffIcon}
        alt="Shuffle"
        onClick={props.onShuffleChange}
      />
      <SpotifyPlayerImageButton
        imageSrc={previousIcon}
        alt="Skip to Previous"
        onClick={props.onSkipToPrevious}
      />
      <SpotifyPlayerImageButton
        imageSrc={props.playing ? pauseIcon : playIcon}
        alt="Toggle Play"
        onClick={props.onPlayChange}
      />
      <SpotifyPlayerImageButton
        imageSrc={nextIcon}
        alt="Skip to Next"
        onClick={props.onSkipToNext}
      />
      <SpotifyPlayerImageButton
        imageSrc={
          props.repeatMode === "track"
            ? repeatTrackIcon
            : props.repeatMode === "context"
            ? repeatContextIcon
            : repeatOffIcon
        }
        alt="Repeat Mode"
        onClick={props.onRepeatModeChange}
      />
      <div
        onMouseEnter={() => setVolumeShow(true)}
        onMouseLeave={() => setVolumeShow(false)}
        style={{
          position: "relative",
        }}
      >
        <Image
          style={{ position: "relative", zIndex: 1, pointerEvents: "none" }}
          src={volumeIcon}
          alt="Audio Volume"
        />
        {volumeShow && (
          <div
            style={{
              position: "absolute",
              borderRadius: "6px",
              left: -6,
              right: -4,
              bottom: 14,
              top: -56,
              backgroundColor: "#ffffff",
              paddingTop: 10,
            }}
          >
            <div
              style={{
                width: "100%",
                height: 50,
                display: "flex",
                alignItems: "center",
                flexDirection: "column",
              }}
              onMouseDown={handleVolumeChange}
              onMouseMove={handleVolumeChange}
            >
              <div
                style={{
                  flex: 1,
                  width: "2px",
                  borderRadius: "1px",
                  backgroundColor: "rgb(218, 229, 232)",
                  display: "flex",
                  flexDirection: "column-reverse",
                  justifyContent: "flex-start",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: `${props.volume * 100}%`,
                    backgroundColor: "#000000",
                  }}
                ></div>
                <div
                  style={{
                    position: "relative",
                    width: 0,
                    height: 0,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Image
                    style={{ position: "absolute" }}
                    src={progressPointerIcon}
                    alt=""
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function getPlayedSeconds(
  currentTime: Date,
  playerStatus: Os2SpotifyPlayerStatus,
  timeOffsetSeconds: number
): number | undefined {
  if (playerStatus === undefined) return undefined
  if (playerStatus.playedSeconds !== undefined)
    return playerStatus.playedSeconds
  const { matchingStartPlayingTime } = playerStatus
  if (matchingStartPlayingTime === undefined) return undefined
  return (
    (currentTime.getTime() -
      timeOffsetSeconds * 1000 -
      matchingStartPlayingTime.getTime()) /
    1000
  )
}

function secondsToText(timeSeconds: number | undefined): string {
  if (timeSeconds === undefined) return "-:--"
  const t = Math.floor(timeSeconds)
  const seconds = t % 60
  const minutes = Math.floor(t / 60)
  return `${minutes.toFixed(0)}:${seconds.toFixed(0).padStart(2, "0")}`
}

export function SpotifyPlayerUI(props: {
  timeOffsetSeconds: number
  playerStatus: Os2SpotifyPlayerStatus
  handlePlayerControl: (playbackControl: Os2SpotifyPlayerControl) => void
  volume: number
  onVolumeChange: (volume: number) => void
  listening?: boolean
}) {
  const { playerStatus, handlePlayerControl, timeOffsetSeconds } = props
  const currentTime = useCurrentTime(0.2)
  const playedSeconds =
    getPlayedSeconds(currentTime, playerStatus, timeOffsetSeconds) ?? 0
  const [isHovering, setIsHovering] = useState(false)
  const musicNameSpanRef = useRef<HTMLSpanElement>(null)
  const [musicNameWidth, setMusicNameWidth] = useState(0)

  useEffect(() => {
    setMusicNameWidth(
      musicNameSpanRef.current === null
        ? 0
        : musicNameSpanRef.current.offsetWidth
    )
  }, [])
  const maxMusicNameWidth = 255

  return (
    <div
      style={{
        display: "flex",
        maxWidth: "397px",
        height: "110px",
        gap: "10px",
        color: "hsl(0, 0%, 53.21%)",
        fontFamily: "Avenir Next",
      }}
    >
      <Image
        priority
        src={playerStatus.albumImageUrl}
        alt="Album"
        width={110}
        height={110}
        style={{ borderRadius: "4px" }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: "1",
        }}
      >
        <div
          className={`${
            musicNameWidth > maxMusicNameWidth && isHovering
              ? rollingStyles.marquee
              : styles.trackName
          } ${fontAvenirNextBold.className}`}
          style={{
            color: props.listening
              ? "white"
              : props.listening === undefined
              ? "white"
              : "white",
          }}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          <span ref={musicNameSpanRef}>{playerStatus.trackName}</span>
        </div>
        <div
          style={{
            fontSize: 10,
            height: "14px",
            fontWeight: 500,
          }}
          className={fontAvenirNextMedium.className}
        >
          {playerStatus.artistName}
        </div>
        <SpotifyPlayerProgressBar
          playedSeconds={playedSeconds}
          durationSeconds={playerStatus.durationSeconds}
          onSeek={(playedRatio) => {
            handlePlayerControl({
              jumpToPosition: {
                playedRatio,
              },
            })
          }}
        />
        <SpotifyPlayerControlBar
          playing={playerStatus.playing}
          shuffle={playerStatus.shuffle}
          repeatMode={playerStatus.repeatMode}
          onShuffleChange={() => {
            handlePlayerControl({
              switchShuffle: {},
            })
          }}
          onSkipToPrevious={() => {
            handlePlayerControl({
              previous: {},
            })
          }}
          onSkipToNext={() => {
            handlePlayerControl({
              next: {},
            })
          }}
          onPlayChange={() => {
            handlePlayerControl({
              switchResume: {},
            })
          }}
          onRepeatModeChange={() => {
            handlePlayerControl({
              switchRepeatMode: {},
            })
          }}
          volume={props.volume}
          onVolumeChange={props.onVolumeChange}
        />
        <Image
          style={{ alignSelf: "flex-end" }}
          priority
          src={spotifyIcon}
          alt="Spotify"
        />
      </div>
    </div>
  )
}
