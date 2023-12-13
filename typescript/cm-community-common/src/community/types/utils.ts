import { stringRandomSimpleName } from "base-core/lib/string.js"
import { WorldTime } from "./common.js"
import { NpcState, Place, Spot, WorldState } from "./state.js"
import { WorldRuntime, NpcRuntime } from "./runtime.js"
import { CommunityAction, CommunitySnapshot } from "./engine.js"
import { WorldSetting } from "./setting.js"
import { WorldEvent } from "./event.js"

export function buildRandomId(): string {
  return stringRandomSimpleName(8).toUpperCase()
}

export function worldTimeToDate(time: WorldTime): Date {
  return new Date(time.year, time.month - 1, time.date, time.hour, time.minute)
}

export function dateToWorldTime(date: Date): WorldTime {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    date: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
  }
}

export function worldTimeToString(worldTime: WorldTime): string {
  return `${worldTime.year}-${worldTime.month
    .toFixed()
    .padStart(2, "0")}-${worldTime.date
    .toFixed()
    .padStart(2, "0")} ${worldTime.hour
    .toFixed()
    .padStart(2, "0")}:${worldTime.minute.toFixed().padStart(2, "0")}`
}

export function minWorldTime(time0: WorldTime, time1: WorldTime): WorldTime {
  return worldTimeToDate(time0) < worldTimeToDate(time1) ? time0 : time1
}

export function worldTimeToTimestamp(time: WorldTime): number {
  return worldTimeToDate(time).getTime()
}

export function samePlace(place1: Place, place2: Place): boolean {
  return (
    place1.house?.houseId === place2.house?.houseId &&
    place1.house?.roomId === place2.house?.roomId &&
    place1.building?.buildingId === place2.building?.buildingId &&
    place1.building?.facilityId === place2.building?.facilityId
  )
}

export function sameSpot(spot1: Spot, spot2: Spot): boolean {
  return samePlace(spot1.place, spot2.place) && spot1.groupId === spot2.groupId
}

export function findNpcStateFromWorldState(
  worldState: WorldState,
  npcId: string
): NpcState | undefined {
  const { npcs } = worldState
  for (const npc of npcs) {
    if (npc.npcId === npcId) {
      return npc.npcState
    }
  }
  return undefined
}

export function findNpcRuntimeFromWorldRuntime(
  worldRuntime: WorldRuntime,
  npcId: string
): NpcRuntime | undefined {
  const { npcs } = worldRuntime
  for (const npc of npcs) {
    if (npc.npcId === npcId) {
      return npc.npcRuntime
    }
  }
  return undefined
}

export function realTimeToWorldTime(
  worldState: WorldState,
  realTime: Date
): WorldTime {
  const { activeState } = worldState
  if (activeState === null) {
    throw new Error("World is not active")
  }
  return dateToWorldTime(
    new Date(
      worldTimeToDate(worldState.referenceWorldTime).getTime() +
        (realTime.getTime() - activeState.realTime.getTime()) *
          activeState.timeRate
    )
  )
}

export function worldTimeToRealTime(
  worldRuntime: WorldState,
  worldTime: WorldTime
): Date {
  const { activeState } = worldRuntime
  if (activeState === null) {
    throw new Error("World is not active")
  }
  return new Date(
    activeState.realTime.getTime() +
      (worldTimeToDate(worldTime).getTime() -
        worldTimeToDate(worldRuntime.referenceWorldTime).getTime()) /
        activeState.timeRate
  )
}

export function advanceWorldState(
  worldSetting: WorldSetting,
  worldState: WorldState,
  worldEvent: WorldEvent
): WorldState {
  // TODO
  return worldState
}

export function advanceCommunitySnapshot(
  snapshot: CommunitySnapshot,
  action: CommunityAction
): CommunitySnapshot {
  if (snapshot.worldId !== action.worldId) {
    throw new Error("World ID mismatch")
  }
  if (snapshot.worldRevision !== action.worldRevision) {
    throw new Error("World revision mismatch")
  }
  const worldSetting = action.worldSetting ?? snapshot.worldSetting
  let worldState = snapshot.worldState
  for (const worldEvent of action.worldEvents ?? []) {
    worldState = advanceWorldState(worldSetting, worldState, worldEvent)
  }
  return {
    worldId: snapshot.worldId,
    worldRevision: snapshot.worldRevision + 1,
    worldSetting,
    worldState,
    worldRuntime: action.worldRuntime ?? snapshot.worldRuntime,
  }
}
