"use client"

import { stringRandomSimpleName } from "base-core/lib/string"
import { WithId } from "cm-community-common/lib/schema/common"
import {
  Room,
  House,
  World,
  WorldSetting,
} from "cm-community-common/lib/schema/lightspeed"
import { useEffect, useState } from "react"

export function RoomListPanel(props: {
  selectedWorld: WithId<World> | undefined
  selectedHouseId: string | undefined
  onWorldChange: (modefiedWorldSetting: WithId<WorldSetting>) => void
}) {
  const [editable, setEditable] = useState(false)
  const [newRoom, setNewRoom] = useState(false)
  const [nameChange, setNameChange] = useState<string | undefined>()
  const [coordChange, setCoordChange] = useState<string | undefined>()
  const [selectedRoomId, setSelectedRoomId] = useState<string | undefined>()

  const selectedHouse = props.selectedWorld?.worldSetting.houses.filter(
    (house) => house._id === props.selectedHouseId
  )[0]
  const roomList: readonly WithId<Room>[] | undefined = selectedHouse?.rooms
  const selectedRoom = roomList?.filter(
    (room) => room._id === selectedRoomId
  )[0]

  const deleteRoomWorld = (): WithId<WorldSetting> => {
    if (props.selectedWorld === undefined) {
      throw new Error("no selected world")
    }
    if (selectedHouse === undefined) {
      throw new Error("no selected House")
    }
    setSelectedRoomId(undefined)
    setNameChange(undefined)
    setCoordChange(undefined)
    const updatedRooms: WithId<Room>[] = selectedHouse.rooms.filter(
      (room) => room._id !== selectedRoomId
    )
    const updatedHouse: WithId<House> = {
      ...selectedHouse,
      rooms: updatedRooms,
    }
    return {
      _id: props.selectedWorld._id,
      ...props.selectedWorld.worldSetting,
      houses: [
        ...props.selectedWorld.worldSetting.houses.map((house) =>
          house._id === props.selectedHouseId ? updatedHouse : house
        ),
      ],
    }
  }

  const addRoomWorld = (): WithId<WorldSetting> => {
    if (props.selectedWorld === undefined) {
      throw new Error("no selected world under adding house case")
    }
    if (selectedHouse === undefined) {
      throw new Error("no selected House on adding room case")
    }
    if (roomList === undefined) {
      throw new Error("no rooms")
    }
    if (nameChange === undefined) {
      throw new Error("name or desc is undefined")
    }

    const _id = stringRandomSimpleName(8)
    const addedRoom: WithId<Room> = {
      _id: _id,
      name: nameChange,
      coordinate: coordChange,
    }
    const updatedRooms: WithId<Room>[] = [...roomList, addedRoom]
    const updatedHouse: WithId<House> = {
      ...selectedHouse,
      rooms: updatedRooms,
    }
    handleSubmitClick()
    setSelectedRoomId(undefined)
    setNameChange(undefined)
    setCoordChange(undefined)

    console.log("add room func used")

    return {
      _id: props.selectedWorld._id,
      ...props.selectedWorld.worldSetting,
      houses: [
        ...props.selectedWorld.worldSetting.houses.map((house) =>
          house._id === selectedHouse._id ? updatedHouse : house
        ),
      ],
    }
  }

  const editRoomWorld = (): WithId<WorldSetting> => {
    if (props.selectedWorld === undefined) {
      throw new Error("no selected world under editting room case")
    }
    if (selectedRoomId === undefined || selectedRoom === undefined) {
      throw new Error("no house selected")
    }
    if (selectedHouse === undefined) {
      throw new Error("no house selected")
    }
    if (nameChange === undefined) {
      throw new Error("name is undefined")
    }
    const edittedRoom: WithId<Room> = {
      _id: selectedRoomId,
      name: nameChange === undefined ? selectedRoom.name : nameChange,
    }
    const edittedHouse: WithId<House> = {
      _id: selectedHouse._id,
      name: selectedHouse.name,
      description: selectedHouse.description,
      rooms: [
        ...selectedHouse.rooms.map((room) =>
          room._id === selectedRoomId ? edittedRoom : room
        ),
      ],
    }
    handleSubmitClick()
    setNameChange(undefined)
    setCoordChange(undefined)

    return {
      _id: props.selectedWorld._id,
      ...props.selectedWorld.worldSetting,
      houses: [
        ...props.selectedWorld.worldSetting.houses.map((house) =>
          house._id === selectedHouse._id ? edittedHouse : house
        ),
      ],
    }
  }

  const handleSelectedRoomClick = (selectedRoomId: string | undefined) => {
    setSelectedRoomId(selectedRoomId)
  }

  const handleNewRoomClick = () => {
    if (props.selectedHouseId !== undefined) {
      setEditable(true)
    }
    setNewRoom(true)
    setSelectedRoomId(undefined)
  }

  const handleUneditableClick = () => {
    setEditable(false)
    setNewRoom(false)
  }
  const handleEditableClick = () => {
    setEditable(true)
    setNameChange(undefined)
  }

  const handleSubmitClick = () => {
    setEditable(!editable)
    setNewRoom(false)
  }

  useEffect(() => {
    if (!newRoom) setSelectedRoomId(undefined)
  }, [props.selectedWorld?._id, props.selectedHouseId, newRoom])

  useEffect(() => {
    setEditable(false)
  }, [selectedRoomId])
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        padding: "10px",
        margin: "5px",
        border: "1px solid",
      }}
    >
      <p>房间</p>
      <div style={{ height: "250px" }}>
        <label
          htmlFor="rooms"
          className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
        />
        <select
          id="rooms"
          size={10}
          className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
          style={{ backgroundColor: "#1d1c1f" }}
        >
          {props.selectedHouseId !== undefined && roomList?.length === 0 && (
            <option disabled>无房间</option>
          )}
          {roomList !== undefined &&
            roomList.map((room) => {
              return (
                <option
                  key={room._id}
                  value={room._id}
                  onClick={() => handleSelectedRoomClick(room._id)}
                >
                  {room.name}
                </option>
              )
            })}
        </select>
      </div>
      <div style={{ display: "flex" }}>
        <button
          className={`text-white bg-scorpion-400 dark:bg-scorpion-500 hover:bg-mine-shaft-900 font-medium rounded-lg text-sm px-5 py-2.5 text-center`}
          style={{ margin: "5px" }}
          onClick={handleNewRoomClick}
        >
          新建
        </button>
        <button
          className={`text-white bg-scorpion-400 dark:bg-scorpion-500 hover:bg-mine-shaft-900 font-medium rounded-lg text-sm px-5 py-2.5 text-center`}
          style={{ margin: "5px" }}
          onClick={() => props.onWorldChange(deleteRoomWorld())}
        >
          删除
        </button>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
            margin: "5px",
          }}
        >
          <p>房间名称</p>
          <input
            type="text"
            value={
              nameChange === undefined ? selectedRoom?.name ?? "" : nameChange
            }
            className={`${
              selectedRoomId === undefined && !newRoom
                ? "cursor-not-allowed"
                : editable
                ? ""
                : "cursor-not-allowed"
            }`}
            style={{ backgroundColor: "#1d1c1f" }}
            disabled={!editable}
            onChange={(e) => setNameChange(e.target.value)}
          ></input>
          <p>房间坐标</p>
          <input
            type="text"
            value={
              coordChange === undefined
                ? selectedRoom?.coordinate ?? ""
                : coordChange
            }
            className={`${
              selectedRoomId === undefined && !newRoom
                ? "cursor-not-allowed"
                : editable
                ? ""
                : "cursor-not-allowed"
            }`}
            style={{ backgroundColor: "#1d1c1f" }}
            disabled={!editable}
            onChange={(e) => setCoordChange(e.target.value)}
          ></input>
        </div>
        <div
          style={{ display: "flex", justifyContent: "center", margin: "10px" }}
        >
          <button
            className={`text-white bg-scorpion-400 dark:bg-scorpion-500 hover:bg-mine-shaft-900 ${
              selectedRoomId === undefined && !newRoom
                ? "cursor-not-allowed"
                : editable
                ? "cursor-not-allowed"
                : ""
            } font-medium rounded-lg text-sm px-5 py-2.5 text-center`}
            style={{ margin: "5px" }}
            onClick={handleEditableClick}
            disabled={editable}
          >
            修改
          </button>
          <button
            className={`text-white bg-scorpion-400 dark:bg-scorpion-500 hover:bg-mine-shaft-900 ${
              selectedRoomId === undefined && !newRoom
                ? "cursor-not-allowed"
                : !editable
                ? "cursor-not-allowed"
                : ""
            } font-medium rounded-lg text-sm px-5 py-2.5 text-center`}
            style={{ margin: "5px" }}
            onClick={() =>
              props.onWorldChange(newRoom ? addRoomWorld() : editRoomWorld())
            }
            disabled={selectedRoomId === undefined && !newRoom}
          >
            保存
          </button>
          <button
            className={`text-white bg-scorpion-400 dark:bg-scorpion-500 hover:bg-mine-shaft-900 ${
              selectedRoomId === undefined && !newRoom
                ? "cursor-not-allowed"
                : !editable
                ? "cursor-not-allowed"
                : ""
            } font-medium rounded-lg text-sm px-5 py-2.5 text-center`}
            style={{ margin: "5px" }}
            onClick={handleUneditableClick}
            disabled={selectedRoomId === undefined && !newRoom}
          >
            取消
          </button>
        </div>
      </div>
    </div>
  )
}
