"use client"

import { withGlobalService } from "@/client-service"
import { checkAndGetAbortSignal } from "base-core/lib/scope"
import { FetchTaskResponse } from "cm-preset-bunny-builder-common/lib/service/schema"
import { useState } from "react"
import { Builder } from "./builder"

function FetchTaskPanel(props: {
  onTaskFetched: (
    workerId: string,
    taskId: string,
    task: FetchTaskResponse
  ) => void
}) {
  const [workerId, setWorkerId] = useState<string>()
  const [taskId, setTaskId] = useState<string>()
  const canGo = (taskId?.length ?? 0) > 0 && (workerId?.length ?? 0) > 0
  const handleGo = () => {
    if (taskId === undefined || workerId === undefined) {
      return
    }
    withGlobalService(async (scope, clientService) => {
      try {
        const task = await clientService
          .getPresetBunnyBuilderClient()
          .post_fetchTask.fetch(
            {
              taskId,
              workerId,
            },
            checkAndGetAbortSignal(scope)
          )
        props.onTaskFetched(workerId, taskId, task)
      } catch (e) {
        console.log(e)
        alert("This task is not valid. Please try another one.")
        return
      }
    })
  }
  return (
    <div>
      <div>
        Worker ID:{" "}
        <input
          value={workerId ?? ""}
          onChange={(e) => {
            setWorkerId(e.target.value)
          }}
        />
      </div>
      <div>
        Task ID:{" "}
        <input
          value={taskId ?? ""}
          onChange={(e) => {
            setTaskId(e.target.value)
          }}
        />
      </div>
      <button disabled={!canGo} onClick={() => handleGo()}>
        Go
      </button>
    </div>
  )
}

export function Portal(props: {}) {
  const [task, setTask] = useState<FetchTaskResponse>()
  const [workerId, setWorkerId] = useState<string>()
  const [taskId, setTaskId] = useState<string>()
  const [succeeded, setSucceeded] = useState<boolean>()
  const handleDone = (succeeded: boolean) => {
    const postBody = {
      type: "task_done",
      workerId,
      taskId,
      succeeded,
    }
    console.log(`Posting message to top window: ${JSON.stringify(postBody)}`)
    window.top?.postMessage(postBody, "*")
    setTask(undefined)
    setSucceeded(succeeded)
    setWorkerId(undefined)
    setTaskId(undefined)
  }
  if (succeeded !== undefined) {
    return (
      <div style={{ fontSize: "2em" }}>
        Your task has been submitted. Thank you! <br />
        The task status is{" "}
        {succeeded ? (
          <span style={{ backgroundColor: "green" }}>SUCCEEDED</span>
        ) : (
          <span style={{ backgroundColor: "red" }}>FAILED</span>
        )}
        . <br />
        Please refresh this page to start another task.
      </div>
    )
  }
  if (task === undefined) {
    return (
      <FetchTaskPanel
        onTaskFetched={(workerId, taskId, task) => {
          setWorkerId(workerId)
          setTaskId(taskId)
          setTask(task)
        }}
      />
    )
  }
  if (workerId === undefined || taskId === undefined) {
    return null
  }
  return (
    <Builder
      workerId={workerId}
      buildTaskId={taskId}
      task={task}
      onDone={handleDone}
    />
  )
}
