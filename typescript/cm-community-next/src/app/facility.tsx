"use client"

import { stringRandomSimpleName } from "base-core/lib/string"
import { WithId } from "cm-community-common/lib/schema/common"
import {
  Facility,
  Building,
  World,
  WorldSetting,
} from "cm-community-common/lib/schema/lightspeed"
import { useEffect, useState } from "react"

export function FacilityListPanel(props: {
  selectedWorld: WithId<World> | undefined
  selectedBuildingId: string | undefined
  onWorldChange: (modefiedWorldSetting: WithId<WorldSetting>) => void
}) {
  const [editable, setEditable] = useState(false)
  const [newFacility, setNewFacility] = useState(false)
  const [nameChange, setNameChange] = useState<string | undefined>()
  const [coordChange, setCoordChange] = useState<string | undefined>()
  const [descChange, setDescChange] = useState<string | undefined>()
  const [selectedFacilityId, setSelectedFacilityId] = useState<
    string | undefined
  >()

  const selectedBuilding = props.selectedWorld?.worldSetting.buildings.filter(
    (building) => building._id === props.selectedBuildingId
  )[0]
  const facilityList: readonly WithId<Facility>[] | undefined =
    selectedBuilding?.facilities
  const selectedFacility = facilityList?.filter(
    (facility) => facility._id === selectedFacilityId
  )[0]

  const deleteFacilityWorld = (): WithId<WorldSetting> => {
    if (props.selectedWorld === undefined) {
      throw new Error("no selected world")
    }
    if (selectedBuilding === undefined) {
      throw new Error("no selected Building")
    }
    setSelectedFacilityId(undefined)
    setNameChange(undefined)
    setCoordChange(undefined)
    setDescChange(undefined)
    const updatedFacilitys: WithId<Facility>[] =
      selectedBuilding.facilities.filter(
        (facility) => facility._id !== selectedFacilityId
      )
    const updatedBuilding: WithId<Building> = {
      ...selectedBuilding,
      facilities: updatedFacilitys,
    }
    return {
      _id: props.selectedWorld._id,
      ...props.selectedWorld.worldSetting,
      buildings: [
        ...props.selectedWorld.worldSetting.buildings.map((building) =>
          building._id === props.selectedBuildingId ? updatedBuilding : building
        ),
      ],
    }
  }

  const addFacilityWorld = (): WithId<WorldSetting> => {
    if (props.selectedWorld === undefined) {
      throw new Error("no selected world under adding building case")
    }
    if (selectedBuilding === undefined) {
      throw new Error("no selected Building on adding facility case")
    }
    if (facilityList === undefined) {
      throw new Error("no facilities")
    }
    if (nameChange === undefined || descChange === undefined) {
      throw new Error("name or desc is undefined")
    }

    const _id = stringRandomSimpleName(8)
    const addedFacility: WithId<Facility> = {
      _id: _id,
      name: nameChange,
      coordinate: coordChange,
      description: descChange,
    }
    const updatedFacilitys: WithId<Facility>[] = [
      ...facilityList,
      addedFacility,
    ]
    const updatedBuilding: WithId<Building> = {
      ...selectedBuilding,
      facilities: updatedFacilitys,
    }
    handleSubmitClick()
    setSelectedFacilityId(undefined)
    setNameChange(undefined)
    setCoordChange(undefined)
    setDescChange(undefined)
    return {
      _id: props.selectedWorld._id,
      ...props.selectedWorld.worldSetting,
      buildings: [
        ...props.selectedWorld.worldSetting.buildings.map((building) =>
          building._id === selectedBuilding._id ? updatedBuilding : building
        ),
      ],
    }
  }

  const editFacilityWorld = (): WithId<WorldSetting> => {
    if (props.selectedWorld === undefined) {
      throw new Error("no selected world under editting Facility case")
    }
    if (selectedFacilityId === undefined || selectedFacility === undefined) {
      throw new Error("no house selected")
    }
    if (selectedBuilding === undefined) {
      throw new Error("no building selected")
    }
    if (nameChange === undefined && descChange === undefined) {
      throw new Error("name and desc is undefined")
    }
    const edittedFacility: WithId<Facility> = {
      _id: selectedFacilityId,
      name: nameChange === undefined ? selectedFacility.name : nameChange,
      description:
        descChange === undefined ? selectedFacility.description : descChange,
    }
    const edittedBuilding: WithId<Building> = {
      _id: selectedBuilding._id,
      name: selectedBuilding.name,
      description: selectedBuilding.description,
      facilities: [
        ...selectedBuilding?.facilities.map((facility) =>
          facility._id === selectedFacilityId ? edittedFacility : facility
        ),
      ],
    }
    handleSubmitClick()
    setNameChange(undefined)
    setCoordChange(undefined)
    return {
      _id: props.selectedWorld._id,
      ...props.selectedWorld.worldSetting,
      buildings: [
        ...props.selectedWorld.worldSetting.buildings.map((building) =>
          building._id === selectedBuilding._id ? edittedBuilding : building
        ),
      ],
    }
  }

  const handleSelectedFacilityClick = (
    selectedFacilityId: string | undefined
  ) => {
    setSelectedFacilityId(selectedFacilityId)
  }

  const handleNewFacilityClick = () => {
    if (props.selectedBuildingId !== undefined) {
      setEditable(true)
    }
    setNewFacility(true)
    setSelectedFacilityId(undefined)
  }

  const handleUneditableClick = () => {
    setEditable(false)
  }
  const handleEditableClick = () => {
    setEditable(true)
    setNameChange(undefined)
    setCoordChange(undefined)
    setDescChange(undefined)
  }

  const handleSubmitClick = () => {
    setEditable(!editable)
    setNewFacility(false)
    setNameChange(undefined)
    setCoordChange(undefined)
    setDescChange(undefined)
  }

  useEffect(() => {
    if (!newFacility) setSelectedFacilityId(undefined)
  }, [props.selectedWorld?._id, props.selectedBuildingId, newFacility])

  useEffect(() => {
    setEditable(false)
  }, [selectedFacilityId])
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
      <p>设施</p>
      <div style={{ height: "250px" }}>
        <label
          htmlFor="facilitys"
          className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
        />
        <select
          id="facilitys"
          size={10}
          className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
          style={{ backgroundColor: "#1d1c1f" }}
        >
          {props.selectedBuildingId !== undefined &&
            facilityList?.length === 0 && <option disabled>无设施</option>}
          {facilityList !== undefined &&
            facilityList.map((facility) => {
              return (
                <option
                  key={facility._id}
                  value={facility._id}
                  onClick={() => handleSelectedFacilityClick(facility._id)}
                >
                  {facility.name}
                </option>
              )
            })}
        </select>
      </div>
      <div style={{ display: "flex" }}>
        <button
          className={`text-white bg-scorpion-400 dark:bg-scorpion-500 hover:bg-mine-shaft-900 font-medium rounded-lg text-sm px-5 py-2.5 text-center`}
          style={{ margin: "5px" }}
          onClick={handleNewFacilityClick}
        >
          新建
        </button>
        <button
          className={`text-white bg-scorpion-400 dark:bg-scorpion-500 hover:bg-mine-shaft-900 font-medium rounded-lg text-sm px-5 py-2.5 text-center`}
          style={{ margin: "5px" }}
          onClick={() => props.onWorldChange(deleteFacilityWorld())}
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
          <p>设施名称</p>
          <input
            type="text"
            value={
              nameChange === undefined
                ? selectedFacility?.name ?? ""
                : nameChange
            }
            className={`${
              selectedFacilityId === undefined && !newFacility
                ? "cursor-not-allowed"
                : editable
                ? ""
                : "cursor-not-allowed"
            }`}
            style={{ backgroundColor: "#1d1c1f" }}
            disabled={!editable}
            onChange={(e) => setNameChange(e.target.value)}
          ></input>
          <p>设施坐标</p>
          <input
            type="text"
            value={
              coordChange === undefined
                ? selectedFacility?.coordinate ?? ""
                : coordChange
            }
            className={`${
              selectedFacilityId === undefined && !newFacility
                ? "cursor-not-allowed"
                : editable
                ? ""
                : "cursor-not-allowed"
            }`}
            style={{ backgroundColor: "#1d1c1f" }}
            disabled={!editable}
            onChange={(e) => setCoordChange(e.target.value)}
          ></input>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "stretch",
            }}
          >
            <p>设施描述</p>
            <textarea
              value={
                descChange === undefined
                  ? selectedFacility?.description ?? ""
                  : descChange
              }
              className={`${
                selectedFacilityId === undefined && !newFacility
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
        </div>
        <div
          style={{ display: "flex", justifyContent: "center", margin: "10px" }}
        >
          <button
            className={`text-white bg-scorpion-400 dark:bg-scorpion-500 hover:bg-mine-shaft-900 ${
              selectedFacilityId === undefined && !newFacility
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
              selectedFacilityId === undefined && !newFacility
                ? "cursor-not-allowed"
                : !editable
                ? "cursor-not-allowed"
                : ""
            } font-medium rounded-lg text-sm px-5 py-2.5 text-center`}
            style={{ margin: "5px" }}
            onClick={() =>
              props.onWorldChange(
                newFacility ? addFacilityWorld() : editFacilityWorld()
              )
            }
            disabled={selectedFacilityId === undefined && !newFacility}
          >
            保存
          </button>
          <button
            className={`text-white bg-scorpion-400 dark:bg-scorpion-500 hover:bg-mine-shaft-900 ${
              selectedFacilityId === undefined && !newFacility
                ? "cursor-not-allowed"
                : !editable
                ? "cursor-not-allowed"
                : ""
            } font-medium rounded-lg text-sm px-5 py-2.5 text-center`}
            style={{ margin: "5px" }}
            onClick={handleUneditableClick}
            disabled={selectedFacilityId === undefined && !newFacility}
          >
            取消
          </button>
        </div>
      </div>
    </div>
  )
}
