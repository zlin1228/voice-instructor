"use client"

import ReactPlayer from "react-player"

import Intro from "../os2/Intro"

export default function Home() {
  if (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    )
  ) {
    return (
      <div>
        <ReactPlayer
          controls={true}
          loop={true}
          url="https://storage.googleapis.com/quantum-engine-public/video/OS2-1.mp4"
        />
      </div>
    )
  } else {
    return <Intro button={true} />
  }
}
