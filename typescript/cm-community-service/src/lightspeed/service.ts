import {
  BroadcastController,
  Scope,
  launchBackgroundScope,
} from "base-core/lib/scope.js"

import {
  LightspeedHttpService,
  realTimeToWorldTime,
  worldStateType,
  worldSettingType,
  worldActiveStateType,
  WorldEvent,
  PlayerOperation,
  GameOperation,
  gameOperationType,
} from "cm-community-common/lib/schema/lightspeed.js"
import { ModelClient, WorldDoc, WorldEventDoc } from "./model.js"
import { stringRandomSimpleName } from "base-core/lib/string.js"
import { aggExprLiteral } from "base-mongodb/lib/expressions.js"
import { WorldSettingAccessor } from "./utils.js"
import { worldTimeType } from "cm-community-common/lib/schema/common.js"
import { nullableType } from "base-core/lib/types.js"
import { makeOptionalField } from "base-core/lib/optional.js"

export interface LightspeedService extends LightspeedHttpService {
  listenWorldEvent(
    scope: Scope,
    worldId: string,
    listener: (worldEvent: WorldEvent) => void
  ): void

  writePlayerOperation(
    scope: Scope,
    worldId: string,
    playerOperation: PlayerOperation | undefined,
    gameOperation: GameOperation | undefined
  ): Promise<void>
}

export async function buildLightspeedService(
  scope: Scope,
  modelClient: ModelClient
): Promise<LightspeedService> {
  const worldEventBroadcast = new BroadcastController<WorldEventDoc>()

  launchBackgroundScope(scope, async (scope) => {
    for await (const changeEvent of modelClient.worldEventCollection.findAndWatch(
      scope,
      (pipeline) => pipeline
    )) {
      if (changeEvent.kind === "create" || changeEvent.kind === "update") {
        worldEventBroadcast.emit(changeEvent.value)
      }
    }
  })

  return {
    get_listWorlds: async (scope, request) => {
      return await modelClient.worldCollection.find(scope, {}).toArray()
    },
    post_createWorld: async (scope, request) => {
      new WorldSettingAccessor(request)
      const _id = stringRandomSimpleName(8)
      const world: WorldDoc = {
        _id,
        worldSetting: request,
        worldState: {
          referenceWorldTime: request.startTime,
          activeState: null,
          npcs: [],
          groups: [],
          players: [],
          twissers: [],
        },
        worldRuntime: {
          npcs: [],
        },
      }
      await modelClient.worldCollection.createIfNotExists(scope, world)
      return world
    },
    post_updateWorldSetting: async (scope, request) => {
      new WorldSettingAccessor(request.worldSetting)
      await modelClient.worldCollection.updateById(scope, request.worldId, {
        $set: {
          worldSetting: request.worldSetting,
        },
      })
      return {}
    },
    post_deleteWorld: async (scope, request) => {
      await modelClient.worldCollection.deleteById(scope, request.worldId)
      return {}
    },
    post_startWorld: async (scope, request) => {
      const world = await modelClient.worldCollection.getById(
        scope,
        request.worldId
      )
      if (world === undefined) {
        throw new Error("World not found")
      }
      if (world.worldState.activeState !== null) {
        const realTime = new Date()
        const currentTime = realTimeToWorldTime(world.worldState, realTime)
        await modelClient.worldCollection.updateById(scope, request.worldId, {
          $set: {
            "worldState.referenceWorldTime": currentTime,
            "worldState.activeState": {
              timeRate: request.timeRate,
              realTime,
              ...makeOptionalField(
                "stopTime",
                request.activeDurationSeconds === undefined
                  ? undefined
                  : new Date(Date.now() + request.activeDurationSeconds * 1000)
              ),
            },
          },
        })
      } else {
        await modelClient.worldCollection.updateById(scope, request.worldId, {
          $set: {
            "worldState.activeState": {
              timeRate: request.timeRate,
              realTime: new Date(),
              ...makeOptionalField(
                "stopTime",
                request.activeDurationSeconds === undefined
                  ? undefined
                  : new Date(Date.now() + request.activeDurationSeconds * 1000)
              ),
            },
          },
        })
      }
      return {}
    },
    post_resetWorld: async (scope, request) => {
      const world = await modelClient.worldCollection.getById(
        scope,
        request.worldId
      )
      if (world === undefined) {
        throw new Error("World not found")
      }
      const resettedWorld: WorldDoc = {
        _id: world._id,
        worldSetting: world.worldSetting,
        worldState: {
          referenceWorldTime: world.worldSetting.startTime,
          activeState: null,
          npcs: [],
          groups: [],
          players: [],
          twissers: [],
        },
        worldRuntime: {
          npcs: [],
        },
      }
      await modelClient.worldCollection.createOrReplace(scope, resettedWorld)
      return {}
    },
    post_stopWorld: async (scope, request) => {
      const world = await modelClient.worldCollection.getById(
        scope,
        request.worldId
      )
      if (world === undefined) {
        throw new Error("World not found")
      }
      if (world.worldState.activeState === null) {
        throw new Error("World is not active")
      }
      await modelClient.worldCollection.updateById(scope, request.worldId, {
        $set: {
          "worldState.referenceWorldTime": realTimeToWorldTime(
            world.worldState,
            new Date()
          ),
          "worldState.activeState": null,
        },
      })
      return {}
    },

    listenWorldEvent(
      scope: Scope,
      worldId: string,
      listener: (worldEvent: WorldEvent) => void
    ): void {
      worldEventBroadcast.listen(scope, (worldEventDoc) => {
        if (worldEventDoc.worldId !== worldId) {
          return
        }
        listener(worldEventDoc)
      })
    },

    async writePlayerOperation(
      scope: Scope,
      worldId: string,
      playerOperation: PlayerOperation | undefined,
      gameOperation: GameOperation | undefined
    ): Promise<void> {
      console.log("game operation in service.ts: ", gameOperation)
      await modelClient.playerOperationCollection.createIfNotExists(scope, {
        _id: stringRandomSimpleName(16),
        worldId,
        operation: playerOperation,
        gameOperation: gameOperation,
      })
    },
  }
}
