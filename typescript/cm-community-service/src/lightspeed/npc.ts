import { log } from "base-core/lib/logging.js"
import { Scope, runParallelScopes } from "base-core/lib/scope.js"
import {
  WithId,
  WorldTime,
  buildRandomId,
  dateToWorldTime,
  minWorldTime,
  worldTimeToDate,
  worldTimeToString,
  worldTimeToTimestamp,
} from "cm-community-common/lib/schema/common.js"
import {
  WorldSetting,
  NpcSetting,
  World,
  NpcRoutineTask,
  NpcRuntime,
  NpcPlanTask,
  samePlace,
  Place,
  WorldState,
  findNpcStateFromWorldState,
  NpcOperation,
  worldTimeToRealTime,
} from "cm-community-common/lib/schema/lightspeed.js"
import { ModelClient } from "./model.js"
import { arrayLastOrUndefined, byKeyIs } from "base-core/lib/array.js"
import { LightspeedPrompt, placeToString } from "./prompt.js"
import { JobDispatcher } from "./utils.js"
import { abortIfUndefined } from "base-core/lib/debug.js"
import { throwError } from "base-core/lib/exception.js"
import { listValidChatChoices } from "./utils.js"
import { abort } from "process"
import { randomInt } from "crypto"

export interface NpcObservation {
  readonly worldSetting: WorldSetting
  readonly worldState: WorldState
  readonly currentTime: WorldTime
  readonly npcId: string
}

export interface NpcFuture {
  readonly awakeTime: WorldTime
  readonly npcRuntime: NpcRuntime | undefined
  readonly npcOperation: NpcOperation
}

function advancePlanTasks(
  currentTime: WorldTime,
  planTasks: readonly NpcPlanTask[]
): readonly NpcPlanTask[] {
  for (;;) {
    const task = planTasks[1]
    if (
      task !== undefined &&
      worldTimeToDate(task.time) <= worldTimeToDate(currentTime)
    ) {
      planTasks = planTasks.slice(1)
    } else {
      break
    }
  }
  return planTasks
}

export function getCurrentTaskFromRoutine(
  routineTasks: readonly NpcRoutineTask[],
  currentTime: WorldTime
): NpcPlanTask {
  if (routineTasks.length === 0) throw new Error("routineTasks is empty")
  let routineTask = abortIfUndefined(arrayLastOrUndefined(routineTasks))
  for (const task of routineTasks) {
    const taskTime = {
      ...currentTime,
      hour: task.hour,
      minute: task.minute,
    }
    if (worldTimeToDate(currentTime) < worldTimeToDate(taskTime)) break
    routineTask = task
  }
  return {
    time: {
      year: currentTime.year,
      month: currentTime.month,
      date: currentTime.date,
      hour: routineTask.hour,
      minute: routineTask.minute,
    },
    what: routineTask.what,
    place: routineTask.place,
  }
}

function buildUpdatedTasks(
  currentTime: WorldTime,
  routine: readonly NpcRoutineTask[],
  currentTasks: readonly NpcPlanTask[],
  newTasks: readonly NpcPlanTask[]
) {
  currentTasks = advancePlanTasks(currentTime, currentTasks)
  newTasks = advancePlanTasks(currentTime, newTasks)
  let currentTask = newTasks[0]
  if (
    currentTask === undefined ||
    worldTimeToTimestamp(currentTask.time) > worldTimeToTimestamp(currentTime)
  ) {
    currentTask = currentTasks[0]
  }
  if (
    currentTask === undefined ||
    worldTimeToTimestamp(currentTask.time) > worldTimeToTimestamp(currentTime)
  ) {
    currentTask = getCurrentTaskFromRoutine(routine, currentTime)
  }
  let pendingTasks = newTasks.filter(
    (task) =>
      worldTimeToTimestamp(task.time) > worldTimeToTimestamp(currentTime)
  )
  return [currentTask, ...pendingTasks]
}

export class NpcController {
  #lightspeedPrompt: LightspeedPrompt

  constructor(lightspeedPrompt: LightspeedPrompt) {
    this.#lightspeedPrompt = lightspeedPrompt
  }

  #refreshPlanTasks(
    logPrefix: string,
    jobDispatcher: JobDispatcher,
    npcFuture: NpcFuture,
    npcObservation: NpcObservation
  ): NpcFuture {
    const { npcRuntime } = npcFuture
    if (npcRuntime === undefined) {
      return npcFuture
    }
    const { worldSetting, currentTime, worldState, npcId } = npcObservation
    const npcState = findNpcStateFromWorldState(worldState, npcId)
    const lastTask =
      npcState === undefined
        ? undefined
        : arrayLastOrUndefined(npcState.planTasks)
    const durationBeforePast = 1000 * 60 * 60 * 6
    const groupId =
      npcState?.location.staying?.groupId ??
      npcState?.location.moving?.spot.groupId
    const group =
      groupId === undefined
        ? undefined
        : worldState.groups.find(byKeyIs("groupId", groupId))?.group
    if (
      lastTask === undefined ||
      worldTimeToDate(lastTask.time).getTime() -
        worldTimeToDate(currentTime).getTime() <=
        durationBeforePast ||
      (groupId ?? "" !== "")
    ) {
      const newPlanTasks = jobDispatcher(
        "refreshPlanTasks",
        lastTask === undefined
          ? "new"
          : JSON.stringify({
              lastTime: lastTask.time,
              length: npcState?.planTasks.length ?? 0,
              groupId: groupId ?? "",
              messageCount: group?.messages.length ?? 0,
            }),
        async (scope) => {
          return await this.#lightspeedPrompt.generateNpcPlan(
            scope,
            "",
            npcObservation.worldSetting,
            currentTime,
            npcObservation.npcId,
            npcRuntime.routineTasks,
            advancePlanTasks(currentTime, npcState?.planTasks ?? []),
            worldState
          )
        }
      )
      if (newPlanTasks === undefined) {
        return npcFuture
      }
      const updatedTasks: NpcPlanTask[] = buildUpdatedTasks(
        currentTime,
        npcRuntime.routineTasks,
        npcState?.planTasks ?? [],
        newPlanTasks
      )
      return {
        ...npcFuture,
        npcOperation: {
          ...npcFuture.npcOperation,
          birth:
            npcState === undefined
              ? {
                  spot: {
                    place: abortIfUndefined(updatedTasks[0]).place,
                    groupId: "",
                  },
                }
              : undefined,
          plan: {
            planTasks: updatedTasks,
          },
        },
      }
    }
    return {
      ...npcFuture,
      awakeTime: minWorldTime(
        npcFuture.awakeTime,
        dateToWorldTime(
          new Date(
            worldTimeToDate(lastTask.time).getTime() - durationBeforePast
          )
        )
      ),
    }
  }

  #executePlanTasks(
    logPrefix: string,
    jobDispatcher: JobDispatcher,
    npcFuture: NpcFuture,
    npcObservation: NpcObservation
  ): NpcFuture {
    const { worldSetting, worldState, npcId, currentTime } = npcObservation
    const npcState = findNpcStateFromWorldState(worldState, npcId)
    let { npcRuntime } = npcFuture
    if (npcRuntime === undefined || npcState === undefined) {
      return npcFuture
    }
    const planTasks = advancePlanTasks(currentTime, npcState.planTasks)
    const planTasksAdvanced = planTasks !== npcState.planTasks
    const currentTask = planTasks[0] ?? throwError("planTasks is empty")
    const nextTask = planTasks[1]
    if (nextTask !== undefined) {
      npcFuture = {
        ...npcFuture,
        awakeTime: minWorldTime(npcFuture.awakeTime, nextTask.time),
      }
    }
    // Handling move
    if (npcState === undefined) {
      return npcFuture
    }
    if (planTasksAdvanced) {
      log.info(`${logPrefix} current task: ${currentTask.what}`)
      npcFuture = {
        ...npcFuture,
        npcOperation: {
          ...npcFuture.npcOperation,
          plan: {
            planTasks,
          },
        },
      }
    }
    if (
      npcState.location.staying !== undefined &&
      !samePlace(npcState.location.staying.place, currentTask.place)
    ) {
      npcFuture = {
        ...npcFuture,
        npcOperation: {
          ...npcFuture.npcOperation,
          move: {
            spot: {
              place: currentTask.place,
              groupId: "",
            },
          },
        },
      }
    }
    return npcFuture
  }

  #tryEnterGroup(
    logPrefix: string,
    jobDispatcher: JobDispatcher,
    npcFuture: NpcFuture,
    npcObservation: NpcObservation
  ): NpcFuture {
    const { worldSetting, worldState, npcId, currentTime } = npcObservation
    const chatChoices = listValidChatChoices(worldState, npcId)
    if (chatChoices.length === 0) {
      return npcFuture
    }
    const chatChoice = jobDispatcher(
      "decideChatChoice",
      JSON.stringify(chatChoices),
      async (scope) => {
        return await this.#lightspeedPrompt.decideChatChoice(
          scope,
          "",
          worldSetting,
          currentTime,
          worldState,
          npcId
        )
      }
    )
    if (chatChoice !== undefined) {
      if (chatChoice.kind === "group") {
        npcFuture = {
          ...npcFuture,
          npcOperation: {
            ...npcFuture.npcOperation,
            groupJoin: {
              groupId: chatChoice.value,
            },
          },
        }
      } else if (chatChoice.kind === "npc") {
        npcFuture = {
          ...npcFuture,
          npcOperation: {
            ...npcFuture.npcOperation,
            groupStart: {
              npcId: chatChoice.value,
            },
          },
        }
      }
    }
    return npcFuture
  }

  #tryPostGroup(
    logPrefix: string,
    jobDispatcher: JobDispatcher,
    npcFuture: NpcFuture,
    npcObservation: NpcObservation
  ): NpcFuture {
    const { worldSetting, worldState, npcId, currentTime } = npcObservation
    const npcState = findNpcStateFromWorldState(worldState, npcId)
    const groupId =
      npcState?.location.staying?.groupId ??
      npcState?.location.moving?.spot.groupId
    if (groupId === undefined || groupId === "") {
      // log.info(`${logPrefix} tryPostGroup: no chat due to no group`)
      return npcFuture
    }
    const group = worldState.groups.find(
      (group) => group.groupId === groupId
    )?.group
    if (group === undefined) {
      // log.info(
      //   `${logPrefix} tryPostGroup: no chat due to group being undefined`
      // )
      return npcFuture
    }
    if (arrayLastOrUndefined(group.messages)?.author.npcId === npcId) {
      // log.info(`${logPrefix} tryPostGroup: no chat due to last replied`)
      return npcFuture
    }
    // log.info(`${logPrefix} can say something!!!`)
    const npcResponse = jobDispatcher(
      "decideChatContent",
      JSON.stringify(group.messages),
      async (scope) => {
        return await this.#lightspeedPrompt.decideChatContent(
          scope,
          "",
          worldSetting,
          currentTime,
          worldState,
          npcId
        )
      }
    )
    if (npcResponse === undefined) {
      return npcFuture
    }
    const { content, emotion, action } = npcResponse
    if (content === undefined || content === "") {
      return npcFuture
    }
    return {
      ...npcFuture,
      npcOperation: {
        ...npcFuture.npcOperation,
        groupPost: {
          groupId,
          content,
          emotion,
          action,
        },
      },
    }
  }

  #tryPostTwisser(
    logPrefix: string,
    jobDispatcher: JobDispatcher,
    npcFuture: NpcFuture,
    npcObservation: NpcObservation
  ) {
    const { worldSetting, worldState, npcId, currentTime } = npcObservation
    const npcState = findNpcStateFromWorldState(worldState, npcId)
    let { npcRuntime } = npcFuture

    if (npcRuntime === undefined || npcState === undefined) {
      return npcFuture
    }
    const planTasks = advancePlanTasks(currentTime, npcState.planTasks)
    const currentTask = planTasks[0] ?? throwError("planTasks is empty")
    const nextTask = planTasks[1]
    if (nextTask !== undefined) {
      npcFuture = {
        ...npcFuture,
        awakeTime: minWorldTime(npcFuture.awakeTime, nextTask.time),
      }
    }

    if (npcState === undefined) {
      return npcFuture
    }

    const npcTwisserPost = jobDispatcher(
      "decideTwisserContent",
      JSON.stringify(currentTask),
      async (scope) => {
        const content = await this.#lightspeedPrompt.decideTwisserContent(
          scope,
          "",
          worldSetting,
          currentTime,
          worldState,
          npcId
        )
        const twisserId = buildRandomId()

        return { twisserId, content }
      }
    )
    if (npcTwisserPost === undefined) {
      return npcFuture
    }
    const twisserId = npcTwisserPost.twisserId
    const content = npcTwisserPost.content
    if (content === undefined || content === "") {
      return npcFuture
    }
    if (
      worldState.twissers.find((twisser) => twisser.twisserId === twisserId)
    ) {
      return npcFuture
    }
    return {
      ...npcFuture,
      npcOperation: {
        ...npcFuture.npcOperation,
        twisserPost: {
          twisserId,
          content,
        },
      },
    }
  }

  #tryCommentTwisser(
    logPrefix: string,
    jobDispatcher: JobDispatcher,
    npcFuture: NpcFuture,
    npcObservation: NpcObservation
  ) {
    const { worldSetting, worldState, npcId, currentTime } = npcObservation
    const npcState = findNpcStateFromWorldState(worldState, npcId)
    let { npcRuntime } = npcFuture

    if (npcRuntime === undefined || npcState === undefined) {
      return npcFuture
    }
    const planTasks = advancePlanTasks(currentTime, npcState.planTasks)
    const currentTask = planTasks[0] ?? throwError("planTasks is empty")
    const nextTask = planTasks[1]
    if (nextTask !== undefined) {
      npcFuture = {
        ...npcFuture,
        awakeTime: minWorldTime(npcFuture.awakeTime, nextTask.time),
      }
    }

    if (npcState === undefined) {
      return npcFuture
    }

    if (npcObservation.worldState.twissers === undefined) {
      return npcFuture
    }

    const npcTwisserComment = jobDispatcher(
      "decideTwisserCommentContent",
      JSON.stringify(currentTask),
      async (scope) => {
        if (
          npcObservation.worldState.twissers === undefined ||
          npcObservation.worldState.twissers.length === 0
        )
          return undefined
        const selectedTwisserId =
          npcObservation.worldState.twissers[
            Math.floor(
              Math.random() * npcObservation.worldState.twissers.length
            )
          ]?.twisserId ?? ""
        const commented = npcObservation.worldState.twissers
          .find((twisser) => twisser.twisserId === selectedTwisserId)
          ?.comments.some((comment) => comment.author.npcId === npcId)
        if (commented || commented === undefined) return undefined
        const content =
          await this.#lightspeedPrompt.decideTwisserCommentContent(
            scope,
            "",
            worldSetting,
            currentTime,
            worldState,
            npcId,
            selectedTwisserId
          )
        return { content, selectedTwisserId }
      }
    )

    if (npcTwisserComment === undefined) {
      return npcFuture
    }

    const commented = npcObservation.worldState.twissers
      .find((twisser) => twisser.twisserId === npcTwisserComment.selectedTwisserId)
      ?.comments.some((comment) => comment.author.npcId === npcId)
    if (commented || commented === undefined) return npcFuture

    const content = npcTwisserComment.content
    if (content === undefined || content === "") {
      return npcFuture
    }

    return {
      ...npcFuture,
      npcOperation: {
        ...npcFuture.npcOperation,
        twisserComment: {
          twisserId: npcTwisserComment.selectedTwisserId,
          content: content,
        },
      },
    }
  }

  #tryLikeTwisser(
    logPrefix: string,
    jobDispatcher: JobDispatcher,
    npcFuture: NpcFuture,
    npcObservation: NpcObservation
  ) {
    const { worldSetting, worldState, npcId, currentTime } = npcObservation
    const npcState = findNpcStateFromWorldState(worldState, npcId)
    let { npcRuntime } = npcFuture

    if (npcRuntime === undefined || npcState === undefined) {
      return npcFuture
    }
    const planTasks = advancePlanTasks(currentTime, npcState.planTasks)
    const currentTask = planTasks[0] ?? throwError("planTasks is empty")
    const nextTask = planTasks[1]
    if (nextTask !== undefined) {
      npcFuture = {
        ...npcFuture,
        awakeTime: minWorldTime(npcFuture.awakeTime, nextTask.time),
      }
    }

    if (npcState === undefined) {
      return npcFuture
    }

    if (npcObservation.worldState.twissers === undefined) {
      return npcFuture
    }

    const npcTwisserLike = jobDispatcher(
      "decideTwisserLike",
      JSON.stringify(currentTask),
      async (scope) => {
        console.log("twisser: ", npcObservation.worldState.twissers)
        console.log("twisser: ", npcObservation.worldState.twissers)

        if (
          npcObservation.worldState.twissers === undefined ||
          npcObservation.worldState.twissers.length === 0
        )
          return undefined

        const selectedTwisserId =
          npcObservation.worldState.twissers[
            Math.floor(
              Math.random() * npcObservation.worldState.twissers.length
            )
          ]?.twisserId ?? ""
        const visited = npcState.viewedTwissers.find((viewedTwisser)=>viewedTwisser === selectedTwisserId)

        if (visited) return undefined

        const like =
          await this.#lightspeedPrompt.decideTwisserLike(
            scope,
            "",
            worldSetting,
            currentTime,
            worldState,
            npcId,
            selectedTwisserId
          )
        return { like, selectedTwisserId }
      }
    )

    if (npcTwisserLike === undefined) {
      return npcFuture
    }

    const visited = npcState.viewedTwissers.find((viewedTwisser)=>viewedTwisser === npcTwisserLike.selectedTwisserId)
    if (visited) return npcFuture
    
    const like = npcTwisserLike.like
    if (like === undefined || like === false) {
      return npcFuture
    }

    return {
      ...npcFuture,
      npcOperation: {
        ...npcFuture.npcOperation,
        twisserLike: {
          twisserId: npcTwisserLike.selectedTwisserId,
          like: npcTwisserLike.like,
        },
      },
    }
  }

  runStep(
    logPrefix: string,
    jobDispatcher: JobDispatcher,
    npcFuture: NpcFuture,
    npcObservation: NpcObservation
  ): NpcFuture {
    const { worldSetting, worldState, npcId, currentTime } = npcObservation
    const npcState = findNpcStateFromWorldState(worldState, npcId)
    if (npcFuture.npcRuntime === undefined) {
      const routineTasks = jobDispatcher(
        "generateRoutine",
        JSON.stringify(worldSetting),
        async (scope) => {
          return this.#lightspeedPrompt.generateNpcRoutine(
            scope,
            "",
            worldSetting,
            npcId
          )
        }
      )
      if (routineTasks !== undefined) {
        npcFuture = {
          ...npcFuture,
          npcRuntime: {
            routineTasks,
            adhocTasks: [],
          },
        }
      }
    }
    npcFuture = this.#refreshPlanTasks(
      logPrefix,
      jobDispatcher,
      npcFuture,
      npcObservation
    )
    npcFuture = this.#executePlanTasks(
      logPrefix,
      jobDispatcher,
      npcFuture,
      npcObservation
    )
    npcFuture = this.#tryEnterGroup(
      logPrefix,
      jobDispatcher,
      npcFuture,
      npcObservation
    )
    npcFuture = this.#tryPostGroup(
      logPrefix,
      jobDispatcher,
      npcFuture,
      npcObservation
    )
    npcFuture = this.#tryPostTwisser(
      logPrefix,
      jobDispatcher,
      npcFuture,
      npcObservation
    )
    npcFuture = this.#tryCommentTwisser(
      logPrefix,
      jobDispatcher,
      npcFuture,
      npcObservation
    )
    npcFuture = this.#tryLikeTwisser(
      logPrefix,
      jobDispatcher,
      npcFuture,
      npcObservation
    )
    return npcFuture
  }
}
