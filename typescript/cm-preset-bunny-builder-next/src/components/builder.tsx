"use client"

import {
  Tree,
  TreeNodeLocation,
  treeNodeLocationType,
} from "cm-bunny-host-common/lib/tree/tree.js"
import { arrayConcat } from "base-core/lib/array"
import { ReactNode, use, useEffect, useMemo, useRef, useState } from "react"
import { TreeOperation } from "cm-bunny-host-common/lib/tree/tree-operation"
import { WebExecutor } from "cm-bunny-host-web-common/lib/action/web-action"
import { PageExecutor } from "cm-bunny-host-web-common/lib/action/page-action"
import { withGlobalService } from "../client-service"
import { TreePathFinder } from "cm-bunny-host-common/lib/tree/tree-path.js"
import { Browser, BunnyHostWebClient } from "./browser"
import { FetchTaskResponse } from "cm-preset-bunny-builder-common/lib/service/schema"
import { PresetBunnyBuildStateSample } from "cm-preset-bunny-builder-common/lib/service/task"
import {
  AppAccount,
  PresetBunnyDefinition,
} from "cm-bunny-host-common/lib/bunny/bunny"
import {
  Scope,
  checkAndGetAbortSignal,
  sleepSeconds,
} from "base-core/lib/scope"
import {
  OperationLocation,
  PresetRecord,
  PresetStep,
} from "cm-bunny-host-web-common/lib/preset/preset"

interface NodeSelectorState {
  type?: "static" | "listOne" | "listAll"
  targetLocation?: TreeNodeLocation
  firstSubjectLocation?: TreeNodeLocation
  secondSubjectLocation?: TreeNodeLocation
  selecting?: "target" | "firstSubject" | "secondSubject"
  argumentName?: string
}

interface PendingStep {
  explain?: string
  operation?:
    | "click"
    | "fill"
    | "report"
    | "richComponent"
    | "hover"
    | "scroll"
    | "press"
    | "configuration"
    | "slider"
  nodeSelectorState?: NodeSelectorState
  tree?: Tree
  fillStaticText?: string
  fillArgumentName?: string
  fillPressEnter?: boolean
  reportName?: string
  richComponentType?: string
  pressKey?: string
  sliderRatioValue?: number
}

function getStepName(step: PresetStep): string {
  if (step.click !== undefined) {
    return "CLICK"
  }
  if (step.fill !== undefined) {
    return "TYPE"
  }
  if (step.report !== undefined) {
    return "REPORT"
  }
  if (step.hover !== undefined) {
    return "HOVER"
  }
  if (step.richComponent !== undefined) {
    return "RICH COMPONENT"
  }
  if (step.scroll !== undefined) {
    return "SCROLL"
  }
  if (step.press !== undefined) {
    return "PRESS"
  }
  if (step.configuration !== undefined) {
    return "CONFIGURATION"
  }
  if (step.slider !== undefined) {
    return "SLIDER"
  }
  return "(unknown)"
}

function StepDisplay(props: {
  index: number
  step: PresetStep
  replaying: boolean
  failed: boolean
}) {
  const { index, step } = props
  return (
    <div
      style={{
        backgroundColor: props.failed
          ? "red"
          : props.replaying
          ? "yellow"
          : "white",
      }}
    >
      {index + 1}. {getStepName(step)} {step.explain}
    </div>
  )
}

function StepListPanel(props: {
  steps: readonly PresetStep[]
  replayingStep: PresetStep | undefined
  failedStep: PresetStep | undefined
}) {
  return (
    <div>
      {props.steps.map((step, index) => {
        return (
          <div key={index}>
            <StepDisplay
              index={index}
              step={step}
              replaying={props.replayingStep === step}
              failed={props.failedStep === step}
            />
            <hr />
          </div>
        )
      })}
    </div>
  )
}

function NodeSelector(props: {
  sample: PresetBunnyBuildStateSample
  state: NodeSelectorState
  onChange: (state: NodeSelectorState) => void
}) {
  const { state } = props
  return (
    <div>
      <div>Target element:</div>
      <select
        value={state.type ?? "(none)"}
        onChange={(event) => {
          if (event.target.value === "(none)") {
            props.onChange({
              ...state,
              type:
                event.target.value === "(none)"
                  ? undefined
                  : event.target.value,
            })
          } else if (event.target.value === "static") {
            props.onChange({
              ...state,
              type: "static",
            })
          } else if (event.target.value === "listOne") {
            props.onChange({
              ...state,
              type: "listOne",
            })
          } else if (event.target.value === "listAll") {
            props.onChange({
              ...state,
              type: "listAll",
            })
          }
        }}
      >
        <option value="none">(not selected)</option>
        <option value="static">A fixed element in the page</option>
        <option value="listOne">
          An element in a list depending on a parameter
        </option>
        <option value="listAll">
          Repeat the operation for each element in a list
        </option>
      </select>
      {state.type === "static" && (
        <div>
          Target element:{" "}
          <button
            disabled={state.selecting !== undefined}
            onClick={() => {
              props.onChange({
                ...state,
                selecting: "target",
              })
            }}
          >
            {state.selecting === "target"
              ? "Selecting - please click the element"
              : state.targetLocation === undefined
              ? "Select"
              : "Re-select"}
          </button>
        </div>
      )}
      {state.type === "listOne" && (
        <>
          <div>
            The name of the first item in the list:{" "}
            <button
              disabled={state.selecting !== undefined}
              onClick={() => {
                props.onChange({
                  ...state,
                  selecting: "firstSubject",
                })
              }}
            >
              {state.selecting === "firstSubject"
                ? "Selecting - please click the element"
                : state.firstSubjectLocation === undefined
                ? "Select"
                : "Re-select"}
            </button>
          </div>
          <div>
            The name of the second item in the list:{" "}
            <button
              disabled={state.selecting !== undefined}
              onClick={() => {
                props.onChange({
                  ...state,
                  selecting: "secondSubject",
                })
              }}
            >
              {state.selecting === "secondSubject"
                ? "Selecting - please click the element"
                : state.secondSubjectLocation === undefined
                ? "Select"
                : "Re-select"}
            </button>
          </div>
          <div>
            Where to perform the operation:{" "}
            <button
              disabled={state.selecting !== undefined}
              onClick={() => {
                props.onChange({
                  ...state,
                  selecting: "target",
                })
              }}
            >
              {state.selecting === "target"
                ? "Please click the element"
                : state.targetLocation === undefined
                ? "Select"
                : "Re-select"}
            </button>
          </div>
          <div>
            Which argument to match:{" "}
            <select
              value={
                state.argumentName === undefined ? "(none)" : state.argumentName
              }
              onChange={(event) => {
                const value = event.target.value
                if (value === "(none)") {
                  props.onChange({
                    ...state,
                    argumentName: undefined,
                  })
                } else {
                  props.onChange({
                    ...state,
                    argumentName: value,
                  })
                }
              }}
            >
              <option value="(none)">--Please choose--</option>
              {props.sample.argumentList.map(({ name, value }, idx) => {
                return (
                  <option key={name} value={name}>
                    [{name}] {value}
                  </option>
                )
              })}
            </select>
          </div>
        </>
      )}
      {state.type === "listAll" && (
        <>
          <div>
            The name of the first item in the list:{" "}
            <button
              disabled={state.selecting !== undefined}
              onClick={() => {
                props.onChange({
                  ...state,
                  selecting: "firstSubject",
                })
              }}
            >
              {state.selecting === "firstSubject"
                ? "Selecting - please click the element"
                : state.firstSubjectLocation === undefined
                ? "Select"
                : "Re-select"}
            </button>
          </div>
          <div>
            The name of the second item in the list:{" "}
            <button
              disabled={state.selecting !== undefined}
              onClick={() => {
                props.onChange({
                  ...state,
                  selecting: "secondSubject",
                })
              }}
            >
              {state.selecting === "secondSubject"
                ? "Selecting - please click the element"
                : state.secondSubjectLocation === undefined
                ? "Select"
                : "Re-select"}
            </button>
          </div>
          <div>
            Where to perform the operation:{" "}
            <button
              disabled={state.selecting !== undefined}
              onClick={() => {
                props.onChange({
                  ...state,
                  selecting: "target",
                })
              }}
            >
              {state.selecting === "target"
                ? "Please click the element"
                : state.targetLocation === undefined
                ? "Select"
                : "Re-select"}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function StepEditor(props: {
  bunnyDefinition: PresetBunnyDefinition
  sample: PresetBunnyBuildStateSample
  step: PendingStep
  onStepChange: (step: PendingStep) => void
}) {
  const renderTargetSelector = () => {
    return (
      <NodeSelector
        sample={props.sample}
        state={props.step.nodeSelectorState ?? {}}
        onChange={(nodeSelectorState) => {
          props.onStepChange({
            ...props.step,
            nodeSelectorState,
          })
        }}
      />
    )
  }
  return (
    <div>
      <div>
        Explain your next step:
        <br />
        <textarea
          style={{ border: "1px solid grey" }}
          cols={40}
          rows={4}
          value={props.step.explain ?? ""}
          onChange={(event) => {
            const explain = event.target.value
            props.onStepChange({ ...props.step, explain })
          }}
        />
      </div>
      <div>
        Operation:{" "}
        <select
          value={props.step.operation ?? "none"}
          onChange={(event) => {
            if (event.target.value === "none") {
              props.onStepChange({
                ...props.step,
                operation: undefined,
              })
            } else if (event.target.value === "click") {
              props.onStepChange({
                ...props.step,
                operation: "click",
              })
            } else if (event.target.value === "fill") {
              props.onStepChange({
                ...props.step,
                operation: "fill",
              })
            } else if (event.target.value === "report") {
              props.onStepChange({
                ...props.step,
                operation: "report",
              })
            } else if (event.target.value === "richComponent") {
              props.onStepChange({
                ...props.step,
                operation: "richComponent",
              })
            } else if (event.target.value === "hover") {
              props.onStepChange({
                ...props.step,
                operation: "hover",
              })
            } else if (event.target.value === "scroll") {
              props.onStepChange({
                ...props.step,
                operation: "scroll",
              })
            } else if (event.target.value === "press") {
              props.onStepChange({
                ...props.step,
                operation: "press",
              })
            } else if (event.target.value === "configuration") {
              props.onStepChange({
                ...props.step,
                operation: "configuration",
              })
            } else if (event.target.value === "slider") {
              props.onStepChange({
                ...props.step,
                operation: "slider",
              })
            }
          }}
        >
          <option value="none">(not selected)</option>
          <option value="click">CLICK by mouse</option>
          <option value="fill">TYPE by keyboard</option>
          <option value="report">REPORT</option>
          <option value="richComponent">
            Rich Component (e.g. date selector) - NOTE: This only mark a rich
            component, but does not perform any action.
          </option>
          <option value="hover">HOVER by mouse</option>
          <option value="scroll">
            SCROLL by mouse - NOTE: This only mark a element to scroll, but does
            not perform any action.
          </option>
          <option value="press">PRESS a single key by keyboard</option>
          <option value="configuration">
            CONFIGURATION: customize an item - NOTE: This only mark a element as
            a configuration panel, but does not perform any action.
          </option>
          <option value="slider">SLIDER: change the value of a slider</option>
        </select>
      </div>
      {props.step.operation === "click" && <div>{renderTargetSelector()}</div>}
      {props.step.operation === "fill" && (
        <div>
          {renderTargetSelector()}
          <div>
            Input text:{" "}
            <select
              value={
                props.step.fillArgumentName ??
                (props.step.fillStaticText !== undefined ? "(static)" : "(none")
              }
              onChange={(event) => {
                const value = event.target.value
                if (value === "(none)") {
                  props.onStepChange({
                    ...props.step,
                    fillArgumentName: undefined,
                    fillStaticText: undefined,
                  })
                } else if (value === "(static)") {
                  props.onStepChange({
                    ...props.step,
                    fillArgumentName: undefined,
                    fillStaticText: "",
                  })
                } else {
                  props.onStepChange({
                    ...props.step,
                    fillArgumentName: value,
                    fillStaticText: undefined,
                  })
                }
              }}
            >
              <option value="(none)">--Please choose--</option>
              {props.sample.argumentList.map(({ name, value }, idx) => {
                return (
                  <option key={name} value={name}>
                    [{name}] {value}
                  </option>
                )
              })}
              <option value="(static)">!! Fixed text (unusual) !!</option>
            </select>
          </div>
          {props.step.fillStaticText !== undefined && (
            <div>
              <input
                type="text"
                onChange={(event) => {
                  const fillText = event.target.value
                  props.onStepChange({
                    ...props.step,
                    fillStaticText: fillText,
                  })
                }}
                value={props.step.fillStaticText ?? ""}
              />
            </div>
          )}
          <div>
            <input
              type="checkbox"
              checked={props.step.fillPressEnter ?? false}
              onChange={(event) => {
                props.onStepChange({
                  ...props.step,
                  fillPressEnter: event.target.checked,
                })
              }}
            />
            Press ENTER after typing the text
          </div>
        </div>
      )}
      {props.step.operation === "report" && (
        <div>
          {renderTargetSelector()}
          Report as:{" "}
          <select
            value={props.step.reportName ?? "(none)"}
            onChange={(event) => {
              const value = event.target.value
              props.onStepChange({
                ...props.step,
                reportName: value === "(none)" ? undefined : value,
              })
            }}
          >
            <option value="(none)">--please choose-- </option>
            {props.bunnyDefinition.reportNames.map((name, idx) => {
              return (
                <option key={idx} value={name}>
                  {name}
                </option>
              )
            })}
          </select>
        </div>
      )}
      {props.step.operation === "richComponent" && (
        <div>
          {renderTargetSelector()}
          Component type:{" "}
          <select
            value={props.step.richComponentType ?? "(none)"}
            onChange={(event) => {
              const value = event.target.value
              props.onStepChange({
                ...props.step,
                richComponentType: value === "(none)" ? undefined : value,
              })
            }}
          >
            <option value="(none)">--please choose-- </option>
            <option value="datePicker">Date Picker</option>
          </select>
        </div>
      )}
      {props.step.operation === "hover" && <div>{renderTargetSelector()}</div>}
      {props.step.operation === "scroll" && <div>{renderTargetSelector()}</div>}
      {props.step.operation === "press" && (
        <div>
          {renderTargetSelector()}
          Key to press:{" "}
          <select
            value={props.step.pressKey ?? "(none)"}
            onChange={(event) => {
              const value = event.target.value
              props.onStepChange({
                ...props.step,
                pressKey: value === "(none)" ? undefined : value,
              })
            }}
          >
            <option value="(none)">--please choose-- </option>
            <option value="Enter">Enter</option>
            <option value="Space">Space</option>
            <option value="Backspace">Backspace</option>
            <option value="Escape">Escape</option>
            <option value="ArrowLeft">Left Arrow</option>
            <option value="ArrowRight">Right Arrow</option>
            <option value="ArrowUp">Up Arrow</option>
            <option value="ArrowDown">Down Arrow</option>
          </select>
        </div>
      )}
      {props.step.operation === "configuration" && (
        <div>{renderTargetSelector()}</div>
      )}
      {props.step.operation === "slider" && (
        <div>
          Please specify the rail of the slider. It should represent the full
          length of the slider.
          {renderTargetSelector()}
          Value (0 as minimum and 100 as maximum):{" "}
          <input
            type="range"
            value={Math.round((props.step.sliderRatioValue ?? 0.5) * 100)}
            min={0}
            max={100}
            step={1}
            onChange={(event) => {
              const value = Number(event.target.value)
              props.onStepChange({
                ...props.step,
                sliderRatioValue: Math.min(100, Math.max(0, value / 100)),
              })
            }}
          />
          {props.step.sliderRatioValue === undefined
            ? "Please specify a value between 0-100"
            : String(Math.round(props.step.sliderRatioValue * 100))}
        </div>
      )}
    </div>
  )
}

type ConcludeType = "complete" | "abort" | "error" | "invalid" | "captcha"

function ConcludePanel(props: {
  cannotCompleteReason: string | undefined
  onConclude: (concludeType: ConcludeType, reason: string) => void
}) {
  const [concludeType, setConcludeType] = useState<ConcludeType>()
  const [concludeReason, setConcludeReason] = useState<string>("")
  const reasonRequired =
    concludeType !== undefined &&
    concludeType !== "complete" &&
    concludeType !== "abort"
  return (
    <div
      style={{
        border: "1px solid black",
      }}
    >
      <h3
        style={{
          backgroundColor:
            props.cannotCompleteReason === undefined ? "green" : undefined,
        }}
      >
        Conclude
      </h3>
      <div>
        Select why you want to conclude the task: <br />
        <select
          value={concludeType ?? "none"}
          onChange={(event) => {
            const type = event.target.value
            if (type === "none") {
              setConcludeType(undefined)
            } else {
              setConcludeType(type as ConcludeType)
            }
          }}
        >
          <option value="none">(not selected)</option>
          <option
            value="complete"
            disabled={props.cannotCompleteReason !== undefined}
          >
            {props.cannotCompleteReason !== undefined
              ? `Cannot complete - ${props.cannotCompleteReason}`
              : "Complete"}
          </option>
          <option value="abort">Abort - redo the task later</option>
          <option value="error">
            Error - the recorded steps were not performed as expected
          </option>
          <option value="invalid">
            Invalid - the task is not valid for the website
          </option>
          <option value="captcha">
            CAPTCHA - the website requires CAPTCHA
          </option>
        </select>
      </div>
      <div
        style={{
          display: reasonRequired ? "unset" : "none",
        }}
      >
        Detailed reason (required):
        <input
          value={concludeReason}
          onChange={(event) => {
            setConcludeReason(event.target.value)
          }}
        />
      </div>
      <div>
        <button
          disabled={
            concludeType === undefined ||
            (reasonRequired && concludeReason === "")
          }
          onClick={
            concludeType === undefined
              ? undefined
              : () => props.onConclude(concludeType, concludeReason)
          }
        >
          Submit
        </button>
      </div>
    </div>
  )
}

function buildOperationLocation(
  nodeSelectorState: NodeSelectorState
): OperationLocation | undefined {
  if (nodeSelectorState.type === "static") {
    if (nodeSelectorState.targetLocation === undefined) return undefined
    return {
      staticLocation: nodeSelectorState.targetLocation,
    }
  } else if (nodeSelectorState.type === "listOne") {
    if (nodeSelectorState.firstSubjectLocation === undefined) return undefined
    if (nodeSelectorState.secondSubjectLocation === undefined) return undefined
    if (nodeSelectorState.targetLocation === undefined) return undefined
    if (nodeSelectorState.argumentName === undefined) return undefined
    return {
      listOneLocation: {
        listLocation: {
          firstSubjectLocation: nodeSelectorState.firstSubjectLocation,
          secondSubjectLocation: nodeSelectorState.secondSubjectLocation,
        },
        targetLocation: nodeSelectorState.targetLocation,
        argumentName: nodeSelectorState.argumentName,
      },
    }
  } else if (nodeSelectorState.type === "listAll") {
    if (nodeSelectorState.firstSubjectLocation === undefined) return undefined
    if (nodeSelectorState.secondSubjectLocation === undefined) return undefined
    if (nodeSelectorState.targetLocation === undefined) return undefined
    return {
      listAllLocation: {
        listLocation: {
          firstSubjectLocation: nodeSelectorState.firstSubjectLocation,
          secondSubjectLocation: nodeSelectorState.secondSubjectLocation,
        },
        targetLocation: nodeSelectorState.targetLocation,
      },
    }
  }
  return undefined
}

function buildStep(step: PendingStep): PresetStep | undefined {
  const { nodeSelectorState, tree, explain, operation } = step
  if (nodeSelectorState === undefined) return undefined
  if (tree === undefined) return undefined
  if (explain === undefined || explain === "") return undefined
  if (operation === undefined) return undefined
  if (operation === "click") {
    const operationLocation = buildOperationLocation(nodeSelectorState)
    if (operationLocation === undefined) return undefined
    return {
      explain,
      tree,
      click: {
        operationLocation,
      },
    }
  }
  if (operation === "fill") {
    const { fillStaticText, fillArgumentName } = step
    if (fillStaticText === undefined && fillArgumentName === undefined)
      return undefined
    const operationLocation = buildOperationLocation(nodeSelectorState)
    if (operationLocation === undefined) return undefined
    return {
      explain,
      tree,
      fill: {
        operationLocation,
        staticText: fillStaticText,
        argumentName: fillArgumentName,
        pressEnter: step.fillPressEnter ?? false,
      },
    }
  }
  if (operation === "report") {
    const name = step.reportName
    if (name === undefined) return undefined
    const operationLocation = buildOperationLocation(nodeSelectorState)
    if (operationLocation === undefined) return undefined
    return {
      explain,
      tree,
      report: {
        operationLocation,
        name,
      },
    }
  }
  if (operation === "richComponent") {
    const type = step.richComponentType
    if (type === undefined) return undefined
    const operationLocation = buildOperationLocation(nodeSelectorState)
    if (operationLocation === undefined) return undefined
    return {
      explain,
      tree,
      richComponent: {
        operationLocation,
        type,
      },
    }
  }
  if (operation === "hover") {
    const operationLocation = buildOperationLocation(nodeSelectorState)
    if (operationLocation === undefined) return undefined
    return {
      explain,
      tree,
      hover: {
        operationLocation,
      },
    }
  }
  if (operation === "scroll") {
    const operationLocation = buildOperationLocation(nodeSelectorState)
    if (operationLocation === undefined) return undefined
    return {
      explain,
      tree,
      scroll: {
        operationLocation,
      },
    }
  }
  if (operation === "press") {
    const operationLocation = buildOperationLocation(nodeSelectorState)
    if (operationLocation === undefined) return undefined
    if (step.pressKey === undefined) {
      return undefined
    }
    return {
      explain,
      tree,
      press: {
        operationLocation,
        keyName: step.pressKey,
      },
    }
  }
  if (operation === "configuration") {
    const operationLocation = buildOperationLocation(nodeSelectorState)
    if (operationLocation === undefined) return undefined
    return {
      explain,
      tree,
      configuration: {
        operationLocation,
      },
    }
  }
  if (operation === "slider") {
    const operationLocation = buildOperationLocation(nodeSelectorState)
    if (operationLocation === undefined) return undefined
    const positionRatioValue = step.sliderRatioValue
    if (positionRatioValue === undefined) return undefined
    return {
      explain,
      tree,
      slider: {
        operationLocation,
        positionRatioValue,
      },
    }
  }
  throw new Error("Unknown operation")
}

function TaskGoalDescription(props: {
  bunnyDefinition: PresetBunnyDefinition
  sample: PresetBunnyBuildStateSample
}) {
  let description = props.bunnyDefinition.description
  let renderList: ReactNode[] = [description]
  let nextKey = 0
  for (const { name, value } of props.sample.argumentList) {
    renderList = arrayConcat(
      renderList.map<ReactNode[]>((item) => {
        if (typeof item !== "string") {
          return [item]
        }
        return arrayConcat(
          item.split(`\${${name}}`).map((text, idx) => {
            if (idx === 0) return [text]
            return [
              <span
                key={nextKey++}
                style={{ color: "blue", fontWeight: "bold" }}
              >
                {value}
              </span>,
              text,
            ]
          })
        )
      })
    )
  }
  return <span style={{ backgroundColor: "#eee" }}>{renderList}</span>
}

function TaskCredentialsDisplay(props: { appAccount: AppAccount }) {
  return (
    <div>
      {props.appAccount.attributes.map(({ name, value }, idx) => {
        return (
          <div key={idx}>
            {name}:{" "}
            <pre style={{ display: "inline" }}>
              <code style={{ backgroundColor: "#eee" }}>{value}</code>
            </pre>
          </div>
        )
      })}
    </div>
  )
}

function TaskDescription(props: {
  bunnyDefinition: PresetBunnyDefinition
  sample: PresetBunnyBuildStateSample
  appAccount: AppAccount | undefined
}) {
  return (
    <div>
      <div>
        MAIN TASK:{" "}
        <TaskGoalDescription
          bunnyDefinition={props.bunnyDefinition}
          sample={props.sample}
        />
      </div>
      <div>
        CLEANUP TASK:{" "}
        <span style={{ backgroundColor: "#eee" }}>
          {props.bunnyDefinition.cleanupDescription}
        </span>
      </div>
      {props.appAccount !== undefined && (
        <div>
          LOGIN CREDENTIALS:{" "}
          <TaskCredentialsDisplay appAccount={props.appAccount} />
        </div>
      )}
    </div>
  )
}

function buildHighlightedNodes(currentStep: PendingStep): TreeNodeLocation[] {
  const result: TreeNodeLocation[] = []
  if (currentStep.nodeSelectorState !== undefined) {
    if (currentStep.nodeSelectorState.type === "static") {
      if (currentStep.nodeSelectorState.targetLocation !== undefined) {
        result.push(currentStep.nodeSelectorState.targetLocation)
      }
    } else if (currentStep.nodeSelectorState.type === "listOne") {
      if (currentStep.nodeSelectorState.targetLocation !== undefined) {
        result.push(currentStep.nodeSelectorState.targetLocation)
      }
      if (currentStep.nodeSelectorState.firstSubjectLocation !== undefined) {
        result.push(currentStep.nodeSelectorState.firstSubjectLocation)
      }
      if (currentStep.nodeSelectorState.secondSubjectLocation !== undefined) {
        result.push(currentStep.nodeSelectorState.secondSubjectLocation)
      }
    } else if (currentStep.nodeSelectorState.type === "listAll") {
      if (currentStep.nodeSelectorState.targetLocation !== undefined) {
        result.push(currentStep.nodeSelectorState.targetLocation)
      }
      if (currentStep.nodeSelectorState.firstSubjectLocation !== undefined) {
        result.push(currentStep.nodeSelectorState.firstSubjectLocation)
      }
      if (currentStep.nodeSelectorState.secondSubjectLocation !== undefined) {
        result.push(currentStep.nodeSelectorState.secondSubjectLocation)
      }
    }
  }
  return result
}

export function Builder(props: {
  buildTaskId: string
  workerId: string
  task: FetchTaskResponse
  onDone: (succeeded: boolean) => void
}) {
  const [startedTime, setStartedTime] = useState<Date>()
  useEffect(() => {
    setStartedTime(new Date())
  }, [props.buildTaskId, props.workerId])
  const [replaying, setReplaying] = useState<boolean>(
    props.task.record === undefined
  )
  const webExecutorRef = useRef<WebExecutor>()
  const recordPageExecutorRef = useRef<PageExecutor>()
  const [bunnyHostWebClient, setBunnyHostWebClient] =
    useState<BunnyHostWebClient>()
  const [record, setRecord] = useState<PresetRecord>(
    props.task.review?.record.record ?? {
      authStateJson: undefined,
      mainSteps: [],
      cleanupSteps: [],
    }
  )
  const [sampleIdx, setSampleIdx] = useState<number>(0)
  const sample = props.task.samples[sampleIdx]
  const [reportedContents, setReportedContents] = useState<
    { name: string; content: string }[]
  >([])
  const [replayingStep, setReplayingStep] = useState<PresetStep>()
  const [failedStep, setFailedStep] = useState<PresetStep>()
  const [currentStep, setCurrentStep] = useState<PendingStep>({})
  const [phase, setPhase] = useState<"auth" | "main" | "cleanup">(
    props.task.record !== undefined ? "auth" : "main"
  )
  const [performingStep, setPerformingStep] = useState<boolean>(false)
  const handleNodeSelected = (tree: Tree, nodeLocation: TreeNodeLocation) => {
    setCurrentStep((step) => {
      if (step.nodeSelectorState === undefined) return step
      if (step.nodeSelectorState.selecting === "target") {
        return {
          ...step,
          tree,
          nodeSelectorState: {
            ...step.nodeSelectorState,
            targetLocation: nodeLocation,
            selecting: undefined,
          },
        }
      } else if (step.nodeSelectorState.selecting === "firstSubject") {
        return {
          ...step,
          tree,
          nodeSelectorState: {
            ...step.nodeSelectorState,
            firstSubjectLocation: nodeLocation,
            selecting: undefined,
          },
        }
      } else if (step.nodeSelectorState.selecting === "secondSubject") {
        return {
          ...step,
          tree,
          nodeSelectorState: {
            ...step.nodeSelectorState,
            secondSubjectLocation: nodeLocation,
            selecting: undefined,
          },
        }
      }
      return step
    })
  }
  const hightlightedNodes = useMemo(
    () => buildHighlightedNodes(currentStep),
    [currentStep]
  )
  const completeStep =
    currentStep === undefined ? undefined : buildStep(currentStep)
  const performStep = async (
    scope: Scope,
    presetStep: PresetStep,
    sample: PresetBunnyBuildStateSample,
    bunnyHostWebClient: BunnyHostWebClient,
    sleepBeforePerform: boolean
  ): Promise<boolean> => {
    try {
      setReplayingStep(presetStep)
      setFailedStep(undefined)
      setPerformingStep(true)
      if (sleepBeforePerform) {
        await sleepSeconds(scope, 5)
      }
      const response = await bunnyHostWebClient.post_presetStep.fetch(
        {
          presetStep,
          argumentList: sample.argumentList,
        },
        checkAndGetAbortSignal(scope)
      )
      const reportName = presetStep.report?.name
      const content = response?.report
      if (content !== undefined && reportName !== undefined) {
        setReportedContents((contents) => {
          return [...contents, { name: reportName, content }]
        })
      }
      return true
    } catch (e) {
      setFailedStep(presetStep)
      return false
    } finally {
      setReplayingStep(undefined)
      setPerformingStep(false)
    }
  }
  const handleAppendStep = () => {
    if (completeStep == undefined) return
    setRecord((record) => {
      if (phase === "main") {
        return {
          ...record,
          mainSteps: [...record.mainSteps, completeStep],
        }
      } else if (phase === "cleanup") {
        return {
          ...record,
          cleanupSteps: [...record.cleanupSteps, completeStep],
        }
      }
      return record
    })
    setCurrentStep({})
    withGlobalService(async (scope, clientService) => {
      if (bunnyHostWebClient === undefined) {
        return
      }
      await performStep(scope, completeStep, sample, bunnyHostWebClient, false)
    })
  }
  const handleReplayAllSteps = () => {
    if (phase === "cleanup") {
      setPhase("main")
    }
    if (replaying) {
      setSampleIdx((sampleIdx) => sampleIdx + 1)
    }
    setReplaying(true)
    setReportedContents([])
  }
  const replayAllSteps = (
    pageExecutor: PageExecutor,
    bunnyHostWebClient: BunnyHostWebClient
  ) => {
    withGlobalService(async (scope, clientService) => {
      for (const step of phase === "main"
        ? record.mainSteps
        : record.cleanupSteps) {
        if (
          !(await performStep(scope, step, sample, bunnyHostWebClient, true))
        ) {
          break
        }
      }
      if (phase === "main") {
        setPhase("cleanup")
      }
    })
  }
  const cannotCompleteReason =
    failedStep !== undefined
      ? "Failed to perform step"
      : replaying == false
      ? "You should replay all steps after recording your steps"
      : sampleIdx < props.task.samples.length - 1
      ? "You should replay all steps for all samples"
      : replayingStep !== undefined
      ? "You should wait until the replaying is finished"
      : undefined
  const handleConclude = (concludeType: ConcludeType, reason: string) => {
    const timeSpentSeconds =
      (Date.now() - (startedTime ?? new Date())?.getTime()) / 1000
    if (props.task.record !== undefined) {
      withGlobalService(async (scope, clientService) => {
        await clientService
          .getPresetBunnyBuilderClient()
          .post_submitRecordTask.fetch(
            {
              recordTask: {
                buildTaskId: props.buildTaskId,
                workerId: props.workerId,
                time: new Date(),
                succeeded: concludeType === "complete",
                failureReason: `[${concludeType}] ${reason}`,
                timeSpentSeconds,
                record,
              },
            },
            checkAndGetAbortSignal(scope)
          )
        props.onDone(concludeType === "complete")
      })
    } else if (props.task.review !== undefined) {
      withGlobalService(async (scope, clientService) => {
        if (concludeType !== "abort") {
          await clientService
            .getPresetBunnyBuilderClient()
            .post_submitReviewTask.fetch(
              {
                reviewTask: {
                  buildTaskId: props.buildTaskId,
                  workerId: props.workerId,
                  time: new Date(),
                  succeeded: concludeType === "complete",
                  failureReason: `[${concludeType}] ${reason}`,
                  timeSpentSeconds,
                },
              },
              checkAndGetAbortSignal(scope)
            )
        }
        props.onDone(concludeType === "complete")
      })
    }
  }
  const handleAuthComplete = () => {
    withGlobalService(async (scope, clientService) => {
      const contextId = (await webExecutorRef.current?.listContexts(scope))
        ?.contexts[0]?.contextId
      if (contextId === undefined) return
      const authStateJson = await webExecutorRef.current?.exportContextState(
        scope,
        contextId
      )
      setRecord((record) => {
        return {
          ...record,
          authStateJson,
        }
      })
      setPhase("main")
    })
  }
  const handleMainComplete = () => {
    setPhase("cleanup")
  }

  return (
    <div className="rabbit">
      <div style={{ fontSize: "1.5em" }}>
        <TaskDescription
          bunnyDefinition={props.task.bunnyDefinition}
          sample={sample}
          appAccount={props.task.account}
        />
      </div>
      <div
        style={{
          display: "flex",
        }}
      >
        <div>
          {!replaying ? (
            // Recording
            <Browser
              key={`recording-${phase}`}
              url={props.task.appProfile.url}
              viewOnly={performingStep}
              stateJson={record.authStateJson}
              interactionMode={
                phase === "auth"
                  ? {
                      selecting: false,
                      highlight: undefined,
                    }
                  : {
                      selecting: true,
                      highlight: hightlightedNodes,
                    }
              }
              onPageExecutorReady={(
                webExecutor,
                pageExecutor,
                bunnyHostWebClient
              ) => {
                webExecutorRef.current = webExecutor
                recordPageExecutorRef.current = pageExecutor
                setBunnyHostWebClient(bunnyHostWebClient)
              }}
              onNodeSelected={handleNodeSelected}
            />
          ) : (
            // Replaying
            <Browser
              key={`${replaying}-${sampleIdx}-${phase}`}
              url={props.task.appProfile.url}
              viewOnly={true}
              stateJson={record.authStateJson}
              interactionMode={{
                selecting: true,
                highlight: undefined,
              }}
              onPageExecutorReady={(
                webExecutor,
                pageExecutor,
                bunnyHostWebClient
              ) => {
                webExecutorRef.current = webExecutor
                replayAllSteps(pageExecutor, bunnyHostWebClient)
              }}
              onNodeSelected={() => {}}
            />
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "1.2em" }}>
            {!replaying && phase === "auth" && (
              <div>
                Please log into the website using the provided credentials.
                Optionally you may get familiar with the website before
                proceeding to the main task.
              </div>
            )}
            {!replaying && phase === "main" && (
              <div>Please perform the main task.</div>
            )}
            {!replaying && phase === "cleanup" && (
              <div>Please perform the cleanup task.</div>
            )}
            {replaying && (
              <div>
                Replaying ({sampleIdx + 1}/{props.task.samples.length}). Please
                check if all steps are performed as expected.
              </div>
            )}
          </div>
          <hr />
          Recorded main steps:
          <StepListPanel
            steps={record.mainSteps}
            replayingStep={replayingStep}
            failedStep={failedStep}
          />
          <hr />
          Recorded cleanup steps:
          <StepListPanel
            steps={record.cleanupSteps}
            replayingStep={replayingStep}
            failedStep={failedStep}
          />
          {replaying === false && phase !== "auth" ? (
            <div>
              <StepEditor
                bunnyDefinition={props.task.bunnyDefinition}
                sample={sample}
                step={currentStep}
                onStepChange={(step) => setCurrentStep(step)}
              />
              <div>
                <button
                  disabled={
                    completeStep === undefined ||
                    bunnyHostWebClient === undefined
                  }
                  onClick={handleAppendStep}
                >
                  Append and perform step
                </button>
              </div>
            </div>
          ) : null}
          {!replaying && phase === "auth" && (
            <div>
              <button
                onClick={() => {
                  handleAuthComplete()
                }}
              >
                Finish logging into the website - will perform main task next
              </button>
            </div>
          )}
          {!replaying && phase === "main" && (
            <div>
              <button
                onClick={() => {
                  handleMainComplete()
                }}
                disabled={
                  replayingStep !== undefined || failedStep !== undefined
                }
              >
                Finish main task - will perform cleanup next
              </button>
            </div>
          )}{" "}
          {phase === "cleanup" && !replaying && (
            <div>
              <button
                onClick={handleReplayAllSteps}
                disabled={
                  replayingStep !== undefined || failedStep !== undefined
                }
              >
                Finish cleanup task - will replay all steps
              </button>
            </div>
          )}
          {replaying && sampleIdx < props.task.samples.length - 1 && (
            <div>
              <button
                onClick={handleReplayAllSteps}
                disabled={
                  replayingStep !== undefined || failedStep !== undefined
                }
              >
                Confirm replaying successfully - will replay again for more
                arguments
              </button>
            </div>
          )}
          <div>
            Reported contents:
            {reportedContents.map((content, idx) => {
              return (
                <div key={idx}>
                  {content.name}:{" "}
                  <code style={{ backgroundColor: "#eee" }}>
                    {content.content}
                  </code>
                  <hr />
                </div>
              )
            })}
          </div>
          <ConcludePanel
            cannotCompleteReason={cannotCompleteReason}
            onConclude={handleConclude}
          />
        </div>
      </div>
    </div>
  )
}
