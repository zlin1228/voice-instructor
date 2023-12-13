"use client"

import { useEffect } from "react"
import { signIn, useSession } from "next-auth/react"

export default function Page(props: {}) {
  const { status } = useSession()

  useEffect(() => {
    if (status === "unauthenticated") {
      void signIn("spotify")
    } else if (status === "authenticated") {
      window.close()
    }
  }, [status])

  return null
}
