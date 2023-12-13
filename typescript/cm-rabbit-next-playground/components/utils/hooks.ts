"use client"

import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"

import { stringRemovePrefix } from "base-core/lib/string.js"
import {
  Broadcast,
  BroadcastController,
  Scope,
  ScopeAttachment,
  buildAttachmentForCancellation,
  sleepUntilCancel,
} from "base-core/lib/scope.js"
import { flyingPromise } from "base-core/lib/utils.js"

export function useCurrentTime(intervalSeconds: number): Date {
  const [currentTime, setCurrentTime] = useState<Date>(new Date())
  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentTime(new Date())
    }, intervalSeconds * 1000)
    return () => {
      clearInterval(intervalId)
    }
  }, [intervalSeconds])
  return currentTime
}

export function useDebugValues(): string[] {
  const params = useSearchParams()
  return params.getAll("debug")
}

export function useDebugValueHas(key: string): boolean {
  return useDebugValues().includes(key)
}

export function useDebugValueExtract(key: string): string | undefined {
  const param = useDebugValues().filter((k) => k.startsWith(key))?.[0]
  if (param === undefined) return undefined
  return stringRemovePrefix(param, `${key}:`)
}

export function runEffectScope(
  body: (scope: Scope, cancel: (error: Error) => void) => Promise<void>
): () => void {
  const { cancel, attachment } = buildAttachmentForCancellation(true)
  flyingPromise(async () => {
    await Scope.with(
      undefined,
      [attachment],
      async (scope) => await body(scope, cancel)
    )
  })
  return () => {
    cancel(new Error("Effect left"))
  }
}

export function useStateRef<T>(state: T): {
  readonly current: T
} {
  const stateRef = useRef<T>(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])
  return stateRef
}

export function useBroadcast<T>(state: T): Broadcast<T> {
  const broadcastRef = useRef(new BroadcastController<T>())
  useEffect(() => {
    broadcastRef.current.emit(state)
  }, [state])
  return broadcastRef.current
}

export function useScope(): Scope | undefined {
  const scopeRef = useRef<Scope>()
  useEffect(() => {
    const { cancel, attachment } = buildAttachmentForCancellation(true)
    flyingPromise(async () => {
      await Scope.with(undefined, [attachment], async (scope) => {
        scopeRef.current = scope
        scope.onLeave(async () => {
          scopeRef.current = undefined
        })
        await sleepUntilCancel(scope)
      })
    })
    return () => {
      cancel(new Error("Component unmounted"))
    }
  }, [])
  return scopeRef.current
}

export function useCancelAttachment(): {
  cancel: (reason: Error) => void
  attachment: ScopeAttachment
} {
  return useState(() => buildAttachmentForCancellation(true))[0]
}

export function useIsMobile(): boolean | undefined {
  const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined)
  useEffect(() => {
    if (
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      )
    ) {
      setIsMobile(true)
    } else {
      setIsMobile(false)
    }
  }, [])
  return isMobile
}
