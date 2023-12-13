"use client"

import { useEffect, useState } from "react"

import { WithId } from "cm-community-common/lib/schema/common.js"
import {
  NpcRelation,
  World,
  WorldSetting,
} from "cm-community-common/lib/schema/lightspeed"
import { stringRandomSimpleName } from "base-core/lib/string"

const relationTypes = [
  "父子",
  "父女",
  "母子",
  "母女",
  "兄弟",
  "兄妹",
  "姐弟",
  "姐妹",
  "夫妻",
  "挚友",
  "好友",
]

export function NpcRelationshipPanel(props: {
  selectedWorld: WithId<World> | undefined
  onWorldChange: (modefiedWorldSetting: WithId<WorldSetting>) => void
}) {
  const [selectedRelationId, setSelectedRelationId] = useState<
    string | undefined
  >()
  const [create, setCreate] = useState(false)
  const [npc0IdChange, setNpc0IdChange] = useState<string | undefined>()
  const [npc1IdChange, setNpc1IdChange] = useState<string | undefined>()
  const [relationChange, setRelationChange] = useState<string | undefined>()

  const relationList = props.selectedWorld?.worldSetting.npcRelations
  const npcList = props.selectedWorld?.worldSetting.npcs

  const handleSelectedNpcClick = (selectedNpcId: string | undefined) => {
    setSelectedRelationId(selectedNpcId)
    setNpc0IdChange(undefined)
    setNpc1IdChange(undefined)
    setRelationChange(undefined)
  }

  const selectedRelation = relationList?.filter(
    (relation) => relation._id === selectedRelationId
  )[0]

  const handleSelectedNpcRelationClick = (
    selectedNpcId: string | undefined
  ) => {
    setSelectedRelationId(selectedNpcId)
  }

  const deleteRelationWorld = (): WithId<WorldSetting> => {
    if (props.selectedWorld === undefined) {
      throw new Error("no selected world")
    }
    setSelectedRelationId(undefined)
    setNpc0IdChange(undefined)
    setNpc1IdChange(undefined)
    setRelationChange(undefined)
    return {
      _id: props.selectedWorld._id,
      ...props.selectedWorld.worldSetting,
      npcRelations: props.selectedWorld?.worldSetting.npcRelations.filter(
        (npcRelation) => npcRelation._id !== selectedRelationId
      ),
    }
  }
  const addRelationWorld = (): WithId<WorldSetting> => {
    if (props.selectedWorld === undefined) {
      throw new Error("no selected world under adding building case")
    }
    if (
      npc0IdChange === undefined ||
      npc1IdChange === undefined ||
      relationChange === undefined
    ) {
      throw new Error("change is undefined")
    }

    const _id = stringRandomSimpleName(8)
    const addedNpcRelation: WithId<NpcRelation> = {
      _id: _id,
      npc1Id: npc0IdChange,
      npc2Id: npc1IdChange,
      relation: relationChange,
    }
    setSelectedRelationId(undefined)
    setNpc0IdChange(undefined)
    setNpc1IdChange(undefined)
    setRelationChange(undefined)
    setCreate(false)
    return {
      _id: props.selectedWorld._id,
      ...props.selectedWorld.worldSetting,
      npcRelations: [
        ...props.selectedWorld.worldSetting.npcRelations,
        addedNpcRelation,
      ],
    }
  }
  const editRelationWorld = (): WithId<WorldSetting> => {
    if (props.selectedWorld === undefined) {
      throw new Error("no selected world under editting building case")
    }
    if (selectedRelationId === undefined) {
      throw new Error("no building selected")
    }
    if (selectedRelation === undefined) {
      throw new Error("no building selected")
    }
    if (
      npc0IdChange === undefined &&
      npc1IdChange === undefined &&
      relationChange === undefined
    ) {
      throw new Error("change is undefined")
    }
    const edittedNpcRelation: WithId<NpcRelation> = {
      _id: selectedRelationId,
      npc1Id:
        npc0IdChange === undefined ? selectedRelation.npc1Id : npc0IdChange,
      npc2Id:
        npc1IdChange === undefined ? selectedRelation.npc2Id : npc1IdChange,
      relation:
        relationChange === undefined
          ? selectedRelation.relation
          : relationChange,
    }
    setNpc0IdChange(undefined)
    setNpc0IdChange(undefined)
    setRelationChange(undefined)
    return {
      _id: props.selectedWorld._id,
      ...props.selectedWorld.worldSetting,
      npcRelations: [
        ...props.selectedWorld.worldSetting.npcRelations.map((npcRelation) =>
          npcRelation._id === selectedRelationId
            ? edittedNpcRelation
            : npcRelation
        ),
      ],
    }
  }

  const handleNewRelationClick = () => {
    if (selectedRelationId !== undefined) setSelectedRelationId(undefined)
    setCreate(true)
  }

  const handleCancelClick = () => {
    if (create) setCreate(false)
    setNpc0IdChange(undefined)
    setNpc1IdChange(undefined)
    setRelationChange(undefined)
  }

  useEffect(() => {
    setNpc0IdChange(undefined)
    setNpc1IdChange(undefined)
    setRelationChange(undefined)
  }, [selectedRelationId])
  return (
    <div style={{ background: "#5e5e5e" }}>
      <div>
        <div style={{ height: "250px" }}>
          <label
            htmlFor="relation"
            className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
          />
          <select
            id="relation"
            size={10}
            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
            value={selectedRelationId ?? ""}
            style={{ background: "#1d1c1f" }}
            onChange={(e) => handleSelectedNpcRelationClick(e.target.value)}
          >
            {relationList === undefined && <option disabled>无关系</option>}
            {relationList !== undefined &&
              relationList.map((npcRelation) => {
                return (
                  <option key={npcRelation._id} value={npcRelation._id}>
                    {`${
                      npcList?.filter(
                        (npc) => npc._id === npcRelation.npc1Id
                      )[0].name
                    } -- ${npcRelation.relation} -- ${
                      npcList?.filter(
                        (npc) => npc._id === npcRelation.npc2Id
                      )[0].name
                    }`}
                  </option>
                )
              })}
          </select>
        </div>
        <div style={{ display: "flex" }}>
          <button
            className={`text-white bg-scorpion-400 dark:bg-scorpion-500 hover:bg-mine-shaft-900 font-medium rounded-lg text-sm px-5 py-2.5 text-center`}
            style={{ margin: "5px" }}
            onClick={handleNewRelationClick}
          >
            新增
          </button>
          <button
            className={`text-white bg-scorpion-400 dark:bg-scorpion-500 hover:bg-mine-shaft-900 font-medium rounded-lg text-sm px-5 py-2.5 text-center`}
            style={{ margin: "5px" }}
            disabled={selectedRelation === undefined}
            onClick={() => props.onWorldChange(deleteRelationWorld())}
          >
            删除
          </button>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div>
            <select
              id="npc0"
              className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
              value={
                npc0IdChange === undefined
                  ? selectedRelation?.npc1Id ?? ""
                  : npc0IdChange
              }
              style={{ background: "#1d1c1f" }}
              disabled={selectedRelationId === undefined && !create}
              onChange={(e) => setNpc0IdChange(e.target.value)}
            >
              <option value="" disabled>
                选择角色1
              </option>
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
          <div>
            <select
              id="years"
              className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
              value={
                relationChange === undefined
                  ? selectedRelation?.relation ?? ""
                  : relationChange
              }
              style={{ background: "#1d1c1f" }}
              disabled={selectedRelationId === undefined && !create}
              onChange={(e) => setRelationChange(e.target.value)}
            >
              <option value="" disabled>
                选择关系
              </option>
              {relationTypes.map((relationType, idx) => (
                <option key={idx}>{relationType}</option>
              ))}
            </select>
          </div>
          <div>
            <select
              id="years"
              className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
              value={
                npc1IdChange === undefined
                  ? selectedRelation?.npc2Id ?? ""
                  : npc1IdChange
              }
              style={{ background: "#1d1c1f" }}
              disabled={selectedRelationId === undefined && !create}
              onChange={(e) => setNpc1IdChange(e.target.value)}
            >
              <option value="" disabled>
                选择角色2
              </option>
              {npcList !== undefined &&
                npcList.map((npc) => {
                  return (
                    <option
                      key={npc._id}
                      value={npc._id}
                      onClick={() => handleSelectedNpcClick(npc._id)}
                    >
                      {npc.name}
                    </option>
                  )
                })}
            </select>
          </div>
        </div>
        <div
          style={{ display: "flex", justifyContent: "center", margin: "10px" }}
        >
          <button
            className={`text-white bg-scorpion-400 dark:bg-scorpion-500 hover:bg-mine-shaft-900 ${
              (selectedRelation === undefined && !create) ||
              (selectedRelation !== undefined &&
                ((selectedRelation?.npc1Id === undefined &&
                  npc0IdChange === undefined) ||
                  (selectedRelation?.npc2Id === undefined &&
                    npc1IdChange === undefined) ||
                  (selectedRelation.relation === undefined &&
                    relationChange === undefined))) ||
              (create &&
                (npc0IdChange === undefined ||
                  npc1IdChange === undefined ||
                  relationChange === undefined))
                ? "cursor-not-allowed"
                : ""
            } font-medium rounded-lg text-sm px-5 py-2.5 text-center`}
            style={{ margin: "5px" }}
            onClick={() =>
              props.onWorldChange(
                create ? addRelationWorld() : editRelationWorld()
              )
            }
            disabled={
              (selectedRelation === undefined && !create) ||
              (selectedRelation !== undefined &&
                ((selectedRelation?.npc1Id === undefined &&
                  npc0IdChange === undefined) ||
                  (selectedRelation?.npc2Id === undefined &&
                    npc1IdChange === undefined) ||
                  (selectedRelation.relation === undefined &&
                    relationChange === undefined))) ||
              (create &&
                (npc0IdChange === undefined ||
                  npc1IdChange === undefined ||
                  relationChange === undefined))
            }
          >
            保存
          </button>
          <button
            className={`text-white bg-scorpion-400 dark:bg-scorpion-500 hover:bg-mine-shaft-900 ${
              props.selectedWorld === undefined ? "cursor-not-allowed" : ""
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
