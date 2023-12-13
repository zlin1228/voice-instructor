import k8s from "@kubernetes/client-node"

import { MinionClan } from "./minion.js"
import {
  Scope,
  buildAttachmentForTimeout,
  checkAndGetCancelToken,
  launchBackgroundScope,
  sleepSeconds,
} from "base-core/lib/scope.js"
import { stringRandomSimpleName } from "base-core/lib/string.js"
import { abortIfUndefined } from "base-core/lib/debug.js"
import { log } from "base-core/lib/logging.js"

export class MinionPool {
  readonly #minionClan: MinionClan
  readonly #podSpec: k8s.V1PodSpec
  readonly #freeMinions = new Map<string, Date>()

  constructor(
    scope: Scope,
    minionClan: MinionClan,
    podSpec: k8s.V1PodSpec,
    size: number
  ) {
    this.#minionClan = minionClan
    this.#podSpec = podSpec
    launchBackgroundScope(scope, async (scope) => {
      try {
        const cancelToken = checkAndGetCancelToken(scope)
        while (cancelToken.cancelReason === undefined) {
          for (const [sessionName, createdAt] of this.#freeMinions.entries()) {
            if (Date.now() - createdAt.getTime() > 1000 * 60 * 30) {
              log.info(`Deleting minion due to timeout [${sessionName}]`)
              this.#freeMinions.delete(sessionName)
              await this.#minionClan.deleteMinion(scope, sessionName)
              // Break here so that we delete at most a minion at a time.
              break
            }
          }
          if (this.#freeMinions.size < size) {
            const sessionName = stringRandomSimpleName(8)
            const attachment = buildAttachmentForTimeout(60 * 5)
            try {
              await Scope.with(scope, [attachment], async (scope) => {
                await this.#minionClan.createMinion(scope, sessionName, podSpec)
              })
              this.#freeMinions.set(sessionName, new Date())
            } catch (e) {
              await this.#minionClan.deleteMinion(scope, sessionName)
            }
          }
          await sleepSeconds(scope, 1)
        }
      } finally {
        while (this.#freeMinions.size > 0) {
          const sessionName = abortIfUndefined([...this.#freeMinions.keys()][0])
          this.#freeMinions.delete(sessionName)
          await this.#minionClan.deleteMinion(scope, sessionName)
        }
      }
    })
  }

  async attachMinion(scope: Scope): Promise<string> {
    if (this.#freeMinions.size === 0) {
      log.info(`Creating new minion due to empty pool`)
      const sessionName = stringRandomSimpleName(8)
      const attachment = buildAttachmentForTimeout(60)
      try {
        await Scope.with(scope, [attachment], async (scope) => {
          await this.#minionClan.createMinion(scope, sessionName, this.#podSpec)
        })
      } catch (e) {
        await this.#minionClan.deleteMinion(scope, sessionName)
        throw e
      }
      return sessionName
    }
    const sessionName = abortIfUndefined([...this.#freeMinions.keys()][0])
    this.#freeMinions.delete(sessionName)
    return sessionName
  }
}
