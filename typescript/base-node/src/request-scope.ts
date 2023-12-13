import {
  Scope,
  SignalController,
  launchBackgroundScope,
  sleepUntilCancel,
} from "base-core/lib/scope.js"
import { log } from "base-core/lib/logging.js"

import { init } from "./init.js"
import { flyingPromise } from "base-core/lib/utils.js"
import {
  ValueOrError,
  asValueOrThrow,
  catchErrorAsync,
} from "base-core/lib/one-of.js"
import { runMainScope } from "./main-scope.js"

export let globalScopePromise: Promise<Scope> | undefined

export async function runRequestScope<T>(
  body: (scope: Scope) => Promise<T>
): Promise<T> {
  if (globalScopePromise === undefined) {
    init()
    globalScopePromise = new Promise<Scope>((resolve) => {
      flyingPromise(() =>
        runMainScope(async (scope, cancel) => {
          resolve(scope)
          await sleepUntilCancel(scope)
        })
      )
    })
  }
  const globalScope = await globalScopePromise
  const signalController = new SignalController<ValueOrError<T>>()
  launchBackgroundScope(globalScope, async (scope) => {
    signalController.emit(
      await catchErrorAsync(Error, async () => await body(scope))
    )
  })
  return asValueOrThrow(await signalController.waitUntilReady(globalScope))
}
