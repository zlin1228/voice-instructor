"use client"

import { useSession } from "next-auth/react"

export function initiateSpotifyLogin() {
  const newWindow = window.open("/peripheral/spotify/login", "Os2SpotifyLogin")
  newWindow?.focus()
}

export function spotifyLogout() {
  window.open("/peripheral/spotify/logout", "Os2SpotifyLogin")
}

export function useSpotifyToken(): string | undefined {
  const { data: session } = useSession()
  return session?.accessToken
}
