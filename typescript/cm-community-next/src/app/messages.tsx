"use client"

import { WithId } from "cm-community-common/lib/schema/common"
import {
  PlayerControlServer,
  NpcPlanTask,
  World,
  WorldSetting,
} from "cm-community-common/lib/schema/lightspeed"

export function DisplayNpcMessage(props: {
  selectedWorld: WithId<World> | undefined
  timeDisplay: string
  playerControlMessage: PlayerControlServer
}) {
  const NPCName =
    props.selectedWorld?.worldSetting.npcs.find(
      (npc) =>
        npc._id === props.playerControlMessage.worldEvent?.npcEvent?.npcId
    )?.name ?? ""
  if (props.playerControlMessage.worldEvent?.npcEvent !== undefined) {
    const currNpcEvent = props.playerControlMessage.worldEvent?.npcEvent
    if (currNpcEvent.born !== undefined) {
      if (currNpcEvent.born.spot.place.house !== undefined) {
        const house = props.selectedWorld?.worldSetting.houses.filter(
          (house) => house._id === currNpcEvent.born?.spot.place.house?.houseId
        )[0]
        const houseName = house?.name
        const roomName = house?.rooms.filter(
          (room) => room._id === currNpcEvent.born?.spot.place.house?.roomId
        )[0].name
        return (
          props.timeDisplay +
          "NPC: " +
          NPCName +
          " 出生" +
          "住宅：" +
          houseName +
          " " +
          "房间：" +
          roomName
        )
      }
      if (currNpcEvent.born.spot.place.building !== undefined) {
        const building = props.selectedWorld?.worldSetting.buildings.filter(
          (building) =>
            building._id === currNpcEvent.born?.spot.place.building?.buildingId
        )[0]
        const buildingName = building?.name
        const facilityName = building?.facilities.filter(
          (facility) =>
            facility._id === currNpcEvent.born?.spot.place.building?.facilityId
        )[0].name
        return (
          props.timeDisplay +
          "NPC: " +
          NPCName +
          " 出生" +
          "建筑：" +
          buildingName +
          " " +
          "设施：" +
          facilityName
        )
      }
    } else if (currNpcEvent.plan !== undefined) {
      return props.timeDisplay + " " + "NPC: " + NPCName + "的计划已更新"
    } else if (currNpcEvent.move !== undefined) {
      const source = currNpcEvent.move.fromSpot
      const destination = currNpcEvent.move.toSpot
      if (source.place.house !== undefined) {
        const sourceHouse = props.selectedWorld?.worldSetting.houses.filter(
          (house) => house._id === source.place.house?.houseId
        )[0]
        const sourceHouseName = sourceHouse?.name ?? ""
        const sourceRoomName = sourceHouse?.rooms.filter(
          (room) => room._id === source.place.house?.roomId
        )[0].name
        return (
          props.timeDisplay +
          "NPC: " +
          NPCName +
          " 移动中，出发地：" +
          "住宅：" +
          sourceHouseName +
          " " +
          "房间：" +
          sourceRoomName
        )
      } else if (source.place.building !== undefined) {
        const sourceBuilding =
          props.selectedWorld?.worldSetting.buildings.filter(
            (building) => building._id === source.place.building?.buildingId
          )[0]
        const sourceHouseName = sourceBuilding?.name ?? ""
        const sourceFacilityName = sourceBuilding?.facilities.filter(
          (facility) => facility._id === source.place.building?.facilityId
        )[0].name
        return (
          props.timeDisplay +
          "NPC: " +
          NPCName +
          " 移动中，出发地：" +
          "建筑：" +
          sourceHouseName +
          " " +
          "设施：" +
          sourceFacilityName
        )
      }
      if (destination.place.house !== undefined) {
        const destinationHouse =
          props.selectedWorld?.worldSetting.houses.filter(
            (house) => house._id === destination.place.house?.houseId
          )[0]
        const destinationHouseName = destinationHouse?.name ?? ""
        const destinationRoomName = destinationHouse?.rooms.filter(
          (room) => room._id === destination.place.house?.roomId
        )[0].name
        return (
          props.timeDisplay +
          "NPC: " +
          NPCName +
          " 移动中，出发地：" +
          "住宅：" +
          destinationHouseName +
          " " +
          "房间：" +
          destinationRoomName
        )
      } else if (destination.place.building !== undefined) {
        const destinationBuilding =
          props.selectedWorld?.worldSetting.buildings.filter(
            (building) =>
              building._id === destination.place.building?.buildingId
          )[0]
        const destinationHouseName = destinationBuilding?.name ?? ""
        const destinationFacilityName = destinationBuilding?.facilities.filter(
          (facility) => facility._id === destination.place.building?.facilityId
        )[0].name
        return (
          props.timeDisplay +
          "NPC: " +
          NPCName +
          " 移动中，出发地：" +
          "建筑：" +
          destinationHouseName +
          " " +
          "设施：" +
          destinationFacilityName
        )
      }
    }
  }
}

function DisplayWorldMessage(props: {
  selectedWorld: WithId<World> | undefined
  timeDisplay: string
  playerControlMessage: PlayerControlServer
}) {
  if (props.playerControlMessage.worldEvent?.worldEventStart !== undefined) {
    return "世界开始运行"
  }
  if (props.playerControlMessage.worldEvent?.worldEventStop !== undefined) {
    return "当前世界停止"
  }
}

function MessageItem(props: {
  selectedWorld: WithId<World> | undefined
  playerControlMessage: PlayerControlServer
}) {
  const currWorldTime = props.playerControlMessage.worldEvent?.worldTime
  const timeDisplay: string =
    currWorldTime === undefined
      ? ""
      : `${currWorldTime.year}年 ${currWorldTime.month}月 ${currWorldTime.date}日 ${currWorldTime.hour}时 ${currWorldTime.minute}分`
  if (props.playerControlMessage.worldEvent?.npcEvent !== undefined) {
    return (
      <DisplayNpcMessage
        selectedWorld={props.selectedWorld}
        timeDisplay={timeDisplay}
        playerControlMessage={props.playerControlMessage}
      />
    )
  } else
    return (
      <DisplayWorldMessage
        selectedWorld={props.selectedWorld}
        timeDisplay={timeDisplay}
        playerControlMessage={props.playerControlMessage}
      />
    )
}

export function MessagePanel(props: {
  worldList: readonly WithId<World>[]
  selectedWorldId: string | undefined
  playerControlMessages: PlayerControlServer[]
}) {
  const selectedWorld: WithId<World> | undefined =
    props.selectedWorldId === undefined
      ? undefined
      : props.worldList.filter(
          (world) => world._id === props.selectedWorldId
        )[0]

  return (
    <div
      style={{
        width: "minmax(200px, 450px)",
        height: "250px",
        overflowX: "scroll",
        overflowY: "scroll",
      }}
    >
      <ul className="overflow-y-auto overflow-x-auto">
        {props.playerControlMessages
          .map((message, idx) => (
            <li
              key={idx}
              className={idx % 2 === 0 ? "bg-scorpion-800" : "bg-scorpion-900"}
            >
              <MessageItem
                selectedWorld={selectedWorld}
                playerControlMessage={message}
              />
            </li>
          ))
          .slice()
          .reverse()}
      </ul>
    </div>
  )
}
