"use client"
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder"
import FavoriteIcon from "@mui/icons-material/Favorite"
import { useState } from "react"

import {
  WorldSetting,
  WorldState,
  twisser,
} from "cm-community-common/lib/schema/lightspeed"

export function TwisserItem(props: {
  worldSettings: WorldSetting | undefined
  twisser: twisser
  onLikeClick: (twisserId: string) => void
}) {
  const [like, setLike] = useState(false)
  const time = `${props.twisser.time.year}.${props.twisser.time.month}.${props.twisser.time.date}  ${props.twisser.time.hour}:${props.twisser.time.minute}`
  let author
  if (props.twisser.author.npcId !== undefined) {
    author = props.worldSettings?.npcs.find(
      (npc) => npc._id === props.twisser.author.npcId
    )?.name
  } else {
    author = "罗辑"
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        marginLeft: "10px",
        marginRight: "10px",
      }}
    >
      <div>【{author}】</div>
      <div>{props.twisser.content}</div>
      <div>{time}</div>
      <div>
        <button
          style={{ alignSelf: "flex-start" }}
          onClick={() => {
            props.onLikeClick(props.twisser.twisserId)
            setLike(true)
          }}
        >
          {like ? <FavoriteIcon /> : <FavoriteBorderIcon />}
        </button>
        {props.twisser.likes.length > 0 && (
          <span>{props.twisser.likes.length}</span>
        )}
      </div>

      <button>回复</button>
      <hr style={{ width: "30%" }} />
      <div
        // ref={chatHistoryRef}
        style={{
          width: "minmax(200px, 450px)",
          height: "100px",
          overflowX: "scroll",
          overflowY: "scroll",
          marginLeft: "10px",
          marginRight: "10px",
        }}
      >
        <ul className="overflow-y-auto overflow-x-auto">
          {props.twisser.comments.map((comment, idx) => (
            <li key={idx}>{`【${
              props.worldSettings?.npcs.find(
                (npc) => npc._id === comment.author.npcId
              )?.name ?? "无名氏"
            }】回复：${comment.content}`}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
