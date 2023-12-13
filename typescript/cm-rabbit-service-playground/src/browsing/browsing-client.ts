import os from "node:os"

import { chromium, Browser, BrowserContext, Page } from "playwright"

import k8s, { V1PodSpec } from "@kubernetes/client-node"

import { connectToChrome } from "base-playwright/lib/playwright.js"

import {
  Scope,
  cancelTokenToAbortSignal,
  checkAndGetCancelToken,
  sleepSeconds,
} from "base-core/lib/scope.js"
import { MinionClan } from "../minion/minion.js"
import { log } from "base-core/lib/logging.js"

import {
  AppPort,
  KubernetesServiceLocator,
  buildContainerPort,
  getSelfPodName,
  getSelfPodNamespace,
} from "base-kubernetes/lib/kubernetes.js"
import { throwError } from "base-core/lib/exception.js"
import { arrayToVector } from "base-core/lib/array.js"
import { MinionPool } from "../minion/minion-pool.js"
import { stringRandomSimpleName } from "base-core/lib/string.js"

const novncPort = 6081
const browsingServicePort = 8080
const chromeDevtoolsPort = 9222

const browsingMinionAppPorts: AppPort[] = [
  {
    name: "chrome-devtools",
    protocol: "TCP",
    port: chromeDevtoolsPort,
  },
  {
    name: "sshd",
    protocol: "TCP",
    port: 22,
  },
  {
    name: "http-novnc",
    protocol: "TCP",
    port: novncPort,
  },
  {
    name: "mediasoup",
    protocol: "UDP",
    port: 20000,
  },
  {
    name: "http-browsing",
    protocol: "TCP",
    port: browsingServicePort,
  },
]

function buildBrowsingMinionPodSpec(debugEnabled: boolean): V1PodSpec {
  return {
    containers: [
      {
        name: "browsing-minion",
        image:
          "us-docker.pkg.dev/cmc-ai/quantum/cm-browsing-minion:yt-230602-031153",
        ports: browsingMinionAppPorts.map(buildContainerPort),
        env: [
          {
            name: "CM_BROWSING_MINION_SELF_HOST_FOR_WEBRTC",
            valueFrom: {
              fieldRef: {
                fieldPath: "status.podIP",
              },
            },
          },
          ...(debugEnabled
            ? [
                {
                  name: "CM_BROWSING_MINION_DEBUG",
                  value: "1",
                },
              ]
            : []),
        ],
        // TODO: Try to reduce the resource requirements
        resources: {
          requests: {
            cpu: "2",
            memory: "2Gi",
          },
          limits: {
            cpu: "2",
            memory: "2Gi",
          },
        },
        volumeMounts: [
          {
            mountPath: "/dev/shm",
            name: "dshm",
          },
        ],
        startupProbe: {
          httpGet: {
            path: "/healthz",
            port: "http-browsing",
          },
          periodSeconds: 1,
          timeoutSeconds: 1,
          failureThreshold: debugEnabled ? 3000 : 30,
        },
        livenessProbe: {
          httpGet: {
            path: "/healthz",
            port: "http-browsing",
          },
          periodSeconds: 10,
          timeoutSeconds: 5,
          failureThreshold: 5,
        },
      },
    ],
    volumes: [
      {
        name: "dshm",
        emptyDir: {
          medium: "Memory",
        },
      },
    ],
    terminationGracePeriodSeconds: 0,
    automountServiceAccountToken: false,
    restartPolicy: "Never",
  }
}

function buildClanName(): string {
  const selfPodName = getSelfPodName()
  if (selfPodName !== undefined) {
    return selfPodName
  }
  const username = os.userInfo().username
  return username.toLowerCase().replace(/[^a-z0-9]/g, "")
}

export class BrowsingClient {
  readonly #minionClan: MinionClan
  readonly #minionPool: MinionPool

  private constructor(minionClan: MinionClan, minionPool: MinionPool) {
    this.#minionClan = minionClan
    this.#minionPool = minionPool
  }

  static async build(
    scope: Scope,
    kubeConfig: k8s.KubeConfig,
    kubernetesServiceLocator: KubernetesServiceLocator,
    minionHost: string
  ): Promise<BrowsingClient> {
    const minionClan = await MinionClan.build(
      scope,
      kubeConfig,
      kubernetesServiceLocator,
      getSelfPodNamespace() ?? "os2-local",
      buildClanName(),
      browsingMinionAppPorts,
      minionHost,
      ["quantum-service-mesh/rabbit-tech"]
    )
    const minionPool = new MinionPool(
      scope,
      minionClan,
      buildBrowsingMinionPodSpec(false),
      2
    )
    return new BrowsingClient(minionClan, minionPool)
  }

  async allocateBrowserPage(
    scope: Scope,
    storage: string | undefined,
    onError: (error: Error) => void,
    debugEnabled: boolean
  ): Promise<{ sessionName: string; page: Page }> {
    const sessionName = debugEnabled
      ? await (async () => {
          const sessionName = stringRandomSimpleName(8)
          await this.#minionClan.createMinion(
            scope,
            sessionName,
            buildBrowsingMinionPodSpec(debugEnabled)
          )
          return sessionName
        })()
      : await this.#minionPool.attachMinion(scope)
    log.info(`Attached to minion ${sessionName}`)
    scope.onLeave(async () => {
      await this.#minionClan.deleteMinion(scope, sessionName)
    })
    const cdpAddress = this.#minionClan.getMinionServiceInternalAddress(
      sessionName,
      chromeDevtoolsPort
    )
    log.info(`Got CDP Address`)
    const browser = await connectToChrome(scope, cdpAddress)
    log.info(`Connected to browser`)
    browser.on("disconnected", () => {
      onError(new Error("Browser disconnected"))
    })
    const context =
      arrayToVector(browser.contexts(), 1)?.[0] ??
      throwError("Browser doesn't have exactly 1 context")
    context.on("close", () => {
      onError(new Error("Browser context closed"))
    })
    const page =
      arrayToVector(context.pages(), 1)?.[0] ??
      throwError("BrowserContext doesn't have exactly 1 page")
    page.on("close", () => {
      onError(new Error("Browser page closed"))
    })
    page.on("crash", () => {
      onError(new Error("Browser page crashed"))
    })
    if (storage !== undefined) {
      const cookies = JSON.parse(storage)
      await context.addCookies(cookies)
    }
    if (!debugEnabled) {
      await context.addInitScript(() => {
        document.addEventListener("contextmenu", (event) =>
          event.preventDefault()
        )
        window.addEventListener("keydown", function (e) {
          if (e.key.startsWith("F") && e.key.length > 1) {
            e.preventDefault()
          }
        })
      })
    }
    log.info(`Finished preparing the browser`)
    return { sessionName, page }
  }

  getSessionNoVncUrl(sessionName: string): string {
    const path = this.#minionClan.getMinionServiceExternalPath(
      sessionName,
      novncPort
    )
    return `wss://${this.#minionClan.host}/${path}/websockify`
  }

  getSessionDebugNoVncUrl(sessionName: string): string {
    const path = this.#minionClan.getMinionServiceExternalPath(
      sessionName,
      novncPort
    )
    return `https://${
      this.#minionClan.host
    }/${path}/vnc_lite.html?path=${encodeURIComponent(`${path}/websockify`)}`
  }

  getServiceUrl(sessionName: string): string {
    const path = this.#minionClan.getMinionServiceExternalPath(
      sessionName,
      browsingServicePort
    )
    return `https://${this.#minionClan.host}/${path}`
  }
}
