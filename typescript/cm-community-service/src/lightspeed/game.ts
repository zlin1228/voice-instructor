import {
  BroadcastController,
  Scope,
  ScopeAttachment,
  SignalController,
  buildAttachmentForCancellation,
  checkAndGetCancelToken,
  launchBackgroundScope,
  runCancellableScope,
  runParallelScopes,
  sleepSeconds,
  sleepUntil,
  sleepUntilCancel,
} from "base-core/lib/scope.js"
import { abortIfUndefined } from "base-core/lib/debug.js"
import {
  arrayMapSequentially,
  arrayToVector,
  byKeyIs,
} from "base-core/lib/array.js"
import { ModelClient, PlayerOperationDoc, SpeechInputDoc } from "./model.js"
import {
  WithId,
  WorldTime,
  buildRandomId,
  dateToWorldTime,
  minWorldTime,
  worldTimeToDate,
  worldTimeToString,
} from "cm-community-common/lib/schema/common.js"
import {
  NpcRoutineTask,
  World,
  Place,
  realTimeToWorldTime,
  worldTimeToRealTime,
  NpcRuntime,
  worldStateType,
  NpcPlanTask,
  WorldSetting,
  worldActiveStateType,
  WorldState,
  WorldRuntime,
  findNpcStateFromWorldState,
  NpcLocation,
  worldRuntimeType,
  Spot,
  PlayerOperation,
  npcStateType,
  GameOperationNpcLocation,
  GameOperation,
  gameOperationType,
} from "cm-community-common/lib/schema/lightspeed.js"
import { JobTracker, WorldSettingAccessor } from "./utils.js"
import { arrayLastOrUndefined } from "base-core/lib/array.js"
import { log } from "base-core/lib/logging.js"
import { swallowException } from "base-core/lib/utils.js"
import { mongodb } from "base-mongodb/lib/deps.js"
import { buildAggregateExpression } from "base-mongodb/lib/expressions.js"
import { dispatchOneOfAsync } from "base-core/lib/one-of.js"
import { nullableType } from "base-core/lib/types.js"
import { WorldController, WorldFuture } from "./world.js"
import { commonNormalizer } from "base-core/lib/types-common.js"
import { npcToString, placeToString, spotToString } from "./prompt.js"
import { throwError } from "base-core/lib/exception.js"
import { stringRandomSimpleName } from "base-core/lib/string.js"
import { npcToSpeechProfile } from "./speech.js"

interface WorldControl {
  readonly worldSignalHolder: {
    current: SignalController<World>
  }
  readonly worldHolder: { current: WithId<World> }
  readonly cancel: (reason: Error) => void
  readonly jobTracker: JobTracker
}

export class GameEngine {
  readonly #modelClient: ModelClient
  readonly #worldController: WorldController

  constructor(modelClient: ModelClient, worldController: WorldController) {
    this.#modelClient = modelClient
    this.#worldController = worldController
  }

  readonly #activeWorlds = new Map<string, WorldControl>()
  readonly #playerOperationBroadcast =
    new BroadcastController<PlayerOperationDoc>()
  readonly #speechInputBroadcast = new BroadcastController<SpeechInputDoc>()

  async #runWorldStep(
    scope: Scope,
    worldId: string,
    playerOperations: readonly PlayerOperation[],
    gameOperations: readonly GameOperation[]
  ): Promise<{
    awakeTime: WorldTime
    worldRuntime: WorldRuntime
    worldState: WorldState
  }> {
    const worldControl = abortIfUndefined(this.#activeWorlds.get(worldId))
    const { worldHolder, jobTracker } = worldControl
    let { worldSetting, worldRuntime, worldState } = worldHolder.current
    const logPrefix = `${worldSetting.name}(${worldId})`
    const currentTime = realTimeToWorldTime(worldState, new Date())
    log.info(
      `${logPrefix} Running world step - ${worldTimeToString(currentTime)}`
    )
    await sleepSeconds(scope, 0.1) // Don't run it too fast
    let worldFuture: WorldFuture = {
      awakeTime: dateToWorldTime(
        new Date(worldTimeToDate(currentTime).getTime() + 1000 * 60 * 60 * 24)
      ),
      worldRuntime,
      worldOperation: {
        npcOperations: [],
      },
    }
    worldState = {
      ...worldState,
      npcs: await arrayMapSequentially(worldState.npcs, async (npc) => {
        const npcState = npc.npcState
        if (npcState.location.moving?.timeToArrival === undefined) {
          return npc
        }
        if (
          worldTimeToDate(npcState.location.moving.timeToArrival) <=
          worldTimeToDate(currentTime)
        ) {
          log.info(
            `${logPrefix} NPC ${npcToString(
              worldSetting,
              npc.npcId
            )} arrived at ${spotToString(
              worldSetting,
              npcState.location.moving.spot
            )}`
          )
          await this.#modelClient.writeWorldEvent(scope, {
            worldId,
            realTime: new Date(),
            worldTime: currentTime,
            eventName: "npcEvent",
            npcEvent: {
              npcId: npc.npcId,
              eventName: "stay",
              stay: {
                spot: npcState.location.moving.spot,
              },
            },
          })
          const npcLocation: NpcLocation = {
            staying: npcState.location.moving.spot,
          }
          return {
            npcId: npc.npcId,
            npcState: {
              ...npcState,
              location: npcLocation,
            },
          }
        } else {
          worldFuture = {
            ...worldFuture,
            awakeTime: minWorldTime(
              worldFuture.awakeTime,
              npcState.location.moving.timeToArrival
            ),
          }
        }
        return npc
      }),
      players: [
        ...worldState.players,
        ...worldSetting.players
          .filter(
            (player) =>
              !worldState.players.some((p) => p.playerId === player._id)
          )
          .map((player) => ({
            playerId: player._id,
            playerState: {},
          })),
      ],
    }
    let {
      awakeTime,
      worldRuntime: updatedWorldRuntime,
      worldOperation,
    } = this.#worldController.runStep(
      logPrefix,
      (id, signature, fn) => jobTracker.dispatch(id, signature, fn),
      worldFuture,
      {
        worldSetting,
        worldState,
        currentTime,
      }
    )
    let updatedWorldState = worldState
    // log.info(`${logPrefix} NPC operations: `)
    // console.log(JSON.stringify(worldOperation.npcOperations))
    for (const { npcId, npcOperation } of worldOperation.npcOperations) {
      if (npcOperation.birth !== undefined) {
        log.info(
          `${logPrefix} NPC ${npcToString(
            worldSetting,
            npcId
          )} born at ${spotToString(worldSetting, npcOperation.birth.spot)}`
        )
        await this.#modelClient.writeWorldEvent(scope, {
          worldId,
          realTime: new Date(),
          worldTime: currentTime,
          eventName: "npcEvent",
          npcEvent: {
            npcId,
            eventName: "born",
            born: {
              spot: npcOperation.birth.spot,
            },
          },
        })
        const npcState = findNpcStateFromWorldState(updatedWorldState, npcId)
        const npcLocation: NpcLocation = {
          staying: npcOperation.birth.spot,
        }
        updatedWorldState = {
          ...updatedWorldState,
          npcs:
            npcState === undefined
              ? [
                  ...updatedWorldState.npcs,
                  {
                    npcId,
                    npcState: {
                      location: npcLocation,
                      planTasks: [],
                      emotion: "",
                      action: "",
                      viewedTwissers:[],
                    },
                  },
                ]
              : updatedWorldState.npcs.map((npc) =>
                  npc.npcId === npcId
                    ? {
                        npcId,
                        npcState: {
                          ...npcState,
                          location: npcLocation,
                        },
                      }
                    : npc
                ),
        }
      }
      if (npcOperation.move !== undefined) {
        log.info(
          `${logPrefix} NPC ${npcToString(
            worldSetting,
            npcId
          )} starts moving to ${spotToString(
            worldSetting,
            npcOperation.move.spot
          )}`
        )
        const npcState = findNpcStateFromWorldState(updatedWorldState, npcId)
        const timeToArrival = dateToWorldTime(
          new Date(
            worldTimeToDate(currentTime).getTime() +
              1000 * 60 * 10 +
              Math.random() * 1000 * 60 * 10
          ) // TODO
        )
        awakeTime = minWorldTime(awakeTime, timeToArrival)
        await this.#modelClient.writeWorldEvent(scope, {
          worldId,
          realTime: new Date(),
          worldTime: currentTime,
          eventName: "npcEvent",
          npcEvent: {
            npcId,
            eventName: "move",
            move: {
              fromSpot: npcState?.location.staying ?? npcOperation.move.spot,
              toSpot: npcOperation.move.spot,
            },
          },
        })
        const npcLocation: NpcLocation = {
          moving: {
            spot: npcOperation.move.spot,
            timeToArrival,
          },
        }
        updatedWorldState = {
          ...updatedWorldState,
          npcs:
            npcState === undefined
              ? [
                  ...updatedWorldState.npcs,
                  {
                    npcId,
                    npcState: {
                      location: npcLocation,
                      planTasks: [],
                      emotion: "",
                      action: "",
                      viewedTwissers: [],
                    },
                  },
                ]
              : updatedWorldState.npcs.map((npc) =>
                  npc.npcId === npcId
                    ? {
                        npcId,
                        npcState: {
                          ...npcState,
                          location: npcLocation,
                        },
                      }
                    : npc
                ),
        }
      }
      if (npcOperation.plan !== undefined) {
        const updatedPlanTasks = npcOperation.plan.planTasks
        log.info(
          `${logPrefix} NPC ${npcToString(
            worldSetting,
            npcId
          )} updates plan tasks`
        )
        for (const planTask of updatedPlanTasks) {
          console.log(
            `  ${logPrefix} ${worldTimeToString(planTask.time)} ${placeToString(
              worldSetting,
              planTask.place
            )} : ${planTask.what}`
          )
        }
        updatedWorldState = {
          ...updatedWorldState,
          npcs: updatedWorldState.npcs.map((npc) =>
            npc.npcId === npcId
              ? {
                  npcId,
                  npcState: {
                    ...npc.npcState,
                    planTasks: updatedPlanTasks,
                  },
                }
              : npc
          ),
        }
        await this.#modelClient.writeWorldEvent(scope, {
          worldId,
          realTime: new Date(),
          worldTime: currentTime,
          eventName: "npcEvent",
          npcEvent: {
            npcId,
            eventName: "plan",
            plan: {
              planTasks: updatedPlanTasks,
            },
          },
        })
      }
      if (npcOperation.groupJoin !== undefined) {
        log.info(
          `${logPrefix} NPC ${npcToString(worldSetting, npcId)} joins group ${
            npcOperation.groupJoin.groupId
          }`
        )
        const npcState = findNpcStateFromWorldState(updatedWorldState, npcId)
        if (npcState !== undefined) {
          const timeToArrival = dateToWorldTime(
            new Date(
              worldTimeToDate(currentTime).getTime() +
                1000 * 30 +
                Math.random() * 1000 * 10
            ) // TODO
          )
          awakeTime = minWorldTime(awakeTime, timeToArrival)
          const fromSpot =
            npcState.location.staying ?? throwError("Invalid NPC location")
          const toSpot: Spot = {
            place: fromSpot.place,
            groupId: npcOperation.groupJoin.groupId,
          }
          await this.#modelClient.writeWorldEvent(scope, {
            worldId,
            realTime: new Date(),
            worldTime: currentTime,
            eventName: "npcEvent",
            npcEvent: {
              npcId,
              eventName: "move",
              move: {
                fromSpot: fromSpot,
                toSpot,
              },
            },
          })
          const npcLocation: NpcLocation = {
            moving: {
              spot: toSpot,
              timeToArrival,
            },
          }
          updatedWorldState = {
            ...updatedWorldState,
            npcs: updatedWorldState.npcs.map((npc) =>
              npc.npcId === npcId
                ? {
                    npcId,
                    npcState: {
                      ...npcState,
                      location: npcLocation,
                    },
                  }
                : npc
            ),
          }
        }
      }
      if (npcOperation.groupStart !== undefined) {
        log.info(
          `${logPrefix} NPC ${npcToString(
            worldSetting,
            npcId
          )} starts group with NPC ${npcOperation.groupStart.npcId}`
        )
        const groupId = stringRandomSimpleName(8)
        if (
          findNpcStateFromWorldState(updatedWorldState, npcId)?.location
            .staying !== undefined &&
          findNpcStateFromWorldState(
            updatedWorldState,
            npcOperation.groupStart.npcId
          )?.location.staying !== undefined
        ) {
          for (const groupNpcId of [npcId, npcOperation.groupStart.npcId]) {
            const npcState = findNpcStateFromWorldState(
              updatedWorldState,
              groupNpcId
            )
            if (npcState === undefined) {
              continue
            }
            const timeToArrival = dateToWorldTime(
              new Date(
                worldTimeToDate(currentTime).getTime() +
                  1000 * 30 +
                  Math.random() * 1000 * 10
              ) // TODO
            )
            awakeTime = minWorldTime(awakeTime, timeToArrival)
            const fromSpot =
              npcState.location.staying ?? throwError("Invalid NPC location")
            const toSpot: Spot = {
              place: fromSpot.place,
              groupId: groupId,
            }
            await this.#modelClient.writeWorldEvent(scope, {
              worldId,
              realTime: new Date(),
              worldTime: currentTime,
              eventName: "npcEvent",
              npcEvent: {
                npcId,
                eventName: "move",
                move: {
                  fromSpot: fromSpot,
                  toSpot,
                },
              },
            })
            const npcLocation: NpcLocation = {
              moving: {
                spot: toSpot,
                timeToArrival,
              },
            }
            updatedWorldState = {
              ...updatedWorldState,
              npcs: updatedWorldState.npcs.map((npc) =>
                npc.npcId === groupNpcId
                  ? {
                      npcId: groupNpcId,
                      npcState: {
                        ...npcState,
                        location: npcLocation,
                      },
                    }
                  : npc
              ),
              groups: [
                ...updatedWorldState.groups,
                ...(groupNpcId === npcId
                  ? [
                      {
                        groupId,
                        group: {
                          messages: [],
                        },
                      },
                    ]
                  : []),
              ],
            }
          }
        }
      }
      if (npcOperation.groupPost !== undefined) {
        const groupPost = npcOperation.groupPost
        log.info(
          `${logPrefix} NPC ${npcToString(
            worldSetting,
            npcId
          )} posts message to group ${npcOperation.groupPost.groupId}`
        )
        const realTime = new Date()
        await this.#modelClient.writeWorldEvent(scope, {
          worldId,
          realTime,
          worldTime: currentTime,
          eventName: "groupEvent",
          groupEvent: {
            groupId: npcOperation.groupPost.groupId,
            eventName: "post",
            post: {
              time: currentTime,
              npcId,
              content: npcOperation.groupPost.content,
              emotion: npcOperation.groupPost.emotion,
              action: npcOperation.groupPost.action,
            },
          },
        })
        for (const player of updatedWorldState.players) {
          if (player.playerState.groupId !== npcOperation.groupPost.groupId) {
            continue
          }
          await this.#modelClient.speechOutputCollection.createIfNotExists(
            scope,
            {
              _id: stringRandomSimpleName(8),
              key: `${worldId}:${player.playerId}`,
              speechProfile: npcToSpeechProfile(
                worldId,
                npcId,
                worldSetting.npcs.find(byKeyIs("_id", npcId)) ??
                  throwError("NPC not found")
              ),
              time: realTime,
              content: npcOperation.groupPost.content,
            }
          )
        }
        updatedWorldState = {
          ...updatedWorldState,
          groups: updatedWorldState.groups.map((group) =>
            group.groupId === groupPost.groupId
              ? {
                  groupId: group.groupId,
                  group: {
                    messages: [
                      ...group.group.messages,
                      {
                        time: currentTime,
                        author: {
                          npcId,
                        },
                        content: groupPost.content,
                        emotion: groupPost.emotion,
                        action: groupPost.action,
                      },
                    ],
                  },
                }
              : group
          ),
          npcs: updatedWorldState.npcs.map((npc) =>
            npc.npcId === npcId
              ? {
                  npcId: npcId,
                  npcState: {
                    ...npc.npcState,
                    emotion: groupPost.emotion,
                    action: groupPost.action,
                  },
                }
              : npc
          ),
        }
      }
      if (npcOperation.twisserPost !== undefined) {
        const newPost = npcOperation.twisserPost
        const realTime = new Date()
        await this.#modelClient.writeWorldEvent(scope, {
          worldId,
          realTime,
          worldTime: currentTime,
          eventName: "worldEventTwisserPost",
          worldEventTwisserPost: {
            time: currentTime,
            npcId: npcId,
            content: npcOperation.twisserPost.content,
          },
        })
        // for (const player of updatedWorldState.players) {
        //   if (player.playerState.groupId !== npcOperation.groupPost.groupId) {
        //     continue
        //   }
        //   await this.#modelClient.speechOutputCollection.createIfNotExists(
        //     scope,
        //     {
        //       _id: stringRandomSimpleName(8),
        //       key: `${worldId}:${player.playerId}`,
        //       speechProfile: npcToSpeechProfile(
        //         worldId,
        //         npcId,
        //         worldSetting.npcs.find(byKeyIs("_id", npcId)) ??
        //           throwError("NPC not found")
        //       ),
        //       time: realTime,
        //       content: npcOperation.groupPost.content,
        //     }
        //   )
        // }
        updatedWorldState = {
          ...updatedWorldState,
          twissers: [
            ...updatedWorldState.twissers,
            {
              twisserId: newPost.twisserId,
              time: currentTime,
              author: {
                npcId: npcId,
              },
              content: newPost.content,
              likes: [],
              comments: [],
            },
          ],
        }
      }
      if (npcOperation.twisserComment !== undefined) {
        const realTime = new Date()

        await this.#modelClient.writeWorldEvent(scope, {
          worldId,
          realTime,
          worldTime: currentTime,
          eventName: "worldEventTwisserComment",
          worldEventTwisserComment: {
            time: currentTime,
            npcId: npcId,
            content: npcOperation.twisserComment.content,
          },
        })
        updatedWorldState = {
          ...updatedWorldState,
          twissers: updatedWorldState.twissers.map((twisser) =>
            twisser.twisserId !== npcOperation.twisserComment?.twisserId
              ? twisser
              : {
                  ...twisser,
                  comments: [
                    ...twisser.comments,
                    {
                      ...npcOperation.twisserComment,
                      time: currentTime,
                      author: { npcId: npcId },
                    },
                  ],
                }
          ),
        }
      }

      const currTwisserLike = npcOperation.twisserLike
      if (currTwisserLike !== undefined) {
        const realTime = new Date()
        const npcState = findNpcStateFromWorldState(updatedWorldState, npcId)
        await this.#modelClient.writeWorldEvent(scope, {
          worldId,
          realTime,
          worldTime: currentTime,
          eventName: "worldEventTwisserLike",
          worldEventTwisserLike: {
            time: currentTime,
            npcId: npcId,
            twisserId: currTwisserLike.twisserId,
          },
        })
        if (npcState !== undefined) {
          updatedWorldState = {
            ...updatedWorldState,
            npcs:
              updatedWorldState.npcs.map((npc) =>
                    npc.npcId === npcId
                      ? {
                          npcId,
                          npcState: {
                            ...npcState,
                            viewedTwissers: [...npc.npcState.viewedTwissers, currTwisserLike.twisserId],
                          },
                        }
                      : npc
                  ),
            twissers: updatedWorldState.twissers.map((twisser) =>
              twisser.twisserId !== currTwisserLike.twisserId
                ? twisser
                : {
                    ...twisser,
                    likes: [
                      ...twisser.likes,
                      {
                        ...currTwisserLike,
                        time: currentTime,
                        owner: { npcId: npcId },
                      },
                    ],
                  }
            ),
          }
        }
      }
    }
    console.log("game operation:", gameOperations)
    for (const gameOperation of gameOperations) {
      if (gameOperation.gameOperationNpcLocation === undefined) {
        log.info(`NPC location is not available yet`)
        continue
      }
      if (gameOperation.gameOperationNpcLocation.spot === undefined) {
        log.info(
          `NPC's [${gameOperation.gameOperationNpcLocation.npcId}] spot is not available yet`
        )
        continue
      }
      const { npcId, spot } = gameOperation.gameOperationNpcLocation
      const npcState = findNpcStateFromWorldState(worldState, npcId)
      if (npcState !== undefined) {
        console.log("npcState updated with npc stop moving")
        updatedWorldState = {
          ...updatedWorldState,
          npcs: updatedWorldState.npcs.map((npc) =>
            npc.npcId === npcId
              ? {
                  npcId,
                  npcState: {
                    ...npcState,
                    location: {
                      staying: spot,
                    },
                  },
                }
              : npc
          ),
        }
        await this.#modelClient.writeWorldEvent(scope, {
          worldId,
          realTime: new Date(),
          worldTime: currentTime,
          eventName: "npcEvent",
          npcEvent: {
            npcId: npcId,
            eventName: "stay",
            stay: {
              spot: spot,
            },
          },
        })
      }
    }
    for (const playerOperation of playerOperations) {
      const { playerId, groupStart, groupJoin, groupLeave, groupPost, likePost } =
        playerOperation
      if (groupStart !== undefined) {
        const { npcId } = groupStart
        const npcState = findNpcStateFromWorldState(updatedWorldState, npcId)
        const groupId = stringRandomSimpleName(8)
        if (npcState === undefined) {
          log.info(
            `Player [${playerId}] wants to chat with NPC [${npcId}], but NPC state is not available yet`
          )
          continue
        }
        if (npcState.location.staying !== undefined) {
          const staying = npcState.location.staying
          const currentGroupId = staying.groupId
          if (currentGroupId !== "") {
            log.info(
              `Player [${playerId}] wants to chat with NPC [${npcId}], but NPC is already in a group`
            )
            continue
          }
          await this.#modelClient.writeWorldEvent(scope, {
            worldId,
            realTime: new Date(),
            worldTime: currentTime,
            eventName: "groupEvent",
            groupEvent: {
              groupId: groupId,
              eventName: "join",
              join: {
                playerId,
              },
            },
          })
          updatedWorldState = {
            ...updatedWorldState,
            npcs: updatedWorldState.npcs.map((npc) =>
              npc.npcId === npcId
                ? {
                    npcId,
                    npcState: {
                      ...npcState,
                      location: {
                        staying: {
                          ...staying,
                          groupId,
                        },
                      },
                    },
                  }
                : npc
            ),
            players: updatedWorldState.players.map((player) =>
              player.playerId === playerId
                ? {
                    playerId,
                    playerState: {
                      ...player.playerState,
                      groupId,
                    },
                  }
                : player
            ),
            groups: [
              ...updatedWorldState.groups,
              {
                groupId,
                group: {
                  messages: [],
                },
              },
            ],
          }
        } else if (npcState.location.moving !== undefined) {
          const moving = npcState.location.moving
          const currentGroupId = moving.spot.groupId
          if (currentGroupId !== "") {
            log.info(
              `Player [${playerId}] wants to chat with NPC [${npcId}], but NPC is already in a group`
            )
            continue
          }
          await this.#modelClient.writeWorldEvent(scope, {
            worldId,
            realTime: new Date(),
            worldTime: currentTime,
            eventName: "groupEvent",
            groupEvent: {
              groupId: groupId,
              eventName: "join",
              join: {
                playerId,
              },
            },
          })
          updatedWorldState = {
            ...updatedWorldState,
            npcs: updatedWorldState.npcs.map((npc) =>
              npc.npcId === npcId
                ? {
                    npcId,
                    npcState: {
                      ...npcState,
                      location: {
                        moving: {
                          ...moving,
                          spot: {
                            ...moving.spot,
                            groupId,
                          },
                        },
                      },
                    },
                  }
                : npc
            ),
            players: updatedWorldState.players.map((player) =>
              player.playerId === playerId
                ? {
                    playerId,
                    playerState: {
                      ...player.playerState,
                      groupId,
                    },
                  }
                : player
            ),
          }
        }
      }
      if (groupJoin !== undefined) {
        const { groupId } = groupJoin
        if (
          updatedWorldState.groups.find(byKeyIs("groupId", groupId)) ===
          undefined
        ) {
          log.info(
            `Player [${playerId}] wants to join group [${groupId}], but the group is not found`
          )
          continue
        }
        await this.#modelClient.writeWorldEvent(scope, {
          worldId,
          realTime: new Date(),
          worldTime: currentTime,
          eventName: "groupEvent",
          groupEvent: {
            groupId: groupId,
            eventName: "join",
            join: {
              playerId,
            },
          },
        })
        updatedWorldState = {
          ...updatedWorldState,
          players: updatedWorldState.players.map((player) =>
            player.playerId === playerId
              ? {
                  playerId,
                  playerState: {
                    ...player.playerState,
                    groupId,
                  },
                }
              : player
          ),
        }
      }
      if (groupLeave !== undefined) {
        updatedWorldState = {
          ...updatedWorldState,
          players: updatedWorldState.players.map((player) =>
            player.playerId === playerId
              ? {
                  playerId,
                  playerState: {
                    ...player.playerState,
                    groupId: undefined,
                  },
                }
              : player
          ),
        }
      }
      if (groupPost !== undefined) {
        await this.#modelClient.writeWorldEvent(scope, {
          worldId,
          realTime: new Date(),
          worldTime: currentTime,
          eventName: "groupEvent",
          groupEvent: {
            groupId: groupPost.groupId,
            eventName: "post",
            post: {
              time: currentTime,
              playerId,
              content: groupPost.content,
              emotion: "",
              action: "",
            },
          },
        })
        updatedWorldState = {
          ...updatedWorldState,
          groups: updatedWorldState.groups.map((group) =>
            group.groupId === groupPost.groupId
              ? {
                  groupId: group.groupId,
                  group: {
                    messages: [
                      ...group.group.messages,
                      {
                        time: currentTime,
                        author: {
                          playerId,
                        },
                        content: groupPost.content,
                      },
                    ],
                  },
                }
              : group
          ),
        }
      }
      if (likePost !== undefined) {
        await this.#modelClient.writeWorldEvent(scope, {
          worldId,
          realTime: new Date(),
          worldTime: currentTime,
          eventName: "worldEventTwisserLike",
          worldEventTwisserLike: {
            time: currentTime,
            playerId: "lj",
            twisserId: likePost.twisserId,
          },
        })
        updatedWorldState = {
          ...updatedWorldState,
          twissers: updatedWorldState.twissers.map((twisser) =>
              twisser.twisserId !== likePost.twisserId
                ? twisser
                : {
                    ...twisser,
                    likes: [
                      ...twisser.likes,
                      {
                        twisserId: likePost.twisserId,
                        time: currentTime,
                        owner: { playerId: "lj" },
                      },
                    ],
                  }
            ),
        }
      }
    }
    jobTracker.commit(async (scope) => {
      worldControl.worldSignalHolder.current.emit(
        worldControl.worldHolder.current
      )
      worldControl.worldSignalHolder.current = new SignalController()
    })
    // log.info(`Latest awake time: ${worldTimeToString(awakeTime)}`)
    return {
      awakeTime,
      worldRuntime: updatedWorldRuntime,
      worldState: updatedWorldState,
    }
  }

  async #launchWorld(scope: Scope, world: WithId<World>): Promise<void> {
    if (this.#activeWorlds.has(world._id)) return
    log.info(`Launching world ${world.worldSetting.name}(${world._id})`)
    const realCurrentTime = new Date()
    await this.#modelClient.writeWorldEvent(scope, {
      worldId: world._id,
      realTime: realCurrentTime,
      worldTime: realTimeToWorldTime(world.worldState, realCurrentTime),
      eventName: "worldEventStart",
      worldEventStart: {
        timeRate: world.worldState.activeState?.timeRate ?? 0,
        stopTime: world.worldState.activeState?.stopTime,
      },
    })
    const worldHolder = { current: world }
    launchBackgroundScope(scope, async (scope) => {
      try {
        await runCancellableScope(scope, async (scope, cancel) => {
          const cancelToken = checkAndGetCancelToken(scope)
          const jobTracker = new JobTracker(
            scope,
            `${world.worldSetting.name}(${world._id})`
          )
          if (this.#activeWorlds.has(world._id)) {
            return
          }
          const worldSignalHolder = { current: new SignalController<World>() }
          this.#activeWorlds.set(world._id, {
            worldSignalHolder,
            worldHolder,
            cancel,
            jobTracker,
          })
          let playerOperations: PlayerOperation[] = []
          let gameOperations: GameOperation[] = []
          this.#playerOperationBroadcast.listen(scope, (playerOperationDoc) => {
            if (playerOperationDoc.worldId !== world._id) return
            if (playerOperationDoc.operation !== undefined)
              playerOperations.push(playerOperationDoc.operation)
            if (playerOperationDoc.gameOperation !== undefined) {
              gameOperations.push(playerOperationDoc.gameOperation)
            }

            worldSignalHolder.current.emit(world)
            worldSignalHolder.current = new SignalController()
          })
          this.#speechInputBroadcast.listen(scope, (speechInputDoc) => {
            const worldAndPlayer = arrayToVector(
              speechInputDoc.key.split(":"),
              2
            )
            if (worldAndPlayer === undefined) {
              log.info(`Invalid speech input key: ${speechInputDoc.key}`)
              return
            }
            if (worldAndPlayer[0] !== world._id) return
            const playerId = worldAndPlayer[1]
            const playerState = worldHolder.current.worldState.players.find(
              byKeyIs("playerId", playerId)
            )
            const groupId = playerState?.playerState.groupId
            if (groupId === undefined) {
              log.info(
                `Player [${playerId}] speeks something but is not in a group`
              )
              return
            }
            playerOperations.push({
              playerId,
              type: "groupPost",
              groupPost: {
                groupId,
                content: speechInputDoc.content,
              },
            })
            worldSignalHolder.current.emit(world)
            worldSignalHolder.current = new SignalController()
          })
          while (cancelToken.cancelReason === undefined) {
            const stopTime =
              worldHolder.current.worldState.activeState?.stopTime ??
              new Date(2100, 0, 1)
            if (stopTime <= new Date()) {
              await this.#modelClient.worldCollection.updateById(
                scope,
                world._id,
                {
                  $set: {
                    "worldState.activeState": null,
                  },
                }
              )
              break
            }
            const currentPlayerOperations = playerOperations
            playerOperations = []
            const currentGameOperations = gameOperations
            gameOperations = []
            const { awakeTime, worldRuntime, worldState } =
              await this.#runWorldStep(
                scope,
                world._id,
                currentPlayerOperations,
                currentGameOperations
              )
            if (
              JSON.stringify(
                commonNormalizer(worldRuntimeType, worldRuntime)
              ) !==
                JSON.stringify(
                  commonNormalizer(worldRuntimeType, world.worldRuntime)
                ) ||
              JSON.stringify(commonNormalizer(worldStateType, worldState)) !==
                JSON.stringify(
                  commonNormalizer(worldStateType, world.worldState)
                )
            ) {
              // log.info(
              //   `${world.worldSetting.name}(${world._id}) Writing world to database`
              // )
              // console.log(worldState)
              await this.#modelClient.worldCollection.updateById(
                scope,
                world._id,
                {
                  $set: {
                    worldRuntime: worldRuntime,
                    worldState: worldState,
                  },
                }
              )
            }
            const realTime = worldTimeToRealTime(
              worldHolder.current.worldState,
              awakeTime
            )
            const { cancel, attachment } = buildAttachmentForCancellation(true)
            const cancelError = new Error("world updated")
            worldSignalHolder.current.onceReady(scope, (world) => {
              cancel(cancelError)
            })
            try {
              await Scope.with(scope, [attachment], async (scope) => {
                const stopTime =
                  worldHolder.current.worldState.activeState?.stopTime ??
                  new Date(2100, 0, 1)
                const untilTime = realTime < stopTime ? realTime : stopTime
                await sleepUntil(scope, untilTime)
              })
            } catch (e) {
              if (e !== cancelError) throw e
            }
          }
        })
      } finally {
        const stopTime = worldHolder.current.worldState.activeState?.stopTime
        if (stopTime !== undefined && stopTime <= new Date()) {
          await this.#modelClient.worldCollection.updateById(scope, world._id, {
            $set: {
              "worldState.referenceWorldTime": realTimeToWorldTime(
                worldHolder.current.worldState,
                new Date()
              ),
              "worldState.activeState": null,
            },
          })
        }
      }
    })
  }

  async #terminateWorld(scope: Scope, worldId: string): Promise<void> {
    log.info(`Terminating world ${worldId}`)
    const worldState = this.#activeWorlds.get(worldId)
    if (worldState === undefined) return
    worldState.cancel(new Error("world terminated"))
    this.#activeWorlds.delete(worldId)
    const realCurrentTime = new Date()
    await this.#modelClient.writeWorldEvent(scope, {
      worldId: worldId,
      realTime: realCurrentTime,
      worldTime: realTimeToWorldTime(
        worldState.worldHolder.current.worldState,
        realCurrentTime
      ),
      eventName: "worldEventStop",
      worldEventStop: {},
    })
  }

  async #updateWorld(scope: Scope, world: WithId<World>): Promise<void> {
    // log.info(`World updated: ${world.worldSetting.name}(${world._id})`)
    const worldState = this.#activeWorlds.get(world._id)
    if (worldState === undefined) return
    const { worldSignalHolder, worldHolder } = worldState
    worldHolder.current = world
    worldSignalHolder.current.emit(world)
    worldSignalHolder.current = new SignalController()
  }

  async run(scope: Scope): Promise<void> {
    launchBackgroundScope(scope, async (scope) => {
      for await (const playerOperationDoc of this.#modelClient.playerOperationCollection.findAndWatch(
        scope,
        (pipeline) => pipeline
      )) {
        if (playerOperationDoc.kind !== "create") {
          continue
        }
        this.#playerOperationBroadcast.emit(playerOperationDoc.value)
      }
    })
    launchBackgroundScope(scope, async (scope) => {
      for await (const speechInputDoc of this.#modelClient.speechInputCollection.findAndWatch(
        scope,
        (pipeline) => pipeline
      )) {
        if (speechInputDoc.kind !== "create") {
          continue
        }
        this.#speechInputBroadcast.emit(speechInputDoc.value)
      }
    })
    for (const world of await this.#modelClient.worldCollection
      .find(scope, {
        "worldState.activeState": { $ne: null },
      })
      .toArray()) {
      await this.#launchWorld(scope, world)
    }
    const worldChangeStream = this.#modelClient.worldCollection.findAndWatch(
      scope,
      (pipeline) => pipeline
    )
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
}
