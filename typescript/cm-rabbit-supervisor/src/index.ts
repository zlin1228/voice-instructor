import fsPromises from "node:fs/promises"

import {
  Scope,
  checkAndGetCancelToken,
  launchBackgroundScope,
  sleepSeconds,
  sleepUntil,
  sleepUntilCancel,
} from "base-core/lib/scope.js"

import {
  createFastifyPluginFromService,
  createFastifyServer,
} from "base-fastify/lib/fastify-server.js"

import { getSelfPodNamespace } from "base-kubernetes/lib/kubernetes.js"
import { runMainScope } from "base-node/lib/main-scope.js"
import { stringRemovePrefix } from "base-core/lib/string.js"
import { abortIfUndefined } from "base-core/lib/debug.js"
import { KubernetesClient } from "base-kubernetes/lib/client.js"
import { configMapResource } from "base-kubernetes/lib/core.js"
import { log } from "base-core/lib/logging.js"
import { throwError } from "base-core/lib/exception.js"

import { metaConfigType } from "cm-rabbit-common/lib/schema/schema.js"
import { testOs2 } from "./test-os2.js"
import { commonNormalizer } from "base-core/lib/types-common.js"
import {
  getGcpConsoleLinkToGcsPath,
  uploadGcsDirectory,
} from "base-gcp/lib/gcs.js"
import { makeTemporaryDirectory } from "base-node/lib/file.js"

const port = parseInt(process.env["PORT"] ?? "1080")

const slackPostMessageUrl =
  "https://hooks.slack.com/services/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"

const slackTestingPostMessageUrl =
  "https://hooks.slack.com/services/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"

const testLoopIntervalSeconds = 60 * 30
const testDownDurationSeconds = 60 * 180
const testUpDurationSeconds = 60 * 90

const gcsPrefix = "gs://cm-rabbit-supervisor"

function getOs2Url(): string {
  const namespace = getSelfPodNamespace()
  if (namespace === undefined) {
    return "http://localhost:8080/"
  }
  if (namespace === "os2-prod") {
    return "https://demo.rabbit.tech/webapp/en/"
  }
  return `https://${abortIfUndefined(
    stringRemovePrefix(namespace, "os2-")
  )}.rabbit.tech/webapp/en/`
}

async function sendSlackAlert(
  scope: Scope,
  up: boolean,
  os2Url: string,
  namespace: string,
  testHistory: {
    time: Date
    error: Error | undefined
  }[]
): Promise<void> {
  const message = `[rabbit supervisor] Test for ${os2Url} ${
    up ? "succeeded" : "failed"
  }. Check ${getGcpConsoleLinkToGcsPath(
    gcsPrefix
  )} for recorded videos.\nTest history:\n${testHistory
    .slice(-10)
    .map(({ time, error }) => {
      const timeStr = time.toISOString()
      const errorStr = error === undefined ? "OK" : String(error)
      return `${timeStr} ${errorStr}`
    })
    .join("\n")}`
  log.info(`Sending slack alert: ${message}`)
  const response = await fetch(
    namespace === "os2-prod" ? slackPostMessageUrl : slackTestingPostMessageUrl,
    {
      method: "POST",
      headers: { "Content-type": "application/json" },
      body: JSON.stringify({ text: message }),
    }
  )
  if (!response.ok) {
    log.info(`Failed to send slack alert: ${response.statusText}`)
  }
}

async function runTestLoop(scope: Scope, os2Url: string): Promise<void> {
  const cancelToken = checkAndGetCancelToken(scope)
  const k8sClient = await KubernetesClient.build(scope)
  const namespace = getSelfPodNamespace()
  let lastSucceededTime = new Date()
  let lastFailedTime = new Date()
  const testHistory: {
    time: Date
    error: Error | undefined
  }[] = []
  launchBackgroundScope(scope, async (scope) => {
    while (cancelToken.cancelReason === undefined) {
      const beginTime = new Date()
      log.info(`Begin test at ${beginTime.toISOString()}`)
      const dir = await makeTemporaryDirectory(scope, "videos")
      let pass = false
      try {
        const namespaceString = namespace ?? "os2-dev"
        const error = await testOs2(scope, {
          url: os2Url,
          username: `dev-test-${namespaceString}@cybermanufacture.co`,
          password: "os2testtest",
          videoDir: dir,
        })
        testHistory.push({
          time: beginTime,
          error,
        })
        if (error !== undefined) {
          log.info(`Test failed: ${String(error)}`)
          console.log(error)
          lastFailedTime = new Date()
        } else {
          log.info(`Test succeeded`)
          lastSucceededTime = new Date()
          pass = true
        }
      } finally {
        const gcsPath = `${gcsPrefix}/${namespace ?? "local"}/videos/${
          pass ? "pass" : "fail"
        }/${beginTime.toISOString()}`
        log.info(`Uploading videos to ${gcsPath}`)
        await uploadGcsDirectory(scope, dir, gcsPath)
        log.info(`Deleting local videos at ${dir}`)
        await fsPromises.rm(dir, { recursive: true, force: true })
      }
      log.info(`Sleep until next test loop`)
      await sleepUntil(
        scope,
        new Date(beginTime.getTime() + 1000 * (namespace === "os2-prod" ? 1 : 5) * testLoopIntervalSeconds)
      )
    }
  })
  let lastStateChangeTime = new Date()
  while (cancelToken.cancelReason === undefined) {
    await (async () => {
      const metaConfigMap = await k8sClient.readObject(
        scope,
        namespace ?? "os2-dev",
        "os2-meta-config",
        configMapResource
      )
      const metaJson =
        metaConfigMap.data?.["meta.json"] ??
        throwError("Failed to parse the rabbit meta config")
      const meta = commonNormalizer(metaConfigType, JSON.parse(metaJson))
      if (
        lastSucceededTime.getTime() + 1000 * testDownDurationSeconds <
        new Date().getTime()
      ) {
        if (
          lastStateChangeTime.getTime() + 1000 * 10 * 60 >=
          new Date().getTime()
        ) {
          return
        }
        if (!meta.serviceUp) {
          return
        }
        log.info(`Bring down the service`)
        if (namespace !== undefined) {
          const newMetaConfigMap = {
            ...metaConfigMap,
            data: {
              ...metaConfigMap.data,
              ["meta.json"]: JSON.stringify({
                ...meta,
                serviceUp: false,
              }),
            },
          }
          await k8sClient.updateObject(scope, newMetaConfigMap)
          await sendSlackAlert(scope, false, os2Url, namespace, testHistory)
        }
      } else if (
        lastFailedTime.getTime() + 1000 * testUpDurationSeconds <
        new Date().getTime()
      ) {
        if (
          lastStateChangeTime.getTime() + 1000 * 10 * 60 >=
          new Date().getTime()
        ) {
          return
        }
        if (meta.serviceUp) {
          return
        }
        log.info(`Bring up the service`)
        if (namespace !== undefined) {
          const newMetaConfigMap = {
            ...metaConfigMap,
            data: {
              ...metaConfigMap.data,
              ["meta.json"]: JSON.stringify({
                ...meta,
                serviceUp: true,
              }),
            },
          }
          await k8sClient.updateObject(scope, newMetaConfigMap)
          await sendSlackAlert(scope, true, os2Url, namespace, testHistory)
        }
      }
    })()
    await sleepSeconds(scope, 60)
  }
}

async function main(scope: Scope, cancel: (error: Error) => void) {
  const server = await createFastifyServer(scope)
  const address = await server.listen({ port, host: "0.0.0.0" })
  console.log(`Server listening at ${address}`)
  const os2Url = getOs2Url()
  log.info(`Supervising rabbit at: ${os2Url}`)
  await runTestLoop(scope, os2Url)
  await sleepUntilCancel(scope)
}

void (async () => {
  await runMainScope(main)
  process.exit()
})()
