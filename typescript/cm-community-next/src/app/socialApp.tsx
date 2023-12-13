"use client"

import {
  NpcState,
  WorldSetting,
  WorldState,
} from "cm-community-common/lib/schema/lightspeed"
import { TwisserItem } from "./TwisserItem"
import { useEffect, useRef, useState } from "react"

export function Twisser(props: {
  worldSettings: WorldSetting | undefined
  worldState: WorldState | undefined
  onLikeClick: (twisserId: string) => void
}) {
  return (
    <div
      // ref={chatHistoryRef}
      style={{
        width: "minmax(200px, 450px)",
        height: "250px",
        overflowX: "scroll",
        overflowY: "scroll",
        marginLeft: "10px",
        marginTop: "10px",
      }}
    >
      {props.worldState?.twissers.length === 0 && <span>无发言</span>}
      {props.worldState?.twissers.length !== 0 && (
        <ul className="overflow-y-auto overflow-x-auto">
          {props.worldState?.twissers.map((twisser, idx) => (
            <li key={idx}><TwisserItem
              worldSettings={props.worldSettings}
              twisser={twisser}
              onLikeClick={props.onLikeClick}
            />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* <div style={{ display: "flex", marginTop: "5px" }}>
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
</div> */
