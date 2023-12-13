"use client"
import { useEffect, useRef, useState } from "react"

import InputLabel from "@mui/material/InputLabel"
import MenuItem from "@mui/material/MenuItem"
import FormControl from "@mui/material/FormControl"
import Select from "@mui/material/Select"
import { ThemeProvider, createTheme } from "@mui/material/styles"

import { WithId } from "cm-community-common/lib/schema/common.js"
import {
  World,
  WorldSetting,
  worldSettingType,
  StartWorldRequest,
  StopWorldRequest,
  realTimeToWorldTime,
  ResetWorldRequest,
} from "cm-community-common/lib/schema/lightspeed.js"
import { stringRandomSimpleName } from "base-core/lib/string"
import { commonNormalizer } from "base-core/lib/types-common"

import { useCurrentTime } from "./useCurrentTime"

const theme = createTheme({
  palette: {
    primary: {
      main: "#fafafa",
      light: "#42a5f5",
      dark: "#1565c0",
      contrastText: "#fff",
    },
  },
})

function handleUploadWorldInfo(
  files: FileList,
  createWorldFunc: (NewWorldSetting: WorldSetting) => void
): void {
  const uploadedFile = files[0]

  const reader = new FileReader()
  reader.onload = (e) => {
    if (e.target !== null) {
      const temp = e.target.result as string
      const json = JSON.parse(temp)
      const worldSetting = commonNormalizer(worldSettingType, json)
      createWorldFunc(worldSetting)
    }
    // process JSON data
  }
  reader.readAsText(uploadedFile)
}

function downloadWorldInfo(selectedFile: File): void {
  // Create a link and set the URL using `createObjectURL`
  const link = document.createElement("a")
  link.style.display = "none"
  link.href = URL.createObjectURL(selectedFile)
  link.download = selectedFile.name

  // It needs to be added to the DOM so it can be clicked
  document.body.appendChild(link)
  link.click()

  // To make this work on Firefox we need to wait
  // a little while before removing it.
  setTimeout(() => {
    URL.revokeObjectURL(link.href)
    link.parentNode?.removeChild(link)
  }, 0)
}

export function WorldPanel(props: {
  onWorldChange: (modefiedWorldSetting: WithId<WorldSetting>) => void
  onWorldCreate: (NewWorldSetting: WorldSetting) => void
  worldList: readonly WithId<World>[]
  selectedWorldId: string | undefined
  onSelectedWorldIdChange: (worldId: string) => void
  onCreateDemoWorldClick: () => void
  onWorldDelete: (worldId: string) => void
  onStartWorld: (startWorldRequest: StartWorldRequest) => void
  onResetWorld: (resetWorldRequest: ResetWorldRequest) => void
  onStopWorld: (stopWorldRequest: StopWorldRequest) => void
  onCreateButton: () => void
}) {
  const [create, setCreate] = useState(false)
  const [nameChange, setNameChange] = useState<string | undefined>()
  const [descChange, setDescChange] = useState<string | undefined>()
  const uploadRef = useRef<HTMLInputElement>(null)
  const currTime = useCurrentTime(0.5)

  const selectedWorld: WithId<World> | undefined =
    props.selectedWorldId === undefined
      ? undefined
      : props.worldList.filter(
          (world) => world._id === props.selectedWorldId
        )[0]

  const handleStartWorldRequestClick = () => {
    if (props.selectedWorldId !== undefined)
      props.onStartWorld({
        worldId: props.selectedWorldId,
        timeRate: 20,
        activeDurationSeconds: 2 * 60 * 60,
      })
  }

  const handleWorldResetClick = () => {
    if (props.selectedWorldId !== undefined) {
      props.onResetWorld({
        worldId: props.selectedWorldId,
      })
    }
  }

  const handleStopWorldRequestClick = () => {
    if (props.selectedWorldId !== undefined)
      props.onStopWorld({
        worldId: props.selectedWorldId,
      })
  }

  const currWorldTime =
    selectedWorld === undefined ||
    selectedWorld?.worldState.activeState === null
      ? undefined
      : realTimeToWorldTime(selectedWorld.worldState, currTime)

  const realWorldStopTime =
    selectedWorld === undefined || selectedWorld.worldState.activeState === null
      ? undefined
      : selectedWorld.worldState.activeState.stopTime

  const handleNewWorldClick = () => {
    props.onCreateButton()
    setCreate(true)
  }

  const handleUploadButtonClick = () => {
    uploadRef.current?.click()
  }

  const addWorldSettings = (): WithId<WorldSetting> => {
    const _id = stringRandomSimpleName(8)
    return {
      _id: _id,
      name: nameChange ?? "世界名称不能为空",
      description: descChange ?? "世界观设定不能为空",
      houses: [],
      buildings: [],
      npcs: [],
      npcRelations: [],
      startTime: {
        year: 2033,
        month: 1,
        date: 1,
        hour: 12,
        minute: 30,
      },
      players: [{ _id: "lj", name: "罗辑" }],
    }
  }

  const editWorldSettings = (): WithId<WorldSetting> => {
    if (props.selectedWorldId === undefined || selectedWorld === undefined) {
      throw new Error("no selected world under editting room case")
    }

    handleSubmitClick()
    setNameChange(undefined)
    setDescChange(undefined)

    return {
      ...selectedWorld.worldSetting,
      _id: selectedWorld._id,
      name:
        nameChange === undefined ? selectedWorld.worldSetting.name : nameChange,
      description:
        descChange === undefined
          ? selectedWorld.worldSetting.description
          : descChange,
    }
  }

  const handleSubmitClick = () => {
    if (create) setCreate(false)
  }
  const handleCancelClick = () => {
    if (create) setCreate(false)
    setNameChange(undefined)
    setDescChange(undefined)
  }

  useEffect(() => {
    if (props.selectedWorldId === undefined) {
      setNameChange(undefined)
      setDescChange(undefined)
    }
  }, [props.selectedWorldId])

  return (
    <div style={{ display: "flex", justifyContent: "center", margin: "5px" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "center",
          margin: "5px",
        }}
      >
        <div
          id="buttons"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 115px)",
            gridTemplateRows: "repeat(5, 50px)",
            gridGap: "10px",
            margin: "5px",
          }}
        >
          <div style={{ gridArea: "1 / 1 / 2 / 3" }}>
            <ThemeProvider theme={theme}>
              <FormControl fullWidth style={{ background: "#fafafa" }}>
                <InputLabel id="demo-simple-select-label">选择世界</InputLabel>
                <Select
                  labelId="demo-simple-select-label"
                  id="demo-simple-select"
                  value={props.selectedWorldId ?? ""}
                  label="World"
                  onChange={(e) =>
                    props.onSelectedWorldIdChange(e.target.value)
                  }
                >
                  <MenuItem key="" value="" disabled>
                    <em>未选择</em>
                  </MenuItem>
                  {props.worldList !== undefined &&
                    props.worldList.map((world) => {
                      return (
                        <MenuItem key={world._id} value={world._id}>
                          {world.worldSetting.name}({world._id})
                        </MenuItem>
                      )
                    })}
                </Select>
              </FormControl>
            </ThemeProvider>
          </div>

          <button
            className={`text-white bg-scorpion-400 dark:bg-scorpion-500 hover:bg-mine-shaft-900 font-medium rounded-lg text-sm px-5 py-2.5 text-center`}
            style={{ margin: "5px", gridArea: "2 / 1 / 3 / 2" }}
            onClick={handleNewWorldClick}
          >
            新建
          </button>
          <button
            className={`text-white bg-scorpion-400 dark:bg-scorpion-500 hover:bg-mine-shaft-900 font-medium rounded-lg text-sm px-5 py-2.5 text-center`}
            style={{ margin: "5px", gridArea: "2 / 2 / 3 / 3" }}
            disabled={props.selectedWorldId === undefined}
            onClick={() => {
              if (props.selectedWorldId !== undefined)
                props.onWorldDelete(props.selectedWorldId)
            }}
          >
            删除
          </button>
          <button
            className={`text-white bg-scorpion-400 dark:bg-scorpion-500 ${
              props.selectedWorldId === undefined && !create
                ? "cursor-not-allowed"
                : ""
            } hover:bg-mine-shaft-900 font-medium rounded-lg text-sm px-5 py-2.5 text-center`}
            style={{ margin: "5px", gridArea: "3 / 1 / 4 / 2" }}
            disabled={props.selectedWorldId === undefined}
            onClick={handleStartWorldRequestClick}
          >
            运行
          </button>
          <button
            className={`text-white bg-scorpion-400 dark:bg-scorpion-500 ${
              props.selectedWorldId === undefined && !create
                ? "cursor-not-allowed"
                : ""
            } hover:bg-mine-shaft-900 font-medium rounded-lg text-sm px-5 py-2.5 text-center`}
            style={{ margin: "5px", gridArea: "3 / 2 / 4 / 3" }}
            disabled={props.selectedWorldId === undefined}
            onClick={handleStopWorldRequestClick}
          >
            暂停
          </button>
          <button
            className={`text-white bg-scorpion-400 dark:bg-scorpion-500 hover:bg-mine-shaft-900 font-medium rounded-lg text-sm px-5 py-2.5 text-center`}
            style={{ margin: "5px", gridArea: "4 / 1 / 5 / 2" }}
            onClick={handleUploadButtonClick}
          >
            导入世界
          </button>
          <input
            type="file"
            id="fileInput"
            style={{ display: "none" }}
            ref={uploadRef}
            onChange={(e) => {
              // Dynamically create a File
              if (e.target.files !== null)
                handleUploadWorldInfo(e.target.files, props.onWorldCreate)
            }}
          />
          <div className="group relative" style={{ gridArea: "4 / 2 / 5 / 3" }}>
            <button
              data-tooltip-target="tooltip-default"
              type="button"
              className={`text-white bg-scorpion-400 dark:bg-scorpion-500 hover:bg-mine-shaft-900 font-medium rounded-lg text-sm px-5 py-2.5 text-center`}
              style={{ margin: "5px" }}
              onClick={() =>
                downloadWorldInfo(
                  new File(
                    [JSON.stringify(selectedWorld?.worldSetting)],
                    `${selectedWorld?.worldSetting.name}.json`
                  )
                )
              }
              disabled={props.selectedWorldId === undefined}
            >
              导出世界
            </button>
            <span className="pointer-events-none absolute -top-7 left-0 w-max opacity-0 transition-opacity group-hover:opacity-100">
              点击下载世界设定信息到本地
            </span>
          </div>
          <button
            className={`text-white bg-scorpion-400 dark:bg-scorpion-500 hover:bg-mine-shaft-900 font-medium rounded-lg text-sm px-5 py-2.5 text-center`}
            style={{ margin: "5px", gridArea: "5 / 1 / 6 / 2" }}
            disabled={props.selectedWorldId === undefined}
            onClick={handleWorldResetClick}
          >
            重启
          </button>
          <button
            className={`text-white bg-scorpion-400 dark:bg-scorpion-500 hover:bg-mine-shaft-900 font-medium rounded-lg text-sm px-5 py-2.5 text-center`}
            style={{
              margin: "5px",
              gridArea: "5 / 2 / 6 / 3",
              fontSize: "small",
            }}
            onClick={props.onCreateDemoWorldClick}
          >
            {"创建“月岛”"}
          </button>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          margin: "5px",
        }}
      >
        <div style={{ alignSelf: "flex-start" }}>
          选定世界时间:{" "}
          {currWorldTime === undefined
            ? "未启动世界"
            : `${currWorldTime.year}年 ${currWorldTime.month}月 ${currWorldTime.date}日 ${currWorldTime.hour}时 ${currWorldTime.minute}分`}
        </div>
        <div style={{ alignSelf: "flex-start" }}>
          运行倒计时:{" "}
          {realWorldStopTime === undefined
            ? "未启动世界"
            : `${realWorldStopTime.getFullYear()}年 ${
                realWorldStopTime.getMonth() + 1
              }月 ${realWorldStopTime.getDate()}日 ${realWorldStopTime.getHours()}时 ${realWorldStopTime.getMinutes()}分`}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "100px 500px",
            gridTemplateRows: "30px 150px",
            gridGap: "10px",
            margin: "5px",
          }}
        >
          <p>世界名称</p>
          <input
            type="text"
            value={
              nameChange === undefined
                ? selectedWorld?.worldSetting.name ?? ""
                : nameChange
            }
            className={`${
              props.selectedWorldId === undefined && !create
                ? "cursor-not-allowed"
                : ""
            }`}
            style={{ backgroundColor: "#1d1c1f" }}
            onChange={(e) => setNameChange(e.target.value)}
          ></input>

          <p>世界观设定</p>
          <textarea
            value={
              descChange === undefined
                ? selectedWorld?.worldSetting.description ?? ""
                : descChange
            }
            className={`${
              props.selectedWorldId === undefined && !create
                ? "cursor-not-allowed"
                : ""
            }`}
            style={{ backgroundColor: "#1d1c1f" }}
            onChange={(e) => setDescChange(e.target.value)}
          ></textarea>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            margin: "5px",
          }}
        >
          <button
            className={`text-white bg-scorpion-400 dark:bg-scorpion-500 hover:bg-mine-shaft-900 ${
              props.selectedWorldId === undefined && !create
                ? "cursor-not-allowed"
                : ""
            } font-medium rounded-lg text-sm px-5 py-2.5 text-center`}
            style={{ margin: "5px" }}
            onClick={() =>
              create
                ? props.onWorldCreate(addWorldSettings())
                : props.onWorldChange(editWorldSettings())
            }
            disabled={props.selectedWorldId === undefined && !create}
          >
            保存
          </button>
          <button
            className={`text-white bg-scorpion-400 dark:bg-scorpion-500 hover:bg-mine-shaft-900 ${
              props.selectedWorldId === undefined && !create
                ? "cursor-not-allowed"
                : ""
            } font-medium rounded-lg text-sm px-5 py-2.5 text-center`}
            style={{ margin: "5px" }}
            onClick={handleCancelClick}
            disabled={props.selectedWorldId === undefined && !create}
          >
            取消
          </button>
        </div>
      </div>
    </div>
  )
}
