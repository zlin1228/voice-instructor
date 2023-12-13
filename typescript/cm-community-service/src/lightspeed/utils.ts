import { retryable } from "base-core/lib/concurrency"
import { abortIfThrow } from "base-core/lib/debug.js"
import { throwError } from "base-core/lib/exception.js"
import { log } from "base-core/lib/logging.js"
import { OneOf } from "base-core/lib/one-of.js"
import {
  Scope,
  SignalController,
  buildAttachmentForCancellation,
  launchBackgroundScope,
  sleepSeconds,
} from "base-core/lib/scope.js"
import { stringHash } from "base-core/lib/string.js"
import { WithId } from "cm-community-common/lib/schema/common.js"
import {
  House,
  Room,
  Building,
  Facility,
  NpcSetting,
  NpcRelation,
  WorldSetting,
  World,
  NpcRuntime,
  Place,
  WorldState,
  samePlace,
} from "cm-community-common/lib/schema/lightspeed.js"
import { findNpcStateFromWorldState } from "cm-community-common/lib/schema/lightspeed.js"

export class WorldSettingAccessor {
  readonly housesById = new Map<string, WithId<House>>()
  readonly housesByName = new Map<string, WithId<House>>()
  readonly roomsById = new Map<string, WithId<Room>>()
  readonly roomsByName = new Map<string, WithId<Room>>()
  readonly buildingsById = new Map<string, WithId<Building>>()
  readonly buildingsByName = new Map<string, WithId<Building>>()
  readonly facilitiesById = new Map<string, WithId<Facility>>()
  readonly facilitiesByName = new Map<string, WithId<Facility>>()
  readonly houseAndRoomsByHash = new Map<
    string,
    { house: WithId<House>; room: WithId<Room> }
  >()
  readonly buildingAndFacilitiesByHash = new Map<
    string,
    { building: WithId<Building>; facility: WithId<Facility> }
  >()
  readonly npcsById = new Map<string, WithId<NpcSetting>>()
  readonly npcsByName = new Map<string, WithId<NpcSetting>>()
  readonly npcRelationsById = new Map<string, WithId<NpcRelation>>()
  readonly npcRelationsByNpc1Id = new Map<
    string,
    Map<string, WithId<NpcRelation>>
  >()
  readonly npcRelationsByNpc2Id = new Map<
    string,
    Map<string, WithId<NpcRelation>>
  >()

  static isValidName(name: string): boolean {
    return name !== "" && name.trim() === name
  }

  getBuildingByName(buildingName: string): WithId<Building> {
    const building = this.buildingsByName.get(buildingName)
    if (!building) {
      throw new Error(`Building not found: ${buildingName}`)
    }
    return building
  }

  tryGetFacilityByName(
    buildingName: string,
    facilityName: string | undefined
  ): {
    building: WithId<Building>
    facility: WithId<Facility>
  } {
    if (facilityName === undefined) {
      const building = this.getBuildingByName(buildingName)
      const facility =
        building.facilities[0] ?? throwError("Building has no facilities")
      return {
        building,
        facility,
      }
    }
    const facility = this.facilitiesByName.get(
      `${buildingName}-${facilityName}`
    )
    if (!facility) {
      log.info("Failed to identify facility")
      console.log(`${buildingName}-${facilityName}`)
      console.log(this.facilitiesByName)
      for (const building of this.worldSetting.buildings) {
        for (const facility of building.facilities) {
          if (facility.name === facilityName) {
            return {
              building,
              facility,
            }
          }
        }
      }
      const building = this.getBuildingByName(buildingName)
      const facility =
        building.facilities[0] ?? throwError("Building has no facilities")
      return {
        building,
        facility,
      }
    }
    return {
      building: this.getBuildingByName(buildingName),
      facility,
    }
  }

  getHouseByName(houseName: string): WithId<House> {
    const house = this.housesByName.get(houseName)
    if (!house) {
      throw new Error(`House not found: ${houseName}`)
    }
    return house
  }

  getHouseById(houseId: string): WithId<House> {
    const house = this.housesById.get(houseId)
    if (!house) {
      throw new Error(`House not found: ${houseId}`)
    }
    return house
  }

  getHouseAndRoomById(
    houseId: string,
    roomId: string
  ): {
    house: WithId<House>
    room: WithId<Room>
  } {
    const house = this.getHouseById(houseId)
    const room = this.roomsById.get(`${houseId}-${roomId}`)
    if (!room) {
      throw new Error(`Room not found: ${roomId}`)
    }
    return {
      house,
      room,
    }
  }

  getHouseAndRoomByName(
    houseName: string,
    roomName: string
  ): {
    house: WithId<House>
    room: WithId<Room>
  } {
    const house = this.getHouseByName(houseName)
    const room = this.roomsByName.get(`${houseName}-${roomName}`)
    if (!room) {
      throw new Error(`Room not found: ${roomName}`)
    }
    return {
      house,
      room,
    }
  }

  getHouseAndRoomByHash(houseAndRoomHash: string): {
    house: WithId<House>
    room: WithId<Room>
  } {
    return (
      this.houseAndRoomsByHash.get(houseAndRoomHash) ??
      throwError("House and room not found")
    )
  }

  getBuildingById(buildingId: string): WithId<Building> {
    const building = this.buildingsById.get(buildingId)
    if (!building) {
      throw new Error(`Building not found: ${buildingId}`)
    }
    return building
  }

  getBuildingAndFacilityById(
    buildingId: string,
    facilityId: string
  ): {
    building: WithId<Building>
    facility: WithId<Facility>
  } {
    const building = this.getBuildingById(buildingId)
    const facility = this.facilitiesById.get(`${buildingId}-${facilityId}`)
    if (!facility) {
      throw new Error(`Facility not found: ${facilityId}`)
    }
    return {
      building,
      facility,
    }
  }

  getBuildingAndFacilityByName(
    buildingName: string,
    facilityName: string
  ): {
    building: WithId<Building>
    facility: WithId<Facility>
  } {
    const building = this.getBuildingByName(buildingName)
    const facility = this.facilitiesByName.get(
      `${buildingName}-${facilityName}`
    )
    if (!facility) {
      throw new Error(`Facility not found: ${facilityName}`)
    }
    return {
      building,
      facility,
    }
  }

  getBuildingAndFacilityByHash(buildingAndFacilityHash: string): {
    building: WithId<Building>
    facility: WithId<Facility>
  } {
    return (
      this.buildingAndFacilitiesByHash.get(buildingAndFacilityHash) ??
      throwError("building and facility not found")
    )
  }

  getPlaceByHash(placeHash: string): Place {
    const houseAndRoom = this.houseAndRoomsByHash.get(placeHash)
    if (houseAndRoom !== undefined) {
      return {
        house: {
          houseId: houseAndRoom.house._id,
          roomId: houseAndRoom.room._id,
        },
      }
    }
    const buildingAndFacility = this.buildingAndFacilitiesByHash.get(placeHash)
    if (buildingAndFacility !== undefined) {
      return {
        building: {
          buildingId: buildingAndFacility.building._id,
          facilityId: buildingAndFacility.facility._id,
        },
      }
    }
    throw new Error(`Place not found: ${placeHash}`)
  }

  tryGetRoomByName(
    houseName: string,
    roomName: string | undefined
  ): {
    house: WithId<House>
    room: WithId<Room>
  } {
    if (roomName === undefined) {
      const house = this.getHouseByName(houseName)
      const room = house.rooms[0] ?? throwError("House has no rooms")
      return {
        house,
        room,
      }
    }

    const room = this.roomsByName.get(`${houseName}-${roomName}`)
    if (!room) {
      log.info("Failed to identify room")
      console.log(`${houseName}-${roomName}`)
      console.log(this.roomsByName)
      for (const house of this.worldSetting.houses) {
        for (const room of house.rooms) {
          if (room.name === roomName) {
            return {
              house,
              room,
            }
          }
        }
      }
      const house = this.getHouseByName(houseName)
      const room = house.rooms[0] ?? throwError("House has no rooms")
      return {
        house,
        room,
      }
    }
    return {
      house: this.getHouseByName(houseName),
      room,
    }
  }

  getNpcById(npcId: string): WithId<NpcSetting> {
    const npc = this.npcsById.get(npcId)
    if (!npc) {
      throw new Error(`NPC not found: ${npcId}`)
    }
    return npc
  }

  getNpcByName(npcName: string): WithId<NpcSetting> {
    const npc = this.npcsByName.get(npcName)
    if (!npc) {
      throw new Error(`NPC not found: ${npcName}`)
    }
    return npc
  }

  getAllNpcIds(): string[] {
    return [...this.npcsById.keys()]
  }

  static getHouseAndRoomHash(houseId: string, roomId: string): string {
    return Math.abs(stringHash(`house-${houseId}-${roomId}`)).toString(36)
  }

  static getBuildingAndFacilityHash(
    buildingId: string,
    facilityId: string
  ): string {
    return Math.abs(
      stringHash(`building-${buildingId}-${facilityId}`)
    ).toString(36)
  }

  static getPlaceHash(place: Place): string {
    if (place.house !== undefined) {
      return WorldSettingAccessor.getHouseAndRoomHash(
        place.house.houseId,
        place.house.roomId
      )
    } else if (place.building !== undefined) {
      return WorldSettingAccessor.getBuildingAndFacilityHash(
        place.building.buildingId,
        place.building.facilityId
      )
    }
    throw new Error(`Invalid place: ${JSON.stringify(place)}}`)
  }

  constructor(readonly worldSetting: WorldSetting) {
    for (const house of worldSetting.houses) {
      if (this.housesById.has(house._id)) {
        throw new Error("Duplicate house ID")
      }
      this.housesById.set(house._id, house)
      if (this.housesByName.has(house.name)) {
        throw new Error("Duplicate house name")
      }
      if (!WorldSettingAccessor.isValidName(house.name)) {
        throw new Error("Invalid house name")
      }
      this.housesByName.set(house.name, house)
      for (const room of house.rooms) {
        if (this.roomsById.has(`${house._id}-${room._id}`)) {
          throw new Error("Duplicate room ID")
        }
        this.roomsById.set(`${house._id}-${room._id}`, room)
        if (this.roomsByName.has(`${house.name}-${room.name}`)) {
          throw new Error("Duplicate room name")
        }
        this.roomsByName.set(`${house.name}-${room.name}`, room)
        if (!WorldSettingAccessor.isValidName(room.name)) {
          throw new Error("Invalid room name")
        }
        this.houseAndRoomsByHash.set(
          WorldSettingAccessor.getHouseAndRoomHash(house._id, room._id),
          {
            house,
            room,
          }
        )
      }
    }
    for (const building of worldSetting.buildings) {
      if (this.buildingsById.has(building._id)) {
        throw new Error("Duplicate building ID")
      }
      this.buildingsById.set(building._id, building)
      if (this.buildingsByName.has(building.name)) {
        throw new Error("Duplicate building name")
      }
      this.buildingsByName.set(building.name, building)
      if (!WorldSettingAccessor.isValidName(building.name)) {
        throw new Error("Invalid building name")
      }
      for (const facility of building.facilities) {
        if (this.facilitiesById.has(`${building._id}-${facility._id}`)) {
          throw new Error("Duplicate facility ID")
        }
        this.facilitiesById.set(`${building._id}-${facility._id}`, facility)
        if (this.facilitiesByName.has(`${building.name}-${facility.name}`)) {
          throw new Error("Duplicate facility name")
        }
        this.facilitiesByName.set(`${building.name}-${facility.name}`, facility)
        if (!WorldSettingAccessor.isValidName(facility.name)) {
          throw new Error("Invalid facility name")
        }
        this.buildingAndFacilitiesByHash.set(
          WorldSettingAccessor.getBuildingAndFacilityHash(
            building._id,
            facility._id
          ),
          {
            building,
            facility,
          }
        )
      }
    }

    for (const npc of worldSetting.npcs) {
      if (this.npcsById.has(npc._id)) {
        throw new Error("Duplicate NPC ID")
      }
      this.npcsById.set(npc._id, npc)
      if (this.npcsByName.has(npc.name)) {
        throw new Error("Duplicate NPC name")
      }
      this.npcsByName.set(npc.name, npc)
      if (!WorldSettingAccessor.isValidName(npc.name)) {
        throw new Error("Invalid NPC name")
      }
      if (
        !this.roomsById.has(`${npc.residenceHouseId}-${npc.residenceRoomId}`)
      ) {
        throw new Error("Invalid NPC's residence")
      }
      if (
        !this.facilitiesById.has(`${npc.workBuildingId}-${npc.workFacilityId}`)
      ) {
        console.log(npc)
        console.log(`${npc.workBuildingId}-${npc.workFacilityId}`)
        throw new Error("Invalid NPC's workplace")
      }
      this.npcRelationsByNpc1Id.set(npc._id, new Map())
      this.npcRelationsByNpc2Id.set(npc._id, new Map())
      if (!["F", "M"].includes(npc.gender)) {
        throw new Error("Invalid NPC's gender")
      }
      if (npc.age < 1 || npc.age > 120) {
        throw new Error("Invalid NPC's age")
      }
    }

    for (const npcRelation of worldSetting.npcRelations) {
      if (this.npcRelationsById.has(npcRelation._id)) {
        throw new Error("Duplicate NPC relation ID")
      }
      this.npcRelationsById.set(npcRelation._id, npcRelation)
      if (!WorldSettingAccessor.isValidName(npcRelation.relation)) {
        throw new Error("Invalid relation name")
      }
      if (!this.npcsById.has(npcRelation.npc1Id)) {
        throw new Error("Invalid NPC relation - npc1Id not found")
      }
      if (!this.npcsById.has(npcRelation.npc2Id)) {
        throw new Error("Invalid NPC relation - npc2Id not found")
      }
      if (npcRelation.npc1Id === npcRelation.npc2Id) {
        throw new Error("Invalid NPC relation - npc1Id and npc2Id are the same")
      }
      if (
        this.npcRelationsByNpc2Id
          .get(npcRelation.npc1Id)
          ?.get(npcRelation.npc2Id) !== undefined
      ) {
        throw new Error("Duplicate NPC relation")
      }
      this.npcRelationsByNpc1Id
        .get(npcRelation.npc1Id)
        ?.set(npcRelation.npc2Id, npcRelation)
      this.npcRelationsByNpc2Id
        .get(npcRelation.npc2Id)
        ?.set(npcRelation.npc1Id, npcRelation)
    }
  }
}

export function addHouseToWorldSetting(
  worldSetting: WorldSetting,
  house: WithId<House>
): WorldSetting {
  const newWorldSetting = {
    ...worldSetting,
    houses: [...worldSetting.houses, house],
  }
  new WorldSettingAccessor(newWorldSetting)
  return newWorldSetting
}

export function addBuildingToWorldSetting(
  worldSetting: WorldSetting,
  building: WithId<Building>
): WorldSetting {
  const newWorldSetting = {
    ...worldSetting,
    buildings: [...worldSetting.buildings, building],
  }
  new WorldSettingAccessor(newWorldSetting)
  return newWorldSetting
}

export function addNpcToWorldSetting(
  worldSetting: WorldSetting,
  npc: WithId<NpcSetting>
): WorldSetting {
  const newWorldSetting = {
    ...worldSetting,
    npcs: [...worldSetting.npcs, npc],
  }
  new WorldSettingAccessor(newWorldSetting)
  return newWorldSetting
}

export function addNpcRelationToWorldSetting(
  worldSetting: WorldSetting,
  npcRelation: WithId<NpcRelation>
): WorldSetting {
  const newWorldSetting = {
    ...worldSetting,
    npcRelations: [...worldSetting.npcRelations, npcRelation],
  }
  new WorldSettingAccessor(newWorldSetting)
  return newWorldSetting
}

export class JobTracker {
  readonly #scope: Scope
  readonly #logPrefix: string
  readonly #jobStates = new Map<
    string,
    {
      readonly signature: string
      readonly cancel: (reason: Error) => void
      readonly signal: SignalController<unknown>
      readonly startTime: Date
      readonly handlerRef: { current: (scope: Scope) => Promise<unknown> }
    }
  >()
  readonly #currentJobs = new Map<
    string,
    {
      readonly signature: string
      readonly fn: (scope: Scope) => Promise<unknown>
    }
  >()

  constructor(scope: Scope, logPrefix: string) {
    this.#scope = scope
    this.#logPrefix = logPrefix
  }

  dispatch<T>(
    id: string,
    signature: string,
    fn: (scope: Scope) => Promise<T>
  ): T | undefined {
    this.#currentJobs.set(id, { signature, fn })
    const jobState = this.#jobStates.get(id)
    if (
      jobState !== undefined &&
      jobState.signature === signature &&
      jobState.signal.get().kind === "ready"
    ) {
      return jobState.signal.get().value as T
    }
    return undefined
  }

  commit(onJobDone: (scope: Scope) => Promise<void>) {
    for (const [id, jobState] of this.#jobStates) {
      const currentJob = this.#currentJobs.get(id)
      if (currentJob === undefined) {
        if (jobState.signal.get().kind === "pending") {
          log.info(`${this.#logPrefix} Job deleted due to cancellation: ${id}`)
          jobState.cancel(new Error("Job removed"))
        }
        this.#jobStates.delete(id)
      } else if (currentJob.signature !== jobState.signature) {
        if (jobState.signal.get().kind === "pending") {
          log.info(`${this.#logPrefix} Job deleted due to modification: ${id}`)
          jobState.cancel(new Error("Job modified"))
        }
        this.#jobStates.delete(id)
      }
    }
    for (const [id, job] of this.#currentJobs) {
      const currentState = this.#jobStates.get(id)
      if (currentState !== undefined) {
        currentState.handlerRef.current = job.fn
        continue
      }
      const { cancel, attachment } = buildAttachmentForCancellation(true)
      const signal = new SignalController<unknown>()
      const state = {
        signature: job.signature,
        cancel,
        signal,
        startTime: new Date(),
        handlerRef: { current: job.fn },
      }
      this.#jobStates.set(id, state)
      log.info(`${this.#logPrefix} Job launched: ${id} - ${job.signature}`)
      launchBackgroundScope(this.#scope, async (scope) => {
        await Scope.with(scope, [attachment], async (scope) => {
          for (;;) {
            try {
              const result = await state.handlerRef.current(scope)
              signal.emit(result)
              return
            } catch (e) {
              log.info(
                `${this.#logPrefix} Job failed, retrying: ${id} - ${
                  job.signature
                } - ${String(e)}`
              )
              console.log(e)
            }
            try {
              await sleepSeconds(scope, 10)
            } catch (e) {
              return
            }
          }
        })
        log.info(
          `${this.#logPrefix} Job done: ${id} (${(
            (Date.now() - state.startTime.getTime()) /
            1000
          ).toFixed()}s)`
        )
        await onJobDone(scope)
      })
    }
    this.#currentJobs.clear()
  }
}

export type JobDispatcher = <T>(
  id: string,
  signature: string,
  fn: (scope: Scope) => Promise<T>
) => T | undefined

export function listValidChatChoices(
  worldState: WorldState,
  npcId: string
): {
  group: string
  npcIds: string[]
}[] {
  const groups: Map<string, string[]> = new Map()
  const individuals: string[] = []
  const spot = findNpcStateFromWorldState(worldState, npcId)?.location.staying
  if (spot === undefined || spot.groupId !== "") {
    return []
  }
  for (const npc of worldState.npcs) {
    if (npc.npcId === npcId) continue
    const npcState = findNpcStateFromWorldState(worldState, npc.npcId)
    if (npcState === undefined) continue
    if (npcState.location.staying === undefined) continue
    if (!samePlace(npcState.location.staying.place, spot.place)) {
      continue
    }
    const group = npcState.location.staying.groupId
    if (group === "") {
      individuals.push(npc.npcId)
    } else {
      const npcs = groups.get(group) ?? []
      npcs.push(npc.npcId)
      groups.set(npcState.location.staying.groupId, npcs)
    }
  }
  return [
    ...[...groups.entries()].map(([group, npcIds]) => ({ group, npcIds })),
    ...individuals.map((npcId) => ({ group: "", npcIds: [npcId] })),
  ]
}
