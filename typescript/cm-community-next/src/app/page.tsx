"use client"
import { useState, useEffect } from "react"

import { HandlingQueue, checkAndGetAbortSignal } from "base-core/lib/scope.js"
import { withGlobalService } from "../client-service"
import { WithId } from "cm-community-common/lib/schema/common.js"
import {
  World,
  House,
  WorldSetting,
  playerControlClientType,
  playerControlServerType,
  PlayerControlServer,
  StartWorldRequest,
  StopWorldRequest,
  npcEventType,
  PlayerControlClient,
  resetWorldRequestType,
  ResetWorldRequest,
} from "cm-community-common/lib/schema/lightspeed.js"

import { WorldPanel } from "./world"
import { HouseListPanel } from "./house"
import { BuildingPanel } from "./building"
import { NpcPropertiesPanel } from "./properties"
import { NpcRelationshipPanel } from "./relationship"
import { demoWorldSetting } from "cm-community-common/lib/schema/lightspeed-demo.js"
import { connectWebSocket } from "@/websocket"
import { NpcDetails } from "./npcDetails"
import { ChatRoom } from "./chatRoom"
import { MessagePanel } from "./messages"
import { OneOf } from "base-core/lib/one-of"
import { Twisser } from "./socialApp"

export default function Home() {
  const [worlds, setWorlds] = useState<readonly WithId<World>[]>()
  const [selectedWorldId, setSelectedWorldId] = useState<string | undefined>()
  const [deletedHouseId, setDeletedHouseId] = useState<string | undefined>()
  const [deletedBuildingId, setDeletedBuidlingId] = useState<
    string | undefined
  >()
  const [playerControlMessages, setPlayerControlMessages] = useState<
    PlayerControlServer[]
  >([])
  const [playerQueue, setPlayerQueue] =
    useState<
      HandlingQueue<
        OneOf<{ json: PlayerControlClient; binary: Uint8Array | Blob }>
      >
    >()

  const selectedWorld: WithId<World> | undefined =
    worlds === undefined
      ? undefined
      : selectedWorldId === undefined
      ? undefined
      : worlds.filter((world) => world._id === selectedWorldId)[0]

  const handleSelectedWorldIdChange = (worldId: string) => {
    setSelectedWorldId(worldId)
  }

  const handleWorldChange = (modifiedWorldSetting: WithId<WorldSetting>) => {
    withGlobalService(async (scope, clientService) => {
      await clientService.getLightspeedClient().post_updateWorldSetting.fetch(
        {
          worldId: modifiedWorldSetting._id,
          worldSetting: modifiedWorldSetting,
        },
        checkAndGetAbortSignal(scope)
      )
      setWorlds(
        await clientService
          .getLightspeedClient()
          .get_listWorlds.fetch({}, checkAndGetAbortSignal(scope))
      )
    })
  }

  const handleWorldDelete = (worldId: string) => {
    withGlobalService(async (scope, clientService) => {
      await clientService
        .getLightspeedClient()
        .post_deleteWorld.fetch({ worldId }, checkAndGetAbortSignal(scope))
      setSelectedWorldId(undefined)
      setWorlds(
        await clientService
          .getLightspeedClient()
          .get_listWorlds.fetch({}, checkAndGetAbortSignal(scope))
      )
    })
  }

  const handleWorldCreate = (newWorldSetting: WorldSetting) => {
    withGlobalService(async (scope, clientService) => {
      const newWorld = await clientService
        .getLightspeedClient()
        .post_createWorld.fetch(newWorldSetting, checkAndGetAbortSignal(scope))
      setWorlds(
        await clientService
          .getLightspeedClient()
          .get_listWorlds.fetch({}, checkAndGetAbortSignal(scope))
      )
      setSelectedWorldId(newWorld._id)
    })
  }

  const handleCreateButton = () => {
    setSelectedWorldId(undefined)
  }

  const handleCreateDemoWorldClick = () => {
    withGlobalService(async (scope, clientService) => {
      await clientService
        .getLightspeedClient()
        .post_createWorld.fetch(demoWorldSetting, checkAndGetAbortSignal(scope))
      setWorlds(
        await clientService
          .getLightspeedClient()
          .get_listWorlds.fetch({}, checkAndGetAbortSignal(scope))
      )
    })
  }

  const handleStartWorld = (startWorldRequest: StartWorldRequest) => {
    withGlobalService(async (scope, clientService) => {
      await clientService
        .getLightspeedClient()
        .post_startWorld.fetch(startWorldRequest, checkAndGetAbortSignal(scope))
      setWorlds(
        await clientService
          .getLightspeedClient()
          .get_listWorlds.fetch({}, checkAndGetAbortSignal(scope))
      )
    })
  }

  const handleResetWorld = (resetWorldRequest: ResetWorldRequest) => {
    withGlobalService(async (scope, clientService) => {
      await clientService
        .getLightspeedClient()
        .post_resetWorld.fetch(resetWorldRequest, checkAndGetAbortSignal(scope))
      setWorlds(
        await clientService
          .getLightspeedClient()
          .get_listWorlds.fetch({}, checkAndGetAbortSignal(scope))
      )
    })
  }

  const handleStopWorld = (stopWorldRequest: StopWorldRequest) => {
    withGlobalService(async (scope, clientService) => {
      await clientService
        .getLightspeedClient()
        .post_stopWorld.fetch(stopWorldRequest, checkAndGetAbortSignal(scope))
      setWorlds(
        await clientService
          .getLightspeedClient()
          .get_listWorlds.fetch({}, checkAndGetAbortSignal(scope))
      )
    })
  }

  const handleChatClick = (selectedNpcId: string) => {
    const selectedNpcState = selectedWorld?.worldState.npcs.find(
      (npc) => npc.npcId === selectedNpcId
    )?.npcState
    const npcGroupId: string | undefined =
      selectedNpcState?.location.moving !== undefined
        ? selectedNpcState?.location.moving?.spot.groupId
        : selectedNpcState?.location.staying?.groupId
    if (npcGroupId === undefined || npcGroupId === "") {
      playerQueue?.pushBack({
        kind: "json",
        value: {
          operation: {
            playerId: "lj",
            type: "groupStart",
            groupStart: { npcId: selectedNpcId },
          },
        },
      })
    } else {
      playerQueue?.pushBack({
        kind: "json",
        value: {
          operation: {
            playerId: "lj",
            type: "groupJoin",
            groupJoin: { groupId: npcGroupId },
          },
        },
      })
    }
  }

  const handleArrivalClick = (selectedNpcId: string) => {
    const selectedNpcState = selectedWorld?.worldState.npcs.find(
      (npc) => npc.npcId === selectedNpcId
    )?.npcState
    if (selectedNpcState?.location.moving !== undefined) {
      console.log("arrival requested from frontend")
      playerQueue?.pushBack({
        kind: "json",
        value: {
          gameOperation: {
            gameOperationNpcLocation: {
              npcId: selectedNpcId,
              spot: selectedNpcState?.location.moving.spot,
            },
          },
        },
      })
    }
  }

  const handleChatContentSubmit = (
    chatContent: string,
    groupId: string | undefined
  ) => {
    playerQueue?.pushBack({
      kind: "json",
      value: {
        operation: {
          playerId: "lj",
          type: "groupPost",
          groupPost: { groupId: groupId ?? "", content: chatContent },
        },
      },
    })
  }

  const handleLikeClick = (twisserId: string) => {
    playerQueue?.pushBack({
      kind: "json",
      value: {
        operation: {
          playerId: "lj",
          type: "likePost",
          likePost: { twisserId: twisserId ?? "", like: true },
        },
      },
    })
  }

  useEffect(() => {
    withGlobalService(async (scope, clientService) => {
      setWorlds(
        await clientService
          .getLightspeedClient()
          .get_listWorlds.fetch({}, checkAndGetAbortSignal(scope))
      )
    })
  }, [])

  useEffect(() => {
    withGlobalService(async (scope, clientService) => {
      if (selectedWorldId === undefined) {
        return
      }
      await clientService.connectPlayerControl(
        scope,
        { worldId: selectedWorldId },
        async (scope, playerControlServerIter, playerControlClientQueue) => {
          setPlayerQueue(playerControlClientQueue)
          for await (const playerControlServer of playerControlServerIter) {
            if (playerControlServer.kind !== "json") continue
            setPlayerControlMessages((playerControlMessages) => [
              ...playerControlMessages,
              playerControlServer.value,
            ])
            console.log("playerControlServer", playerControlServer)
            setWorlds(
              await clientService
                .getLightspeedClient()
                .get_listWorlds.fetch({}, checkAndGetAbortSignal(scope))
            )
          }
        }
      )
    })
  }, [selectedWorldId])

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        border: "1px solid black",
        background: "#000000",
      }}
    >
      <div style={{ margin: "10px" }} />
      <WorldPanel
        worldList={worlds ?? []}
        selectedWorldId={selectedWorldId}
        onSelectedWorldIdChange={handleSelectedWorldIdChange}
        onCreateDemoWorldClick={handleCreateDemoWorldClick}
        onWorldDelete={handleWorldDelete}
        onWorldCreate={handleWorldCreate}
        onCreateButton={handleCreateButton}
        onWorldChange={handleWorldChange}
        onStartWorld={handleStartWorld}
        onResetWorld={handleResetWorld}
        onStopWorld={handleStopWorld}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-evenly",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            border: "1px solid grey",
            flex: "2",
          }}
        >
          位置
          <div style={{ display: "flex", flex: "1" }}>
            <HouseListPanel
              style={{ flex: "1" }}
              selectedWorld={selectedWorld}
              deletedHouseId={deletedHouseId}
              onWorldChange={handleWorldChange}
            />
            <BuildingPanel
              style={{ flex: "1" }}
              selectedWorld={selectedWorld}
              deletedBuildingId={deletedBuildingId}
              onWorldChange={handleWorldChange}
            />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ border: "1px solid grey", flex: "1" }}>
            <h2>属性</h2>
            <NpcPropertiesPanel
              selectedWorld={selectedWorld}
              onWorldChange={handleWorldChange}
            />
          </div>
          <div style={{ border: "1px solid grey", flex: "1" }}>
            <h2>关系</h2>
            <NpcRelationshipPanel
              selectedWorld={selectedWorld}
              onWorldChange={handleWorldChange}
            />
          </div>
        </div>
        <div style={{ border: "1px solid grey", flex: "2" }}>
          Message显示区域
          <div
            style={{
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ flex: "1" }}>
              系统事件
              <MessagePanel
                worldList={worlds ?? []}
                selectedWorldId={selectedWorldId}
                playerControlMessages={playerControlMessages}
              />
            </div>
            <div style={{ flex: "1" }}>
              选定角色以及定位
              <NpcDetails
                worldList={worlds ?? []}
                selectedWorldId={selectedWorldId}
                worldState={selectedWorld?.worldState}
                onChatClick={handleChatClick}
                onArrivalClick={handleArrivalClick}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ flexGrow: "1" }}>
                聊天室
                <ChatRoom
                  worldSettings={selectedWorld?.worldSetting}
                  worldState={selectedWorld?.worldState}
                  onChatContentSubmit={handleChatContentSubmit}
                />
              </div>
              <div style={{ flexGrow: "1", marginLeft: "10px" }}>
                社交App - Twisser
                <Twisser worldSettings={selectedWorld?.worldSetting} worldState={selectedWorld?.worldState} onLikeClick={handleLikeClick}/>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
