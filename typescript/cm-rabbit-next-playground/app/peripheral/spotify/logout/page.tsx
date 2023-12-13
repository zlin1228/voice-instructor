"use client"

import { useEffect } from "react"
import { useSession, signOut } from "next-auth/react"
import { flyingPromise } from "base-core/lib/utils.js"

export default function Page(props: {}) {
  const { status } = useSession()
  useEffect(() => {
    flyingPromise(async () => {
      if (status === "authenticated") {
        await signOut()
        window.close()
      } else if (status === "unauthenticated") {
        window.close()
      }
    })
  }, [status])
  return null
}
