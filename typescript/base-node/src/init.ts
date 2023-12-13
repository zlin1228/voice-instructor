import {
  DebugProvider,
  StackFrame,
  abortIfUndefined,
  setDebugProvider,
} from "base-core/lib/debug.js"
import { maybeUndefined } from "base-core/lib/optional.js"
import {
  stringRemovePrefix,
  stringGetLast,
  stringCutLast,
  stringToInt,
} from "base-core/lib/string.js"
import { forceGetProperty } from "base-core/lib/utils.js"
import {
  stringifierRegistry,
  StringifierRegistry,
} from "base-core/lib/stringify.js"
import { Frame, LogEntity, frameToString, log } from "base-core/lib/logging.js"

function extractFrame(line: string): StackFrame {
  const callSite = abortIfUndefined(stringRemovePrefix(line, "    at "))
  const fileLocation = callSite.endsWith(")")
    ? stringGetLast(callSite.slice(0, -1), " (")
    : callSite
  const num1 = maybeUndefined(stringCutLast)(fileLocation, ":")
  const num2 = maybeUndefined(stringCutLast)(num1?.[0], ":")
  const fileName = num2 ? num2[0] : num1 ? num1[0] : `[${line}]`
  const lineNumber = maybeUndefined(stringToInt)(num2 ? num2[1] : num1?.[1])
  const columnNumber = maybeUndefined(stringToInt)(num2 ? num1?.[1] : undefined)
  return {
    fileName,
    lineNumber,
    columnNumber,
  }
}

class NodeDebugProvider implements DebugProvider {
  abort(why: unknown): never {
    console.trace("[base-node] Abort!", why)
    debugger
    process.exit(1)
  }

  captureStackTrace(frameDepth: number, limit: number): StackFrame[] {
    if (forceGetProperty(Error, "captureStackTrace") === undefined) {
      return []
    }
    const previousLimit = Error.stackTraceLimit
    Error.stackTraceLimit = frameDepth + limit
    const holder: { stack?: string } = {}
    Error.captureStackTrace(holder, this.captureStackTrace)
    Error.stackTraceLimit = previousLimit
    const stack = abortIfUndefined(holder.stack)
    const lines = stack.split("\n").slice(1 + frameDepth)
    return lines.map(extractFrame)
  }

  toString() {
    return "base-node"
  }
}

class LogConsolePrinter {
  constructor(private stringifierRegistry: StringifierRegistry) {}

  print(logEntity: LogEntity) {
    if (!this.shouldPrint(logEntity)) return
    const time = `${logEntity.time
      .getHours()
      .toString()
      .padStart(2, "0")}:${logEntity.time
      .getMinutes()
      .toString()
      .padStart(2, "0")}:${logEntity.time
      .getSeconds()
      .toString()
      .padStart(2, "0")}`
    const src = maybeUndefined(frameToString)(logEntity.stackTrace[0])
    const value = this.stringifierRegistry.stringify(
      logEntity.kind ?? "",
      JSON.parse(logEntity.value),
      {
        scenario: "log",
      }
    )
    const text = [time, " ", src, "] ", value].join("")
    console.log(text)
    if (logEntity.stackTrace.length > 1) {
      for (const frame of logEntity.stackTrace.slice(1)) {
        console.log("  " + frameToString(frame))
      }
    }
  }

  shouldPrint(logEntity: LogEntity): boolean {
    if ((logEntity.level ?? 1) <= 1) {
      return true
    }
    if (logEntity.key === "functionAsyncEnter") {
      return true
    }
    if (logEntity.key === "functionAsyncThrow") {
      return true
    }
    return false
  }
}

let initialized = false

export function init() {
  if (initialized) return
  initialized = true
  setDebugProvider(new NodeDebugProvider())
  const logConsolePrinter = new LogConsolePrinter(stringifierRegistry)
  log.registerListener((logEntity) => {
    logConsolePrinter.print(logEntity)
  })
}
