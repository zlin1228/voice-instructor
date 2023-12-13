import { execFile } from "node:child_process"

import {
  Scope,
  cancelTokenToAbortSignal,
  checkAndGetCancelToken,
} from "base-core/lib/scope.js"

export interface CommandExecutorConfig {
  executableFile: string
  prefixArgs: string[]
}

export class CommandExecutor {
  readonly #config: CommandExecutorConfig
  constructor(config: CommandExecutorConfig) {
    this.#config = config
  }

  async run(scope: Scope, args: string[]): Promise<string> {
    const cancelToken = checkAndGetCancelToken(scope)
    const signal = cancelTokenToAbortSignal(cancelToken)
    return await new Promise((resolve, reject) => {
      execFile(
        this.#config.executableFile,
        [...this.#config.prefixArgs, ...args],
        { signal },
        (error, stdout, stderr) => {
          if (error) {
            reject(error)
            return
          }
          resolve(stdout)
        }
      )
    })
  }
}
