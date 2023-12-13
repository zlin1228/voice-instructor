export {}
/*
import {
  Broadcast,
  BroadcastController,
  Scope,
  launchBackgroundScope,
  runCancellableScope,
  sleepUntilCancel,
} from "base-core/lib/scope.js"
import { ModelClient, SpeechInputDoc, CommunityOperationDoc } from "./model.js"
import { WorldController } from "../lightspeed/world.js"
import {
  WorldOperation,
  WorldOperationStart,
} from "cm-community-common/lib/community/types/operation.js"
import { CommunityOperation } from "cm-community-common/lib/community/types/engine.js"
import { SpeechInput } from "cm-community-common/lib/community/apis/speech.js"
import { advanceCommunitySnapshot } from "cm-community-common/lib/community/types/utils.js"
import { CommunityDriver } from "./driver.js"
import { buildAsyncGenerator } from "base-core/lib/processing.js"

export interface EngineOptions {
  readonly modelClient: ModelClient
  readonly worldController: WorldController
}

async function buildCommunityOperationBroadcast(
  scope: Scope,
  modelClient: ModelClient
): Promise<Broadcast<CommunityOperationDoc>> {
  const communityOperationBroadcast =
    new BroadcastController<CommunityOperationDoc>()
  launchBackgroundScope(scope, async (scope) => {
    for await (const communityOperationDoc of modelClient.communityOperationCollection.findAndWatch(
      scope,
      (pipeline) => pipeline
    )) {
      if (communityOperationDoc.kind !== "create") {
        continue
      }
      communityOperationBroadcast.emit(communityOperationDoc.value)
    }
  })
  return communityOperationBroadcast
}

async function buildSpeechInputBroadcast(
  scope: Scope,
  modelClient: ModelClient
): Promise<Broadcast<SpeechInputDoc>> {
  const speechInputBroadcast = new BroadcastController<SpeechInputDoc>()
  launchBackgroundScope(scope, async (scope) => {
    for await (const speechInputDoc of modelClient.speechInputCollection.findAndWatch(
      scope,
      (pipeline) => pipeline
    )) {
      if (speechInputDoc.kind !== "create") {
        continue
      }
      speechInputBroadcast.emit(speechInputDoc.value)
    }
  })
  return speechInputBroadcast
}

class WorldDriver {
  readonly #worldId: string
  constructor(worldId: string) {
    this.#worldId = worldId
  }

  async run(
    scope: Scope,
    worldOperationStart: WorldOperationStart | undefined
  ) {}

  handleCommunityOperation(communityOperation: CommunityOperation) {}
  handleSpeechInput(speechInput: SpeechInput) {}
}

interface CommunityControl {
  readonly cancel: (reason: Error) => void
  readonly emitOperation: (operation: CommunityOperation) => Promise<void>
}

export async function runEngine(
  scope: Scope,
  modelClient: ModelClient,
  driver: CommunityDriver
): Promise<void> {
  const communityControls = new Map<string, CommunityControl>()

  const launchWorld = async (
    worldId: string,
    worldOperationStart: WorldOperationStart | undefined
  ) => {
    launchBackgroundScope(scope, async (scope) => {
      await runCancellableScope(scope, async (scope, cancel) => {
        const operationIterable = buildAsyncGenerator<CommunityOperation>(
          async (push) => {
            communityControls.set(worldId, { cancel, emitOperation: push })
            await sleepUntilCancel(scope)
          }
        )
        const snapshot = await modelClient.readSnapshotByWorldId(scope, worldId)
        await driver.run(
          scope,
          snapshot,
          worldOperationStart,
          operationIterable,
          async (action) => {
            const nextSnapshot = advanceCommunitySnapshot(snapshot, action)
            await modelClient.writeAction(scope, action)
            await modelClient.writeSnapshot(scope, nextSnapshot)
          }
        )
      })
    })
  }

  const communityOperationBroadcast = await buildCommunityOperationBroadcast(
    scope,
    modelClient
  )
  communityOperationBroadcast.listen(scope, (communityOperation) => {
    const { startWorld, stopWorld } = communityOperation.worldOperation
    if (
      startWorld !== undefined &&
      !worldDrivers.has(communityOperation.worldId)
    ) {
      launchWorld(communityOperation.worldId, startWorld)
      return
    }
    worldDrivers
      .get(communityOperation.worldId)
      ?.handleCommunityOperation(communityOperation)
  })
  const speechInputBroadcast = await buildSpeechInputBroadcast(
    scope,
    modelClient
  )
  speechInputBroadcast.listen(scope, (speechInputDoc) => {
    worldDrivers.get(speechInputDoc.worldId)?.handleSpeechInput(speechInputDoc)
  })

  for (const snapshot of await modelClient.communitySnapshotCollection
    .find(scope, {
      "worldState.activeState": { $ne: null },
    })
    .toArray()) {
    await launchWorld(snapshot._id, undefined)
  }
  for await (const worldChange of worldChangeStream) {
    if (worldChange.kind === "create") {
      if (worldChange.value.worldState.activeState !== null) {
        await this.#launchWorld(scope, worldChange.value)
      }
    } else if (worldChange.kind === "update") {
      if (worldChange.value.worldState.activeState !== null) {
        if (!this.#activeWorlds.has(worldChange.value._id)) {
          await this.#launchWorld(scope, worldChange.value)
        } else {
          await this.#updateWorld(scope, worldChange.value)
        }
      } else {
        if (this.#activeWorlds.has(worldChange.value._id)) {
          await this.#terminateWorld(scope, worldChange.value._id)
        } else {
          await this.#updateWorld(scope, worldChange.value)
        }
      }
    } else if (worldChange.kind === "delete") {
      if (this.#activeWorlds.has(worldChange.value)) {
        await this.#terminateWorld(scope, worldChange.value)
      }
    }
  }
}
*/
