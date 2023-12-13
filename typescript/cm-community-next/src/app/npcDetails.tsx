"use client"

import { WithId } from "cm-community-common/lib/schema/common"
import {
  World,
  WorldSetting,
  WorldState,
  NpcLocation,
  NpcState,
  NpcPlanTask,
  findNpcStateFromWorldState,
  PlayerControlServer,
} from "cm-community-common/lib/schema/lightspeed"
import { useEffect, useRef, useState } from "react"

function planPlace(
  plan: NpcPlanTask | undefined,
  worldSettings: WorldSetting
): string {
  const houseList = worldSettings.houses
  const buildingList = worldSettings.buildings
  if (plan !== undefined) {
    if (plan.place.house !== undefined) {
      const house = houseList.find(
        (house) => house._id === plan.place.house?.houseId
      )
      const room = house?.rooms.find(
        (room) => room._id === plan.place.house?.roomId
      )
      return `住宅：${house?.name} 房间：${room?.name}`
    } else {
      const building = buildingList.find(
        (building) => building._id === plan.place.building?.buildingId
      )
      const facility = building?.facilities.find(
        (facility) => facility._id === plan.place.building?.facilityId
      )
      return `住宅：${building?.name} 房间：${facility?.name}`
    }
  }
  return "无地点"
}

function DisplayPlanMessage(props: {
  plans: readonly NpcPlanTask[] | undefined
  worldSettings: WorldSetting | undefined
}) {
  if (props.plans !== undefined) {
    return (
      <div
        style={{
          width: "minmax(200px, 450px)",
          height: "200px",
          overflowX: "scroll",
          overflowY: "scroll",
        }}
      >
        <ul className="overflow-y-auto overflow-x-auto">
          {props.plans.map((plan, idx) => (
            <li key={idx}>
              {`计划日期：${plan.time.year}.${plan.time.month}.${
                plan.time.date
              } ${plan.time.hour}:${plan.time.minute} 地点：${
                props.worldSettings !== undefined
                  ? planPlace(plan, props.worldSettings)
                  : "无地点"
              } 内容：${plan.what}`}
            </li>
          ))}
        </ul>
      </div>
    )
  }
  return "计划为空"
}

function findNpcEmotionandAction(worldState: WorldState, currNpcId: string) {
  return worldState.npcs.find((npc) => npc.npcId === currNpcId)?.npcState
}

export function NpcDetails(props: {
  worldList: readonly WithId<World>[]
  selectedWorldId: string | undefined
  worldState: WorldState | undefined
  onChatClick: (selectedNpcId: string) => void
  onArrivalClick: (selectedNpcId: string) => void
}) {
  const [selectedNpcId, setSelectedNpcId] = useState<string>("")
  const selectedWorld = props.worldList.filter(
    (world) => world._id === props.selectedWorldId
  )[0]

  console.log("selected world", selectedWorld)
  const npcList = selectedWorld?.worldSetting.npcs
  console.log("npc list", npcList)
  const currNpcState = props.worldState?.npcs.find(
    (npc) => npc.npcId === selectedNpcId
  )?.npcState
  const currNpcPlans: readonly NpcPlanTask[] | undefined =
    currNpcState?.planTasks

  const handleSelectedNpcStateClick = (npcId: string) => {
    setSelectedNpcId(npcId)
  }

  const selectedNpcState =
    props.worldState !== undefined
      ? findNpcStateFromWorldState(props.worldState, selectedNpcId)
      : undefined

  const moveOrStay = (npcLocation: NpcLocation): string => {
    if (npcLocation === undefined) {
      return "角色未诞生"
    }
    const selectedWorldSettings = props.worldList.filter(
      (world) => world._id === props.selectedWorldId
    )[0].worldSetting
    if (npcLocation.moving !== undefined) {
      if (npcLocation.moving.spot.place.building !== undefined) {
        const building = selectedWorldSettings.buildings.find(
          (building) =>
            building._id === npcLocation.moving?.spot.place.building?.buildingId
        )
        const facility = building?.facilities.find(
          (facility) =>
            facility._id === npcLocation.moving?.spot.place.building?.facilityId
        )
        return `移动中 目的地: 工作 -- ${building?.name} 建筑 -- ${facility?.name}`
      }
      const house = selectedWorldSettings.houses.find(
        (house) => house._id === npcLocation.moving?.spot.place.house?.houseId
      )
      const room = house?.rooms.find(
        (room) => room._id === npcLocation.moving?.spot.place.house?.roomId
      )
      return `移动中 目的地: 住宅 -- ${house?.name} 房间 -- ${room?.name}`
    }
    if (npcLocation.staying !== undefined) {
      if (npcLocation.staying.place.building !== undefined) {
        const building = selectedWorldSettings.buildings.find(
          (building) =>
            building._id === npcLocation.staying?.place.building?.buildingId
        )
        const facility = building?.facilities.find(
          (facility) =>
            facility._id === npcLocation.staying?.place.building?.facilityId
        )
        return `未移动 目的地: 工作 -- ${building?.name} 建筑 -- ${facility?.name}`
      }
      const house = selectedWorldSettings.houses.find(
        (house) => house._id === npcLocation.staying?.place.house?.houseId
      )
      const room = house?.rooms.find(
        (room) => room._id === npcLocation.staying?.place.house?.roomId
      )
      return `未移动 目的地: 住宅 -- ${house?.name} 房间 -- ${room?.name}`
    }
    return "未选择角色"
  }

  return (
    <div style={{ display: "flex" }}>
      <div style={{ display: "flex", flexDirection: "column", flex: "1" }}>
        <div style={{ height: "250px" }}>
          <label
            htmlFor="houses"
            className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
          />
          <select
            id="houses"
            size={10}
            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
            style={{ backgroundColor: "#1d1c1f" }}
          >
            {npcList === undefined && <option disabled>无角色</option>}
            {npcList !== undefined &&
              npcList.map((npc) => {
                return (
                  <option
                    key={npc._id}
                    value={npc._id}
                    onClick={() => handleSelectedNpcStateClick(npc._id)}
                  >
                    {npc.name}
                    {props.worldState !== undefined
                      ? `      表情：${
                          findNpcEmotionandAction(props.worldState, npc._id)
                            ?.emotion
                        }， 动作：${
                          findNpcEmotionandAction(props.worldState, npc._id)
                            ?.action
                        }`
                      : ""}
                  </option>
                )
              })}
          </select>
        </div>
        <div style={{ display: "flex", justifyContent: "space-evenly" }}>
          <button
            className={`text-white bg-scorpion-400 dark:bg-scorpion-500 ${
              props.selectedWorldId === undefined || selectedNpcId === ""
                ? "cursor-not-allowed"
                : ""
            } hover:bg-mine-shaft-900 font-medium rounded-lg text-sm px-5 py-2.5 text-center`}
            onClick={() => props.onChatClick(selectedNpcId)}
            disabled={
              props.selectedWorldId === undefined || selectedNpcId === ""
            }
          >
            发起对话
          </button>
          <button
            className={`text-white bg-scorpion-400 dark:bg-scorpion-500 ${
              props.selectedWorldId === undefined || selectedNpcId === ""
                ? "cursor-not-allowed"
                : ""
            } hover:bg-mine-shaft-900 font-medium rounded-lg text-sm px-5 py-2.5 text-center`}
            onClick={() => props.onArrivalClick(selectedNpcId)}
            disabled={
              props.selectedWorldId === undefined || selectedNpcId === ""
            }
          >
            立刻到达目的地
          </button>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: "1",
          marginLeft: "10px",
          marginRight: "5px",
        }}
      >
        <div style={{ height: "60px" }}>
          角色当前位置：
          {selectedNpcState === undefined
            ? "角色未诞生"
            : moveOrStay(selectedNpcState.location)}
        </div>

        <div>
          <DisplayPlanMessage
            plans={currNpcPlans}
            worldSettings={selectedWorld?.worldSetting}
          />
        </div>
      </div>
    </div>
  )
}
