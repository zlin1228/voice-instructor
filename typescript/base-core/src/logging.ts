import { abortIfUndefined, captureStackTrace } from "./debug.js"
import {
  buildEntityValue,
  buildUntypedEntityValue,
  entityRegistry,
  GenericEntityValue,
} from "./entity.js"
import {
  concatStringsOrUndefined,
  maybeUndefined,
  undefinedIfFalsy,
} from "./optional.js"
import {
  stringCutLast,
  stringGetLast,
  stringRemovePrefix,
  stringToInt,
} from "./string.js"
import { stringifierRegistry, StringifierRegistry } from "./stringify.js"
import {
  arrayType,
  CookType,
  int32Type,
  objectType,
  stringType,
  timestampType,
} from "./types.js"

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/stack
// https://stackoverflow.com/questions/33345737/how-to-format-a-stacktrace-using-error-preparestacktrace
// https://v8.dev/docs/stack-trace-api
// https://github.com/felixge/node-stack-trace/blob/master/index.js

export const frameType = objectType([
  { name: "fileName", type: stringType },
  { name: "lineNumber", type: int32Type, optional: true },
  { name: "columnNumber", type: int32Type, optional: true },
  { name: "functionName", type: stringType, optional: true },
] as const)

export type Frame = CookType<typeof frameType>

export function frameToString(frame: Frame): string {
  const edenPath = stringRemovePrefix(
    stringRemovePrefix(
      frame.fileName,
      "webpack-internal:///(sc_server)/./src/"
    ) ?? frame.fileName,
    getEdenRootPath()
  )
  return [
    edenPath === undefined
      ? stringRemovePrefix(
          frame.fileName,
          "webpack-internal:///(sc_server)/./src/"
        ) ?? frame.fileName
      : `.${edenPath}`,
    concatStringsOrUndefined(":", frame.lineNumber?.toString()),
    concatStringsOrUndefined(" ", frame.functionName),
  ].join("")
}

export const logEntityType = objectType([
  { name: "time", type: timestampType },
  { name: "value", type: stringType },
  { name: "level", type: int32Type, optional: true },
  { name: "key", type: stringType, optional: true },
  { name: "stackTrace", type: arrayType(frameType) },
  { name: "kind", type: stringType, optional: true },
] as const)

export type LogEntity = CookType<typeof logEntityType>

export function buildStackTrace(frameDepth: number, limit: number): Frame[] {
  return captureStackTrace(frameDepth + 1, limit)
}

let edenRootPath: string | undefined = undefined

function getEdenRootPath(): string {
  if (edenRootPath === undefined) {
    const frame = buildStackTrace(0, 1)
    edenRootPath = frame[0]?.fileName.split("/").slice(0, -3).join("/") ?? ""
  }
  return edenRootPath
}

export function buildLogEntity(item: {
  frameDepth: number
  stackTraceDepth: number
  level: number
  key: string
  value: GenericEntityValue
}): LogEntity {
  return {
    time: new Date(),
    value: JSON.stringify(item.value.value),
    level: undefinedIfFalsy(item.level),
    key: undefinedIfFalsy(item.key),
    stackTrace: buildStackTrace(item.frameDepth + 1, item.stackTraceDepth),
    kind: undefinedIfFalsy(item.value.kind),
  }
}

export const functionCallLogType = objectType([
  { name: "name", type: stringType },
  { name: "invocationId", type: int32Type },
  { name: "argumentValues", type: arrayType(stringType) },
] as const)

export type FunctionCallLog = CookType<typeof functionCallLogType>

export const functionCallLogEntity = entityRegistry.registerEntity(
  "FunctionCallLog",
  functionCallLogType
)

stringifierRegistry.registerEntity(
  functionCallLogEntity,
  (value, option): string => {
    return `${value.name}:${value.invocationId} (${value.argumentValues.join(
      ","
    )})`
  }
)

export const functionReturnLogType = objectType([
  { name: "name", type: stringType },
  { name: "invocationId", type: int32Type },
  { name: "returnValue", type: stringType },
] as const)

export type FunctionReturnLog = CookType<typeof functionReturnLogType>

export const functionReturnLogEntity = entityRegistry.registerEntity(
  "FunctionReturnLog",
  functionReturnLogType
)

stringifierRegistry.registerEntity(
  functionReturnLogEntity,
  (value, option): string => {
    return `${value.name}:${value.invocationId} => ${value.returnValue}`
  }
)

export const functionThrowLogType = objectType([
  { name: "name", type: stringType },
  { name: "invocationId", type: int32Type },
  { name: "throwValue", type: stringType },
] as const)

export type FunctionThrowLog = CookType<typeof functionThrowLogType>

export const functionThrowLogEntity = entityRegistry.registerEntity(
  "FunctionThrowLog",
  functionThrowLogType
)

stringifierRegistry.registerEntity(
  functionThrowLogEntity,
  (value, option): string => {
    return `${value.name}:${value.invocationId} x=> ${value.throwValue}`
  }
)

let functionCallInvocationId = 0

export class Logger {
  #listeners: ((logEntity: LogEntity) => void)[] = []

  stringify(value: unknown): string {
    return stringifierRegistry.stringify("", value, {
      scenario: "log",
    })
  }

  log(logEntity: LogEntity) {
    for (const listener of this.#listeners) listener(logEntity)
  }

  registerListener(listener: (logEntity: LogEntity) => void) {
    this.#listeners.push(listener)
  }

  info(message: unknown): void {
    const logEntity = buildLogEntity({
      frameDepth: 1,
      value: buildUntypedEntityValue(message),
      level: 1,
      key: "info",
      stackTraceDepth: 1,
    })
    this.log(logEntity)
  }

  debug(message: unknown): void {
    const logEntity = buildLogEntity({
      frameDepth: 1,
      value: buildUntypedEntityValue(message),
      level: 2,
      key: "debug",
      stackTraceDepth: 1,
    })
    this.log(logEntity)
  }

  funcSync<R, Thiz, Args extends unknown[]>(
    fn: (this: Thiz, ...args: Args) => R
  ): (this: Thiz, ...args: Args) => R {
    const logThis = this
    const invocationId = functionCallInvocationId++
    return function (this: Thiz, ...args: Args): R {
      const callLog: FunctionCallLog = {
        name: fn.name,
        invocationId,
        argumentValues: args.map((arg) => logThis.stringify(arg)),
      }
      const logEntity = buildLogEntity({
        frameDepth: 1,
        value: buildEntityValue(functionCallLogEntity, callLog),
        level: 1,
        key: "functionSyncEnter",
        stackTraceDepth: 1,
      })
      logThis.log(logEntity)
      try {
        const r = fn.call(this, ...args)
        const returnLog: FunctionReturnLog = {
          name: fn.name,
          invocationId,
          returnValue: logThis.stringify(r),
        }
        const logEntity = buildLogEntity({
          frameDepth: 1,
          value: buildEntityValue(functionReturnLogEntity, returnLog),
          level: 2,
          key: "functionSyncReturn",
          stackTraceDepth: 1,
        })
        logThis.log(logEntity)
        return r
      } catch (e) {
        const throwLog: FunctionThrowLog = {
          name: fn.name,
          invocationId,
          throwValue: logThis.stringify(e),
        }
        const logEntity = buildLogEntity({
          frameDepth: 1,
          value: buildEntityValue(functionThrowLogEntity, throwLog),
          level: 2,
          key: "functionSyncThrow",
          stackTraceDepth: 1,
        })
        logThis.log(logEntity)
        throw e
      }
    }
  }

  funcAsync<R, Thiz, Args extends unknown[]>(
    fn: (this: Thiz, ...args: Args) => Promise<R>
  ): (this: Thiz, ...args: Args) => Promise<R> {
    const logThis = this
    return async function (this: Thiz, ...args: Args): Promise<R> {
      const invocationId = functionCallInvocationId++
      const callLog: FunctionCallLog = {
        name: fn.name,
        invocationId,
        argumentValues: args.map((arg) => logThis.stringify(arg)),
      }
      const logEntity = buildLogEntity({
        frameDepth: 1,
        value: buildEntityValue(functionCallLogEntity, callLog),
        level: 1,
        key: "functionAsyncEnter",
        stackTraceDepth: 1,
      })
      logThis.log(logEntity)
      try {
        const r = await fn.call(this, ...args)
        const returnLog: FunctionReturnLog = {
          name: fn.name,
          invocationId,
          returnValue: logThis.stringify(r),
        }
        const logEntity = buildLogEntity({
          frameDepth: 1,
          value: buildEntityValue(functionReturnLogEntity, returnLog),
          level: 1,
          key: "functionAsyncReturn",
          stackTraceDepth: 1,
        })
        logThis.log(logEntity)
        return r
      } catch (e) {
        const throwLog: FunctionThrowLog = {
          name: fn.name,
          invocationId,
          throwValue: logThis.stringify(e),
        }
        const logEntity = buildLogEntity({
          frameDepth: 1,
          value: buildEntityValue(functionThrowLogEntity, throwLog),
          level: 1,
          key: "functionAsyncThrow",
          stackTraceDepth: 1,
        })
        logThis.log(logEntity)
        throw e
      }
    }
  }
  here(message: unknown) {
    const logEntity = buildLogEntity({
      frameDepth: 1,
      value: buildUntypedEntityValue(message),
      level: 1,
      key: "here",
      stackTraceDepth: 10,
    })
    this.log(logEntity)
  }
  expr<T>(value: T): T {
    const logEntity = buildLogEntity({
      frameDepth: 1,
      value: buildUntypedEntityValue(value),
      level: 1,
      key: "expr",
      stackTraceDepth: 10,
    })
    this.log(logEntity)
    return value
  }
}

export const log = new Logger()
