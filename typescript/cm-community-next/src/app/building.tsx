"use client"

import { CSSProperties, useState, useEffect } from "react"

import { WithId } from "cm-community-common/lib/schema/common"
import {
  Building,
  World,
  WorldSetting,
} from "cm-community-common/lib/schema/lightspeed"
import { FacilityListPanel } from "./facility"
import { stringRandomSimpleName } from "base-core/lib/string"

export function BuildingPanel(props: {
  style?: CSSProperties | undefined
  selectedWorld: WithId<World> | undefined
  onWorldChange: (modefiedWorldSetting: WithId<WorldSetting>) => void
  deletedBuildingId: string | undefined
}) {
  const [newBuilding, setNewBuilding] = useState(false)
  const [selectedBuildingId, setSelectedBuildingId] = useState<
    string | undefined
  >()
  const [editable, setEditable] = useState(false)
  const [nameChange, setNameChange] = useState<string | undefined>()
  const [descChange, setDescChange] = useState<string | undefined>()

  const buildingList = props.selectedWorld?.worldSetting.buildings
  const selectedBuilding = props.selectedWorld?.worldSetting.buildings.filter(
    (building) => building._id === selectedBuildingId
  )[0]
  const deleteBuildingWorld = (): WithId<WorldSetting> => {
    if (props.selectedWorld === undefined) {
      throw new Error("no selected world")
    }
    setSelectedBuildingId(undefined)
    setNameChange(undefined)
    setDescChange(undefined)
    return {
      _id: props.selectedWorld._id,
      ...props.selectedWorld.worldSetting,
      buildings: props.selectedWorld?.worldSetting.buildings.filter(
        (building) => building._id !== selectedBuilding?._id
      ),
    }
  }

  const addBuildingWorld = (): WithId<WorldSetting> => {
    if (props.selectedWorld === undefined) {
      throw new Error("no selected world under adding building case")
    }
    if (nameChange === undefined || descChange === undefined) {
      throw new Error("name or desc is undefined")
    }

    const _id = stringRandomSimpleName(8)
    const addedBuilding: WithId<Building> = {
      _id: _id,
      name: nameChange,
      description: descChange,
      facilities: [],
    }
    handleSubmitClick()
    setSelectedBuildingId(undefined)
    setNameChange(undefined)
    setDescChange(undefined)
    return {
      _id: props.selectedWorld._id,
      ...props.selectedWorld.worldSetting,
      buildings: [...props.selectedWorld.worldSetting.buildings, addedBuilding],
    }
  }

  const editBuildingWorld = (): WithId<WorldSetting> => {
    if (props.selectedWorld === undefined) {
      throw new Error("no selected world under editting building case")
    }
    if (selectedBuildingId === undefined) {
      throw new Error("no building selected")
    }
    if (selectedBuilding === undefined) {
      throw new Error("no building selected")
    }
    if (nameChange === undefined && descChange === undefined) {
      throw new Error("name and desc is undefined")
    }
    const edittedBuilding: WithId<Building> = {
      _id: selectedBuildingId,
      name: nameChange === undefined ? selectedBuilding.name : nameChange,
      description:
        descChange === undefined ? selectedBuilding.description : descChange,
      facilities: selectedBuilding?.facilities,
    }
    handleSubmitClick()
    setNameChange(undefined)
    setDescChange(undefined)
    return {
      _id: props.selectedWorld._id,
      ...props.selectedWorld.worldSetting,
      buildings: [
        ...props.selectedWorld.worldSetting.buildings.map((building) =>
          building._id === selectedBuildingId ? edittedBuilding : building
        ),
      ],
    }
  }

  const handleSelectedBuildingClick = (
    selectedBuildingId: string | undefined
  ) => {
    setSelectedBuildingId(selectedBuildingId)
  }

  const handleNewBuildingClick = () => {
    if (props.selectedWorld !== undefined) {
      setNewBuilding(true)
      setEditable(true)
    }
    setSelectedBuildingId(undefined)
  }

  const handleUneditableClick = () => {
    setEditable(false)
  }
  const handleEditableClick = () => {
    setEditable(true)
  }
  const handleSubmitClick = () => {
    setEditable(false)
    if (newBuilding) setNewBuilding(false)
  }

  useEffect(() => {
    setSelectedBuildingId(undefined)
  }, [props.selectedWorld?._id])

  useEffect(() => {
    setEditable(false)
  }, [selectedBuildingId])

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
      <p>建筑</p>
      <div style={{ height: "250px" }}>
        <label
          htmlFor="buildings"
          className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
        />
        <select
          id="buildings"
          size={10}
          className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
          style={{ backgroundColor: "#1d1c1f" }}
        >
          {buildingList === undefined && <option disabled>无建筑</option>}
          {buildingList !== undefined &&
            buildingList.map((building) => {
              return (
                <option
                  key={building._id}
                  value={building._id}
                  onClick={() => handleSelectedBuildingClick(building._id)}
                >
                  {building.name}
                </option>
              )
            })}
        </select>
      </div>
      <div style={{ display: "flex" }}>
        <button
          className={`text-white bg-scorpion-400 dark:bg-scorpion-500 hover:bg-mine-shaft-900 font-medium rounded-lg text-sm px-5 py-2.5 text-center`}
          style={{ margin: "5px" }}
          onClick={handleNewBuildingClick}
        >
          新建
        </button>
        <button
          className={`text-white bg-scorpion-400 dark:bg-scorpion-500 hover:bg-mine-shaft-900 font-medium rounded-lg text-sm px-5 py-2.5 text-center`}
          style={{ margin: "5px" }}
          onClick={() => props.onWorldChange(deleteBuildingWorld())}
        >
          删除
        </button>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          margin: "5px",
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
          <p>建筑名称</p>
          <input
            type="text"
            value={
              nameChange === undefined
                ? selectedBuilding?.name ?? ""
                : nameChange
            }
            className={`${
              selectedBuildingId === undefined && !newBuilding
                ? "cursor-not-allowed"
                : editable
                ? ""
                : "cursor-not-allowed"
            }`}
            style={{ backgroundColor: "#1d1c1f" }}
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
          <p>建筑描述</p>
          <textarea
            value={
              descChange === undefined
                ? selectedBuilding?.description ?? ""
                : descChange
            }
            className={`${
              selectedBuildingId === undefined && !newBuilding
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
          style={{ display: "flex", justifyContent: "center", margin: "10px" }}
        >
          <button
            className={`text-white bg-scorpion-400 dark:bg-scorpion-500 hover:bg-mine-shaft-900 ${
              selectedBuildingId === undefined && !newBuilding
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
              selectedBuildingId === undefined && !newBuilding
                ? "cursor-not-allowed"
                : !editable
                ? "cursor-not-allowed"
                : ""
            } font-medium rounded-lg text-sm px-5 py-2.5 text-center`}
            style={{ margin: "5px" }}
            onClick={() =>
              props.onWorldChange(
                newBuilding ? addBuildingWorld() : editBuildingWorld()
              )
            }
            disabled={selectedBuildingId === undefined && !newBuilding}
          >
            保存
          </button>
          <button
            className={`text-white bg-scorpion-400 dark:bg-scorpion-500 hover:bg-mine-shaft-900 ${
              selectedBuildingId === undefined && !newBuilding
                ? "cursor-not-allowed"
                : !editable
                ? "cursor-not-allowed"
                : ""
            } font-medium rounded-lg text-sm px-5 py-2.5 text-center`}
            style={{ margin: "5px" }}
            onClick={handleUneditableClick}
            disabled={selectedBuildingId === undefined && !newBuilding}
          >
            取消
          </button>
        </div>
      </div>
      <FacilityListPanel
        selectedBuildingId={selectedBuildingId}
        selectedWorld={props.selectedWorld}
        onWorldChange={props.onWorldChange}
      />
    </div>
  )
}
