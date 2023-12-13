import os from "node:os"

import { playwright } from "base-playwright/lib/deps.js"

import { k8s } from "base-kubernetes/lib/deps.js"

import { connectToChrome } from "base-playwright/lib/playwright.js"

import {
  Scope,
  cancelTokenToAbortSignal,
  checkAndGetCancelToken,
  sleepSeconds,
} from "base-core/lib/scope.js"
import { MinionClan } from "base-kubernetes/lib/minion/minion.js"
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
import { MinionPool } from "base-kubernetes/lib/minion/minion-pool.js"
import { stringRandomSimpleName } from "base-core/lib/string.js"

const novncPort = 6081
const bunnyHostServicePort = 8080
const chromeDevtoolsPort = 9222

const bunnyHostAppPorts: AppPort[] = [
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
    name: "http-bunny",
    protocol: "TCP",
    port: bunnyHostServicePort,
  },
]

function buildBunnyHostMinionPodSpec(
  image: string,
  debugEnabled: boolean
): k8s.V1PodSpec {
  return {
    containers: [
      {
        name: "browsing-minion",
        image,
        ports: bunnyHostAppPorts.map(buildContainerPort),
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
                  name: "CM_BUNNY_HOST_WEB_DEBUG",
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
            path: "/apis/healthz",
            port: "http-bunny",
          },
          periodSeconds: 1,
          timeoutSeconds: 1,
          failureThreshold: debugEnabled ? 3000 : 30,
        },
        livenessProbe: {
          httpGet: {
            path: "/apis/healthz",
            port: "http-bunny",
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

export class BunnyHostClient {
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
    minionHost: string,
    image: string,
    debugEnabled: boolean
  ): Promise<BunnyHostClient> {
    const minionClan = await MinionClan.build(
      scope,
      kubeConfig,
      kubernetesServiceLocator,
      getSelfPodNamespace() ?? "os2-local",
      buildClanName(),
      bunnyHostAppPorts,
      minionHost,
      ["quantum-service-mesh/rabbit-tech"]
    )
    const minionPool = new MinionPool(
      scope,
      minionClan,
      // buildBunnyHostMinionPodSpec(false),
      buildBunnyHostMinionPodSpec(image, debugEnabled),
      2
    )
    return new BunnyHostClient(minionClan, minionPool)
  }

  async allocateBrowser(
    scope: Scope
  ): Promise<{ sessionName: string; browser: playwright.Browser }> {
    const sessionName = await this.#minionPool.attachMinion(scope)
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
    return { sessionName, browser }
  }

  getNoVncUrl(sessionName: string): string {
    const path = this.#minionClan.getMinionServiceExternalPath(
      sessionName,
      novncPort
    )
    return `wss://${this.#minionClan.host}/${path}/websockify`
  }

  getDebugNoVncUrl(sessionName: string): string {
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
      bunnyHostServicePort
    )
    return `https://${this.#minionClan.host}/${path}`
  }
}
