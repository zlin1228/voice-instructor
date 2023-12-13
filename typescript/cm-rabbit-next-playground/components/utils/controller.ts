import { useCallback, useRef, useState } from "react"

export interface ControllerHandle<T> {
  readonly state: T
  readonly stateRef: {
    readonly current: T
  }
}

export interface ControllerState<T> extends ControllerHandle<T> {
  readonly updateState: (newState: T) => void
}

export function useControllerState<T>(initialState: T): ControllerState<T> {
  const stateRef = useRef<T>(initialState)
  const [state, setState] = useState<T>(initialState)
  const updateState = useCallback(
    (newState: T) => {
      stateRef.current = newState
      setState(newState)
    },
    [stateRef, setState]
  )
  return {
    state,
    updateState,
    stateRef,
  }
}
