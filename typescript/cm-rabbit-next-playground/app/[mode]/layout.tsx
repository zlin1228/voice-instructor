"use client"

import { useAuth, useClerk } from "@clerk/nextjs"
import { useEffect } from "react"
import { useInit } from "../../components/utils/global"
import { untitledSansLight, untitledSansRegular } from "../fonts/fonts"
import { useIsMobile } from "../../components/utils/hooks"

const BASEURL = "https://storage.googleapis.com/quantum-engine-public"

function MobilePanel(props: {}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "80vh",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          flex: 0.9,
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
        style={{
          color: "#6c6c6c",
          fontSize: "0.6em",
          padding: "16px",
          flex: 0.1,
        }}
        className={untitledSansLight.className}
      >
        © 2023 rabbit inc.
      </div>
    </div>
  )
}

export default function Layout(props: { children: React.ReactNode }) {
  useInit()
  const { userId } = useAuth()
  const clerk = useClerk()
  const isMobile = useIsMobile()
  useEffect(() => {
    if (
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      )
    ) {
      return
    }
    if (userId === null || userId === undefined) {
      clerk.redirectToSignIn()
    }
  }, [userId, clerk])
  if (isMobile) {
    return <MobilePanel />
  }
  if (userId === null || userId === undefined) return null
  return props.children
}
