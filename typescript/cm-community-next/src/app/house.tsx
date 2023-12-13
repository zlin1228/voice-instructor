"use client"

import { CSSProperties, useState, useEffect } from "react"

import { WithId } from "cm-community-common/lib/schema/common.js"
import {
  House,
  World,
  WorldSetting,
} from "cm-community-common/lib/schema/lightspeed"
import { stringRandomSimpleName } from "base-core/lib/string.js"

import { RoomListPanel } from "./room"

export function HouseListPanel(props: {
  style?: CSSProperties | undefined
  selectedWorld: WithId<World> | undefined
  onWorldChange: (modefiedWorldSetting: WithId<WorldSetting>) => void
  deletedHouseId: string | undefined
}) {
  const [newHouse, setNewHouse] = useState(false)
  const [selectedHouseId, setSelectedHouseId] = useState<string | undefined>()
  const [editable, setEditable] = useState(false)
  const [nameChange, setNameChange] = useState<string | undefined>()
  const [descChange, setDescChange] = useState<string | undefined>()

  const houseList = props.selectedWorld?.worldSetting.houses
  const selectedHouse = props.selectedWorld?.worldSetting.houses.filter(
    (house) => house._id === selectedHouseId
  )[0]

  const deleteHouseWorld = (): WithId<WorldSetting> => {
    if (props.selectedWorld === undefined) {
      throw new Error("no selected world")
    }
    setSelectedHouseId(undefined)
    setNameChange(undefined)
    setDescChange(undefined)
    return {
      _id: props.selectedWorld._id,
      ...props.selectedWorld.worldSetting,
      houses: props.selectedWorld?.worldSetting.houses.filter(
        (house) => house._id !== selectedHouse?._id
      ),
    }
  }

  const addHouseWorld = (): WithId<WorldSetting> => {
    if (props.selectedWorld === undefined) {
      throw new Error("no selected world under adding house case")
    }
    if (nameChange === undefined || descChange === undefined) {
      throw new Error("name or desc is undefined")
    }

    const _id = stringRandomSimpleName(8)
    const addedHouse: WithId<House> = {
      _id: _id,
      name: nameChange,
      description: descChange,
      rooms: [],
    }
    handleSubmitClick()
    setSelectedHouseId(undefined)
    setNameChange(undefined)
    setDescChange(undefined)
    return {
      _id: props.selectedWorld._id,
      ...props.selectedWorld.worldSetting,
      houses: [...props.selectedWorld.worldSetting.houses, addedHouse],
    }
  }

  const editHouseWorld = (): WithId<WorldSetting> => {
    if (props.selectedWorld === undefined) {
      throw new Error("no selected world under editting house case")
    }
    if (selectedHouseId === undefined) {
      throw new Error("no house selected")
    }
    if (selectedHouse === undefined) {
      throw new Error("no house selected")
    }
    if (nameChange === undefined && descChange === undefined) {
      throw new Error("name and desc is undefined")
    }
    const edittedHouse: WithId<House> = {
      _id: selectedHouseId,
      name: nameChange === undefined ? selectedHouse.name : nameChange,
      description:
        descChange === undefined ? selectedHouse.description : descChange,
      rooms: selectedHouse?.rooms,
    }
    handleSubmitClick()
    setNameChange(undefined)
    setDescChange(undefined)
    return {
      _id: props.selectedWorld._id,
      ...props.selectedWorld.worldSetting,
      houses: [
        ...props.selectedWorld.worldSetting.houses.map((house) =>
          house._id === selectedHouseId ? edittedHouse : house
        ),
      ],
    }
  }

  const handleSelectedHouseIdClick = (selectedHouseId: string | undefined) => {
    setSelectedHouseId(selectedHouseId)
  }

  const handleNewHouseClick = () => {
    if (props.selectedWorld !== undefined) {
      setNewHouse(true)
      setEditable(true)
    }
    setSelectedHouseId(undefined)
  }

  const handleUneditableClick = () => {
    setEditable(false)
    setNameChange(undefined)
    setDescChange(undefined)
  }
  const handleEditableClick = () => {
    setEditable(true)
  }
  const handleSubmitClick = () => {
    setEditable(false)
    if (newHouse) setNewHouse(false)
  }

  useEffect(() => {
    if (!newHouse) setSelectedHouseId(undefined)
  }, [props.selectedWorld?._id, newHouse])

  useEffect(() => {
    setEditable(false)
  }, [selectedHouseId])

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        padding: "10px",
        margin: "5px",
        border: "1px solid",
        background: "#5e5e5e",
        ...props.style,
      }}
    >
      <p>住宅</p>
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
          {houseList === undefined && <option disabled>无住宅</option>}
          {houseList !== undefined &&
            houseList.map((house) => {
              return (
                <option
                  key={house._id}
                  value={house._id}
                  onClick={() => handleSelectedHouseIdClick(house._id)}
                >
                  {house.name}
                </option>
              )
            })}
        </select>
      </div>
      <div style={{ display: "flex" }}>
        <button
          className={`text-white bg-scorpion-400 dark:bg-scorpion-500 hover:bg-mine-shaft-900 font-medium rounded-lg text-sm px-5 py-2.5 text-center`}
          style={{ margin: "5px" }}
          onClick={handleNewHouseClick}
        >
          新建
        </button>
        <button
          className={`text-white bg-scorpion-400 dark:bg-scorpion-500 hover:bg-mine-shaft-900 font-medium rounded-lg text-sm px-5 py-2.5 text-center`}
          style={{ margin: "5px" }}
          disabled={selectedHouse === undefined}
          onClick={() => props.onWorldChange(deleteHouseWorld())}
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
          <p>住宅名称</p>
          <input
            type="text"
            value={
              nameChange === undefined ? selectedHouse?.name ?? "" : nameChange
            }
            className={`${
              selectedHouseId === undefined && !newHouse
                ? "cursor-not-allowed"
                : editable
                ? ""
                : "cursor-not-allowed"
            }`}
            style={{ backgroundColor: "#1d1c1f" }}
            disabled={!editable}
            onChange={(e) => setNameChange(e.target.value)}
          ></input>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
            margin: "5px",
          }}
        >
          <p>住宅描述</p>
          <textarea
            value={
              descChange === undefined
                ? selectedHouse?.description ?? ""
                : descChange
            }
            className={`${
              selectedHouseId === undefined && !newHouse
                ? "cursor-not-allowed"
                : editable
                ? ""
                : "cursor-not-allowed"
            }`}
            style={{
              backgroundColor: "#1d1c1f",
              height: "150px",
            }}
            disabled={!editable}
            onChange={(e) => setDescChange(e.target.value)}
          ></textarea>
        </div>
        <div
          style={{ display: "flex", margin: "10px", justifyContent: "center" }}
        >
          <button
            className={`text-white bg-scorpion-400 dark:bg-scorpion-500 hover:bg-mine-shaft-900 ${
              selectedHouseId === undefined && !newHouse
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
              selectedHouseId === undefined && !newHouse
                ? "cursor-not-allowed"
                : !editable
                ? "cursor-not-allowed"
                : ""
            } font-medium rounded-lg text-sm px-5 py-2.5 text-center`}
            style={{ margin: "5px" }}
            onClick={() =>
              props.onWorldChange(newHouse ? addHouseWorld() : editHouseWorld())
            }
            disabled={selectedHouseId === undefined && !newHouse}
          >
            保存
          </button>
          <button
            className={`text-white bg-scorpion-400 dark:bg-scorpion-500 hover:bg-mine-shaft-900 ${
              selectedHouseId === undefined && !newHouse
                ? "cursor-not-allowed"
                : !editable
                ? "cursor-not-allowed"
                : ""
            } font-medium rounded-lg text-sm px-5 py-2.5 text-center`}
            style={{ margin: "5px" }}
            onClick={handleUneditableClick}
            disabled={selectedHouseId === undefined && !newHouse}
          >
            取消
          </button>
        </div>
      </div>

      <RoomListPanel
        selectedHouseId={selectedHouseId}
        selectedWorld={props.selectedWorld}
        onWorldChange={props.onWorldChange}
      />
    </div>
  )
}
