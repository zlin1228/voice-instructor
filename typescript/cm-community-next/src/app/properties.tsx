"use client"

import { useState, useEffect } from "react"

import { WithId } from "cm-community-common/lib/schema/common.js"
import {
  Building,
  House,
  NpcSetting,
  World,
  Room,
  Facility,
  WorldSetting,
} from "cm-community-common/lib/schema/lightspeed"
import { stringRandomSimpleName } from "base-core/lib/string"
import { WorldSettingAccessor } from "./utils"

export function NpcPropertiesPanel(props: {
  selectedWorld: WithId<World> | undefined
  onWorldChange: (modefiedWorldSetting: WithId<WorldSetting>) => void
}) {
  const [selectedNpcId, setSelectedNpcId] = useState<string | undefined>()
  const [create, setCreate] = useState(false)

  const [nameChange, setNameChange] = useState<string | undefined>()
  const [ageChange, setAgeChange] = useState<number | undefined>()
  const [descChange, setDescChange] = useState<string | undefined>()
  const [occuChange, setOccuChange] = useState<string | undefined>()
  const [perChange, setPerChange] = useState<string | undefined>()
  const [specChange, setSpecChange] = useState<string | undefined>()
  const [hobbyChange, setHobbyChange] = useState<string | undefined>()
  const [sGoalChange, setSGoalChange] = useState<string | undefined>()
  const [lGoalChange, setLGoalChange] = useState<string | undefined>()
  const [actorPathChange, setActorPathChange] = useState<string | undefined>()
  const [voiceIdChange, setVoiceIdChange] = useState<string | undefined>()

  const [genderChange, setGenderChange] = useState<string | undefined>()
  const [houseIdChange, setHouseIdChange] = useState<string | undefined>()
  const [roomIdChange, setRoomIdChange] = useState<string | undefined>()
  const [buildingIdChange, setBuildingIdChange] = useState<string | undefined>()
  const [facilityIdChange, setFacilityIdChange] = useState<string | undefined>()

  const npcList = props.selectedWorld?.worldSetting.npcs
  const selectedNpc = npcList?.filter((npc) => npc._id === selectedNpcId)[0]

  const houseList: readonly WithId<House>[] | undefined =
    props.selectedWorld?.worldSetting.houses
  const buildingList: readonly WithId<Building>[] | undefined =
    props.selectedWorld?.worldSetting.buildings
  const roomList: readonly WithId<Room>[] | undefined = houseList?.filter(
    (house) =>
      house._id ===
      (houseIdChange === undefined
        ? selectedNpc?.residenceHouseId
        : houseIdChange)
  )[0]?.rooms
  const facilityList: readonly WithId<Facility>[] | undefined =
    buildingList?.filter(
      (building) =>
        building._id ===
        (buildingIdChange === undefined
          ? selectedNpc?.workBuildingId
          : buildingIdChange)
    )[0]?.facilities

  const setAllUndefined = () => {
    setGenderChange(undefined)
    setDescChange(undefined)
    setHouseIdChange(undefined)
    setRoomIdChange(undefined)
    setBuildingIdChange(undefined)
    setFacilityIdChange(undefined)
    setNameChange(undefined)
    setAgeChange(undefined)
    setOccuChange(undefined)
    setHobbyChange(undefined)
    setPerChange(undefined)
    setSpecChange(undefined)
    setSGoalChange(undefined)
    setLGoalChange(undefined)
    setActorPathChange(undefined)
    setVoiceIdChange(undefined)
  }

  const handleSelectedNpcClick = (selectedNpcId: string | undefined) => {
    setSelectedNpcId(selectedNpcId)
    if (create) setCreate(false)
  }

  console.log("create", create)

  const handleNewNpcClick = () => {
    setSelectedNpcId(undefined)
    setCreate(true)
    setDescChange("")
    setGenderChange("M")
    setHouseIdChange("")
    setRoomIdChange("")
    setBuildingIdChange("")
    setFacilityIdChange("")
    setNameChange("")
    setAgeChange(18)
    setOccuChange("")
    setHobbyChange("")
    setPerChange("")
    setSpecChange("")
    setSGoalChange("")
    setLGoalChange("")
    setActorPathChange("")
    setVoiceIdChange("")
  }

  const addedNpc: WithId<NpcSetting> = {
    _id: stringRandomSimpleName(8),
    name: nameChange ?? "",
    age: ageChange ?? 18,
    gender: genderChange ?? "M",
    description: descChange ?? "",
    hobby: hobbyChange ?? "",
    occupation: occuChange ?? "",
    specialty: specChange ?? "",
    personality: perChange ?? "",
    workBuildingId:
      buildingIdChange === undefined
        ? buildingList?.[0] === undefined
          ? ""
          : buildingList[0]._id
        : buildingIdChange,
    residenceHouseId:
      houseIdChange === undefined
        ? houseList?.[0] === undefined
          ? ""
          : houseList[0]._id
        : houseIdChange,
    workFacilityId:
      facilityIdChange === undefined
        ? facilityList?.[0] === undefined
          ? ""
          : facilityList[0]._id
        : facilityIdChange,
    residenceRoomId:
      roomIdChange === undefined
        ? roomList?.[0] === undefined
          ? ""
          : roomList[0]._id
        : roomIdChange,
    shortTermGoal: sGoalChange ?? "",
    longTermGoal: lGoalChange ?? "",
    actorPath: actorPathChange ?? "",
    voiceId: voiceIdChange ?? "",
  }

  const eligableSubmit = (currWorldSetting: WorldSetting) => {
    try {
      new WorldSettingAccessor(currWorldSetting)
      return true
    } catch (e) {
      console.log("eligible error", e)
      console.log(currWorldSetting)
      return false
    }
  }

  const deleteNpcWorld = (): WithId<WorldSetting> => {
    if (props.selectedWorld === undefined) {
      throw new Error("no selected world")
    }
    setAllUndefined()
    return {
      _id: props.selectedWorld._id,
      ...props.selectedWorld.worldSetting,
      npcs: props.selectedWorld?.worldSetting.npcs.filter(
        (npc) => npc._id !== selectedNpcId
      ),
    }
  }

  const addNpcWorld = (): WithId<WorldSetting> => {
    if (props.selectedWorld === undefined) {
      throw new Error("no selected world under adding building case")
    }
    if (
      genderChange === undefined ||
      descChange === undefined ||
      houseIdChange === undefined ||
      roomIdChange === undefined ||
      buildingIdChange === undefined ||
      facilityIdChange === undefined ||
      nameChange === undefined
    ) {
      throw new Error("change is undefined")
    }

    setSelectedNpcId(addedNpc._id)

    setAllUndefined()
    setCreate(false)
    return {
      _id: props.selectedWorld._id,
      ...props.selectedWorld.worldSetting,
      npcs: [...props.selectedWorld.worldSetting.npcs, addedNpc],
    }
  }

  console.log("Before edittedNpc", houseIdChange)
  const edittedNpc: WithId<NpcSetting> | undefined =
    selectedNpc === undefined
      ? undefined
      : {
          _id: selectedNpcId ?? "",
          name: nameChange === undefined ? selectedNpc.name : nameChange,
          age: ageChange === undefined ? selectedNpc.age : ageChange,
          gender:
            genderChange === undefined ? selectedNpc.gender : genderChange,
          description:
            descChange === undefined ? selectedNpc.description : descChange,
          hobby: hobbyChange === undefined ? selectedNpc.hobby : hobbyChange,
          occupation:
            occuChange === undefined ? selectedNpc.occupation : occuChange,
          specialty:
            specChange === undefined ? selectedNpc.specialty : specChange,
          personality:
            perChange === undefined ? selectedNpc.personality : perChange,
          workBuildingId:
            buildingIdChange === undefined
              ? selectedNpc.workBuildingId
              : buildingIdChange,
          residenceHouseId:
            houseIdChange === undefined
              ? selectedNpc.residenceHouseId
              : houseIdChange,
          workFacilityId:
            facilityIdChange === undefined
              ? selectedNpc.workFacilityId
              : facilityIdChange,
          residenceRoomId:
            roomIdChange === undefined
              ? selectedNpc.residenceRoomId
              : roomIdChange,
          shortTermGoal:
            sGoalChange === undefined ? selectedNpc.shortTermGoal : sGoalChange,
          longTermGoal:
            lGoalChange === undefined ? selectedNpc.longTermGoal : lGoalChange,
          actorPath:
            actorPathChange === undefined
              ? selectedNpc.actorPath
              : actorPathChange,
          voiceId:
            voiceIdChange === undefined ? selectedNpc.voiceId : voiceIdChange,
        }

  console.log("house", edittedNpc?.residenceHouseId)
  console.log("room", edittedNpc?.residenceRoomId)
  console.log("building", edittedNpc?.workBuildingId)
  console.log("facility", edittedNpc?.workFacilityId)

  const editNpcWorld = (): WithId<WorldSetting> => {
    if (props.selectedWorld === undefined) {
      throw new Error("no selected world under editting building case")
    }
    if (selectedNpcId === undefined) {
      throw new Error("no building selected")
    }
    if (selectedNpc === undefined) {
      throw new Error("no building selected")
    }
    if (
      genderChange === undefined &&
      descChange === undefined &&
      houseIdChange === undefined &&
      roomIdChange === undefined &&
      buildingIdChange === undefined &&
      facilityIdChange === undefined &&
      nameChange === undefined &&
      ageChange === undefined &&
      occuChange === undefined &&
      hobbyChange === undefined &&
      perChange === undefined &&
      specChange === undefined &&
      sGoalChange === undefined &&
      lGoalChange === undefined
    ) {
      throw new Error("change is undefined")
    }

    if (edittedNpc === undefined) {
      throw Error("edittedNpc is undefined")
    }

    setAllUndefined()
    return {
      _id: props.selectedWorld._id,
      ...props.selectedWorld.worldSetting,
      npcs: [
        ...props.selectedWorld.worldSetting.npcs.map((npc) =>
          npc._id === selectedNpcId ? edittedNpc : npc
        ),
      ],
    }
  }

  const handleCancelClick = () => {
    if (create) setCreate(false)
    setAllUndefined()
  }

  useEffect(() => {
    if (!create) {
      setAllUndefined()
    }
  }, [selectedNpcId, create])

  return (
    <div style={{ background: "#5e5e5e" }}>
      <div style={{ height: "250px" }}>
        <label
          htmlFor="npcs"
          className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
        />
        <select
          id="npcs"
          size={10}
          value={selectedNpcId}
          className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
          style={{ background: "#1d1c1f" }}
          onChange={(e) => handleSelectedNpcClick(e.target.value)}
        >
          {npcList === undefined && <option disabled>无角色</option>}
          {npcList !== undefined &&
            npcList.map((npc) => {
              return (
                <option key={npc._id} value={npc._id}>
                  {npc.name}
                </option>
              )
            })}
        </select>
      </div>
      <div style={{ display: "flex" }}>
        <button
          className={`text-white bg-scorpion-400 dark:bg-scorpion-500 hover:bg-mine-shaft-900 font-medium rounded-lg text-sm px-5 py-2.5 text-center`}
          style={{ margin: "5px" }}
          onClick={handleNewNpcClick}
        >
          新增
        </button>
        <button
          className={`text-white bg-scorpion-400 dark:bg-scorpion-500 hover:bg-mine-shaft-900 font-medium rounded-lg text-sm px-5 py-2.5 text-center`}
          style={{ margin: "5px" }}
          disabled={selectedNpcId === undefined}
          onClick={() => props.onWorldChange(deleteNpcWorld())}
        >
          删除
        </button>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(30px, 1fr) minmax(80px, 1fr)",
            gridTemplateRows: "repeat(11, 30px)",
            gridGap: "10px",
          }}
        >
          <p style={{ gridArea: "1 / 1 / 2 / 2" }}>姓名</p>
          <input
            type="text"
            value={
              nameChange === undefined ? selectedNpc?.name ?? "" : nameChange
            }
            style={{ backgroundColor: "#1d1c1f", gridArea: "1 / 2 / 2 / 5" }}
            onChange={(e) => setNameChange(e.target.value)}
          ></input>
          <p style={{ gridArea: "2 / 1 / 3 / 2" }}>性别</p>
          <select
            id="gender"
            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-md focus:ring-blue-500 focus:border-blue-500 block dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
            value={
              genderChange === undefined
                ? selectedNpc?.gender ?? ""
                : genderChange
            }
            style={{ background: "#1d1c1f", gridArea: "2 / 2 / 3 / 3" }}
            disabled={selectedNpc === undefined && !create}
            onChange={(e) => setGenderChange(e.target.value)}
          >
            <option value="" disabled>
              请选择
            </option>
            <option value="M">男</option>
            <option value="F">女</option>
          </select>
          <p style={{ gridArea: "2 / 3 / 3 / 4" }}>年龄</p>
          <input
            type="text"
            value={ageChange === undefined ? selectedNpc?.age ?? "" : ageChange}
            style={{ backgroundColor: "#1d1c1f", gridArea: "2 / 4 / 3 / 5" }}
            onChange={(e) => setAgeChange(Number(e.target.value))}
          ></input>
          <p style={{ gridArea: "3 / 1 / 4 / 2" }}>职业</p>
          <input
            type="text"
            value={
              occuChange === undefined
                ? selectedNpc?.occupation ?? ""
                : occuChange
            }
            style={{ backgroundColor: "#1d1c1f", gridArea: "3 / 2 / 4 / 5" }}
            onChange={(e) => setOccuChange(e.target.value)}
          ></input>
          <p style={{ gridArea: "4 / 1 / 5 / 2" }}>性格特质</p>
          <input
            type="text"
            value={
              perChange === undefined
                ? selectedNpc?.personality ?? ""
                : perChange
            }
            style={{ backgroundColor: "#1d1c1f", gridArea: "4 / 2 / 5 / 5" }}
            onChange={(e) => setPerChange(e.target.value)}
          ></input>
          <p style={{ gridArea: "5 / 1 / 6 / 2" }}>职业特质</p>
          <input
            type="text"
            value={
              specChange === undefined
                ? selectedNpc?.specialty ?? ""
                : specChange
            }
            style={{ backgroundColor: "#1d1c1f", gridArea: "5 / 2 / 6 / 5" }}
            onChange={(e) => setSpecChange(e.target.value)}
          ></input>
          <p style={{ gridArea: "6 / 1 / 7 / 2" }}>爱好</p>
          <input
            type="text"
            value={
              hobbyChange === undefined ? selectedNpc?.hobby ?? "" : hobbyChange
            }
            style={{ backgroundColor: "#1d1c1f", gridArea: "6 / 2 / 7 / 5" }}
            onChange={(e) => setHobbyChange(e.target.value)}
          ></input>

          <p style={{ gridArea: "7 / 1 / 9 / 2" }}>人物简介</p>
          <textarea
            value={
              descChange === undefined
                ? selectedNpc?.description ?? ""
                : descChange
            }
            style={{ backgroundColor: "#1d1c1f", gridArea: "7 / 2 / 9 / 5" }}
            onChange={(e) => setDescChange(e.target.value)}
          ></textarea>

          <p style={{ gridArea: "9 / 1 / 11 / 2" }}>短期目标</p>
          <textarea
            value={
              sGoalChange === undefined
                ? selectedNpc?.shortTermGoal ?? ""
                : sGoalChange
            }
            style={{ backgroundColor: "#1d1c1f", gridArea: "9 / 2 / 11 / 5" }}
            onChange={(e) => setSGoalChange(e.target.value)}
          ></textarea>
          <p style={{ gridArea: "11 / 1 / 13 / 2" }}>长期目标</p>
          <textarea
            value={
              lGoalChange === undefined
                ? selectedNpc?.longTermGoal ?? ""
                : lGoalChange
            }
            style={{ backgroundColor: "#1d1c1f", gridArea: "11 / 2 / 13 / 5" }}
            onChange={(e) => setLGoalChange(e.target.value)}
          ></textarea>
          <p style={{ gridArea: "13 / 1 / 14 / 2" }}>居住地</p>
          <div style={{ display: "flex", gridArea: "13 / 2 / 14 / 5" }}>
            <select
              id="houses"
              className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-md focus:ring-blue-500 focus:border-blue-500 block dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
              value={
                houseIdChange === undefined
                  ? selectedNpc?.residenceHouseId ?? ""
                  : houseIdChange
              }
              style={{ flexGrow: "1", background: "#1d1c1f" }}
              disabled={selectedNpc === undefined && !create}
              onChange={(e) => {
                console.log("house onChange", e.target.value)
                setHouseIdChange(e.target.value)
                setRoomIdChange(
                  props.selectedWorld?.worldSetting?.houses?.filter(
                    (house) => house._id === e.target.value
                  )[0]?.rooms[0]._id
                )
              }}
            >
              <option value="" disabled>
                请选择
              </option>
              {houseList !== undefined &&
                houseList.map((house) => (
                  <option key={house._id} value={house._id}>
                    {house.name}
                  </option>
                ))}
            </select>
            <select
              id="rooms"
              className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-md focus:ring-blue-500 focus:border-blue-500 block dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
              value={
                roomIdChange === undefined
                  ? selectedNpc?.residenceRoomId ?? ""
                  : roomIdChange
              }
              style={{ flexGrow: "1", background: "#1d1c1f" }}
              disabled={
                selectedNpc?.residenceHouseId === undefined &&
                houseIdChange === undefined &&
                !create
              }
              onChange={(e) => setRoomIdChange(e.target.value)}
            >
              <option value="" disabled>
                请选择
              </option>
              {roomList !== undefined &&
                roomList.map((room) => (
                  <option key={room._id} value={room._id}>
                    {room.name}
                  </option>
                ))}
            </select>
          </div>
          <p style={{ gridArea: "14 / 1 / 15 / 2" }}>工作地</p>
          <div
            style={{
              display: "flex",
              background: "#1d1c1f",
              gridArea: "14 / 2 / 15 / 5",
            }}
          >
            <select
              id="building"
              className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-md focus:ring-blue-500 focus:border-blue-500 block dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
              value={
                buildingIdChange === undefined
                  ? selectedNpc?.workBuildingId ?? ""
                  : buildingIdChange
              }
              style={{ flexGrow: "1", background: "#1d1c1f" }}
              disabled={selectedNpc === undefined && !create}
              onChange={(e) => {
                setBuildingIdChange(e.target.value)
                setFacilityIdChange(
                  props.selectedWorld?.worldSetting?.buildings?.filter(
                    (building) => building._id === e.target.value
                  )[0]?.facilities[0]._id
                )
              }}
            >
              <option value="" disabled>
                请选择
              </option>
              {buildingList !== undefined &&
                buildingList.map((building) => (
                  <option key={building._id} value={building._id}>
                    {building.name}
                  </option>
                ))}
            </select>
            <select
              id="facility"
              className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-md focus:ring-blue-500 focus:border-blue-500 block dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
              value={
                facilityIdChange === undefined
                  ? selectedNpc?.workFacilityId ?? ""
                  : facilityIdChange
              }
              style={{ flexGrow: "1", background: "#1d1c1f" }}
              disabled={
                selectedNpc?.workBuildingId === undefined &&
                buildingIdChange === undefined &&
                !create
              }
              onChange={(e) => setFacilityIdChange(e.target.value)}
            >
              <option value="" disabled>
                请选择
              </option>
              {facilityList !== undefined &&
                facilityList.map((facility) => (
                  <option key={facility._id} value={facility._id}>
                    {facility.name}
                  </option>
                ))}
            </select>
          </div>

          <p style={{ gridArea: "15 / 1 / 16 / 2" }}>模型路径</p>
          <input
            type="text"
            value={
              actorPathChange === undefined
                ? selectedNpc?.actorPath ?? ""
                : actorPathChange
            }
            style={{ backgroundColor: "#1d1c1f", gridArea: "15 / 2 / 16 / 5" }}
            onChange={(e) => setActorPathChange(e.target.value)}
          ></input>

          <p style={{ gridArea: "16 / 1 / 17 / 2" }}>语音路径</p>
          <input
            type="text"
            value={
              voiceIdChange === undefined
                ? selectedNpc?.voiceId ?? ""
                : voiceIdChange
            }
            style={{ backgroundColor: "#1d1c1f", gridArea: "16 / 2 / 17 / 5" }}
            onChange={(e) => setVoiceIdChange(e.target.value)}
          ></input>
        </div>
        <div style={{ display: "flex" }}>
          <button
            className={`text-white bg-scorpion-400 dark:bg-scorpion-500 hover:bg-mine-shaft-900 ${
              props.selectedWorld === undefined ||
              (selectedNpcId !== undefined &&
                !create &&
                (edittedNpc === undefined ||
                  !eligableSubmit({
                    ...props.selectedWorld.worldSetting,
                    npcs: [
                      ...props.selectedWorld.worldSetting.npcs.map((npc) =>
                        npc._id === selectedNpcId ? edittedNpc : npc
                      ),
                    ],
                  }))) ||
              (create &&
                !eligableSubmit({
                  ...props.selectedWorld.worldSetting,
                  npcs: [...props.selectedWorld.worldSetting.npcs, addedNpc],
                }))
                ? "cursor-not-allowed"
                : ""
            } font-medium rounded-lg text-sm px-5 py-2.5 text-center`}
            style={{ margin: "5px" }}
            onClick={() =>
              props.onWorldChange(create ? addNpcWorld() : editNpcWorld())
            }
            disabled={
              props.selectedWorld === undefined ||
              (selectedNpcId !== undefined &&
                !create &&
                (edittedNpc === undefined ||
                  !eligableSubmit({
                    ...props.selectedWorld.worldSetting,
                    npcs: [
                      ...props.selectedWorld.worldSetting.npcs.map((npc) =>
                        npc._id === selectedNpcId ? edittedNpc : npc
                      ),
                    ],
                  }))) ||
              (create &&
                !eligableSubmit({
                  ...props.selectedWorld.worldSetting,
                  npcs: [...props.selectedWorld.worldSetting.npcs, addedNpc],
                }))
            }
          >
            保存
          </button>
          <button
            className={`text-white bg-scorpion-400 dark:bg-scorpion-500 hover:bg-mine-shaft-900 ${
              selectedNpcId === undefined && !create ? "cursor-not-allowed" : ""
            } font-medium rounded-lg text-sm px-5 py-2.5 text-center`}
            style={{ margin: "5px" }}
            onClick={handleCancelClick}
            disabled={props.selectedWorld === undefined}
          >
            取消
          </button>
        </div>
      </div>
    </div>
  )
}
