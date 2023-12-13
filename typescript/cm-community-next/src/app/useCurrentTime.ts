"use client"

import { useEffect, useState } from "react"

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