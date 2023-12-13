import { Scope, sleepSeconds } from "base-core/lib/scope.js"
import { playwright } from "base-playwright/lib/deps.js"
import { connectToChrome } from "base-playwright/lib/playwright.js"
import { WebExecutor } from "cm-bunny-host-web-common/lib/action/web-action.js"
import {
  WebExecutorBrowser,
  buildWebExecutorBrowser,
} from "./executor/executor.js"
import { BunnyHostWebService, buildBunnyHostWebService } from "./service.js"
import {
  isInDockerEnvironment,
  isInKubernetesEnvironment,
} from "base-node/lib/environment.js"
import { buildBashCommandExecutor } from "base-node/lib/command-executor.js"
import { retryable } from "base-core/lib/concurrency.js"
import { log } from "base-core/lib/logging.js"

export interface Profile {
  readonly webExecutorBrowser: WebExecutorBrowser
  readonly service: BunnyHostWebService
}

async function launchChromeLocally(scope: Scope): Promise<playwright.Browser> {
  const commandExecutor = await buildBashCommandExecutor(scope)
  const out = await commandExecutor.run(scope, [
    "/home/yt/repo/layers/cm-bunny-host-web/scripts/browsing.sh",
    "",
    "",
    "",
  ])
  console.log(out)
  return await retryable(30, async (retry) => {
    try {
      if (retry > 0) {
        await sleepSeconds(scope, 1)
      }
      log.info("Connecting to Chrome...")
      return await playwright.chromium.connectOverCDP("http://localhost:9222", {
        timeout: 1000,
      })
    } catch (e) {
      console.log(e)
      throw e
    }
  })
}

async function buildChrome(
  scope: Scope,
  launchLocally: boolean
): Promise<playwright.Browser> {
  if (launchLocally) {
    return await launchChromeLocally(scope)
  }
  const chromeAddress =
    process.env["CM_BUNNY_HOST_WEB_CHROME_ADDRESS"] ?? "localhost:9222"
  return await connectToChrome(scope, chromeAddress)
}

export async function buildDefaultProfile(scope: Scope): Promise<Profile> {
  const inDocker = await isInDockerEnvironment()
  const inKubernetes = await isInKubernetesEnvironment()
  const browser = await buildChrome(scope, inDocker || inKubernetes)
  const webExecutorBrowser = await buildWebExecutorBrowser(scope, browser)
  const service = await buildBunnyHostWebService(
    scope,
    webExecutorBrowser.webExecutor
  )
  return {
    webExecutorBrowser,
    service,
  }
}
