"use client"

import {
  GroupMessage,
  NpcState,
  WorldSetting,
  WorldState,
} from "cm-community-common/lib/schema/lightspeed"
import { useEffect, useRef, useState } from "react"

function DisaplayChatMessage(props: {
  message: GroupMessage
  worldSettings: WorldSetting | undefined
}) {
  let speakerName
  if (props.message.author.npcId !== undefined) {
    const npcList = props.worldSettings?.npcs ?? []
    speakerName = npcList.find(
      (npc) => npc._id === props.message.author.npcId
    )?.name
  } else {
    const players = props.worldSettings?.players ?? []
    speakerName = players.find(
      (player) => player._id === props.message.author.playerId
    )?.name
  }
  const time = `${props.message.time.year}.${props.message.time.month}.${props.message.time.date}  ${props.message.time.hour}:${props.message.time.minute}`

  return time + " " + speakerName + ": " + props.message.content
}

function DisplayChatGroupList(props: {
  currGroupId: string | undefined
  worldSettings: WorldSetting | undefined
  worldState: WorldState | undefined
}) {
  let npcNames
  if (props.currGroupId !== undefined) {
    const npcIds = props.worldState?.npcs.filter(
      (npc) =>
        npc.npcState.location.moving?.spot.groupId === props.currGroupId ||
        npc.npcState.location.staying?.groupId === props.currGroupId
    )
    npcNames = npcIds?.map((npcId) =>
      props.worldSettings?.npcs.find((npc) => npc._id === npcId.npcId)
    )
  }
  if (npcNames === undefined || npcNames.length === 0) {
    return "尚未开始聊天/NPC已离开"
  }
  return (
    <div>
      聊天室的NPC：
      {npcNames?.map((npcName) => (
        <span key={npcName?._id} style={{ marginRight: "5px" }}>
          {npcName?.name}
        </span>
      ))}
    </div>
  )
}

export function ChatRoom(props: {
  worldSettings: WorldSetting | undefined
  worldState: WorldState | undefined
  onChatContentSubmit: (content: string, groupId: string | undefined) => void
}) {
  const [chatContent, setChatContent] = useState<string>("")
  const chatHistoryRef = useRef<HTMLDivElement>(null)
  const groupId = props.worldState?.players.find(
    (player) => player.playerId === "lj"
  )?.playerState.groupId
  const currGroup = props.worldState?.groups.find(
    (group) => group.groupId === groupId
  )?.group
  console.log("groupId:", groupId)

  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight
    }
  }, [currGroup?.messages])

  return (
    <div
      style={{ display: "flex", flexDirection: "column", marginLeft: "10px" }}
    >
      <DisplayChatGroupList
        currGroupId={groupId}
        worldSettings={props.worldSettings}
        worldState={props.worldState}
      />
      <div
        ref={chatHistoryRef}
        style={{
          width: "minmax(200px, 450px)",
          height: "250px",
          overflowX: "scroll",
          overflowY: "scroll",
        }}
      >
        <ul className="overflow-y-auto overflow-x-auto">
          {currGroup?.messages.map((message, idx) => (
            <li key={idx}>
              <DisaplayChatMessage
                message={message}
                worldSettings={props.worldSettings}
              />
            </li>
          ))}
        </ul>
      </div>
      <div style={{ display: "flex", marginTop: "5px" }}>
        <textarea
          className={`${groupId === undefined ? "cursor-not-allowed" : ""}`}
          placeholder="输入框"
          value={chatContent}
          style={{
            minWidth: "300px",
            minHeight: "100px",
            borderRadius: "5px",
            marginRight: "10px",
            color: "black",
          }}
          onChange={(e) => setChatContent(e.target.value)}
          disabled={groupId === undefined}
        />
        <button
          className={`text-white bg-scorpion-400 dark:bg-scorpion-500 ${
            groupId === undefined || chatContent === ""
              ? "cursor-not-allowed"
              : ""
          } hover:bg-mine-shaft-900 font-medium rounded-lg text-sm px-5 py-2.5 text-center`}
          style={{ height: "40px" }}
          onClick={() => {
            props.onChatContentSubmit(chatContent, groupId)
            setChatContent("")
          }}
          disabled={groupId === undefined || chatContent === ""}
        >
          发送
        </button>
      </div>
    </div>
  )
}
