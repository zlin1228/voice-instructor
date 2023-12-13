"use client"

import {
  BroadcastController,
  Scope,
  buildAttachmentForCancellation,
  sleepUntilCancel,
} from "base-core/lib/scope.js"
import { flyingPromise } from "base-core/lib/utils.js"
import { useEffect, useState } from "react"
import { useDebugValueExtract, useDebugValues } from "../utils/hooks"

const localLoginStorageKey = "cm-rabbit-next-spotify-login-storage"
const spotifyLoginStorageBroadcast = new BroadcastController<
  string | undefined
>()

export function readSpotifyLoginStorage(
  storageKey: string
): string | undefined {
  const storage = localStorage.getItem(storageKey)
  return storage ?? undefined
}

export function writeSpotifyLoginStorage(
  storageKey: string,
  storage: string | undefined
) {
  if (storage === undefined) {
    localStorage.removeItem(storageKey)
  } else {
    localStorage.setItem(storageKey, storage)
  }
  spotifyLoginStorageBroadcast.emit(storage)
}

export function useSpotifyLoginStorageKey(): string {
  return useDebugValueExtract("spotify-storage") ?? localLoginStorageKey
}

export function useSpotifyLoginStorage(): string | undefined {
  const storageKey = useSpotifyLoginStorageKey()
  const [storage, setStorage] = useState<string>()
  useEffect(() => {
    setStorage(readSpotifyLoginStorage(storageKey))
    const { cancel, attachment } = buildAttachmentForCancellation(true)
    flyingPromise(async () => {
      await Scope.with(undefined, [attachment], async (scope) => {
        spotifyLoginStorageBroadcast.listen(scope, (storage) => {
          setStorage(storage)
        })
        await sleepUntilCancel(scope)
      })
    })
    return () => {
      cancel(new Error("Cancelled"))
    }
  }, [storageKey])
  return storage
}
