import { Scope, launchBackgroundScope } from "base-core/lib/scope.js"
import { NpcController, NpcFuture } from "./npc.js"
import { byKeyIs } from "base-core/lib/array.js"
import { log } from "base-core/lib/logging.js"
import { dispatchOneOfAsync } from "base-core/lib/one-of.js"
import {
  WorldTime,
  worldTimeToString,
  minWorldTime,
  dateToWorldTime,
  worldTimeToDate,
} from "cm-community-common/lib/schema/common.js"
import {
  WorldRuntime,
  NpcRuntime,
  World,
  realTimeToWorldTime,
  Place,
  WorldSetting,
  WorldState,
  findNpcRuntimeFromWorldRuntime,
  WorldOperation,
  PlayerOperation,
} from "cm-community-common/lib/schema/lightspeed.js"
import { JobDispatcher, WorldSettingAccessor } from "./utils.js"

export interface WorldObservation {
  readonly worldSetting: WorldSetting
  readonly worldState: WorldState
  readonly currentTime: WorldTime
}

export interface WorldFuture {
  readonly awakeTime: WorldTime
  readonly worldRuntime: WorldRuntime
  readonly worldOperation: WorldOperation
}

export class WorldController {
  readonly #npcController: NpcController

  constructor(npcController: NpcController) {
    this.#npcController = npcController
  }

  runStep(
    logPrefix: string,
    jobDispatcher: JobDispatcher,
    worldFuture: WorldFuture,
    worldObservation: WorldObservation,
  ): WorldFuture {
    const { worldSetting, worldState, currentTime } = worldObservation
    let { worldRuntime } = worldFuture
    const accessor = new WorldSettingAccessor(worldSetting)
    const npcIds = accessor.getAllNpcIds()
    for (const npcId of npcIds) {
      const npcRuntime = findNpcRuntimeFromWorldRuntime(worldRuntime, npcId)
      const npcFuture: NpcFuture = {
        awakeTime: worldFuture.awakeTime,
        npcRuntime,
        npcOperation: {},
      }
      const updatedNpcFuture = this.#npcController.runStep(
        `${logPrefix} ${accessor.getNpcById(npcId).name}(${npcId})`,
        (id, signature, fn) =>
          jobDispatcher(`npc[${npcId}].${id}`, signature, fn),
        npcFuture,
        {
          worldSetting,
          worldState,
          currentTime,
          npcId,
        }
      )
      const updatedAwakeTime = updatedNpcFuture.awakeTime
      if (updatedAwakeTime !== worldFuture.awakeTime) {
        worldFuture = {
          ...worldFuture,
          awakeTime: updatedAwakeTime,
        }
      }
      const updatedNpcRuntime = updatedNpcFuture.npcRuntime
      if (updatedNpcRuntime !== npcRuntime && updatedNpcRuntime !== undefined) {
        const npcs = worldRuntime.npcs
        worldRuntime = {
          ...worldRuntime,
          npcs:
            npcRuntime === undefined
              ? [
                  ...npcs,
                  {
                    npcId,
                    npcRuntime: updatedNpcRuntime,
                  },
                ]
              : npcs.map((npc) =>
                  npc.npcId === npcId
                    ? {
                        npcId,
                        npcRuntime: updatedNpcRuntime,
                      }
                    : npc
                ),
        }
        worldFuture = {
          ...worldFuture,
          worldRuntime,
        }
      }
      worldFuture = {
        ...worldFuture,
        worldOperation: {
          ...worldFuture.worldOperation,
          npcOperations: [
            ...worldFuture.worldOperation.npcOperations,
            {
              npcId,
              npcOperation: updatedNpcFuture.npcOperation,
            },
          ],
        },
      }
    }
    return worldFuture
  }
}
