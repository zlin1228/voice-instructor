import k8s from "@kubernetes/client-node"

import { Scope, SignalController, sleepSeconds } from "base-core/lib/scope.js"
import {
  AppPort,
  KubernetesServiceLocator,
  buildSelfPodOnwerReference,
  createObject,
  createPod,
  createService,
  deleteObject,
  listObjects,
  watchObjects,
} from "base-kubernetes/lib/kubernetes.js"
import {
  IstioVirtualService,
  istioVirtualServiceResource,
} from "base-kubernetes/lib/istio.js"
import { podResource, serviceResource } from "base-kubernetes/lib/core.js"
import { log } from "base-core/lib/logging.js"
import { abortIfUndefined } from "base-core/lib/debug.js"
import { makeOptionalField } from "base-core/lib/optional.js"

interface MinionState {
  pod: k8s.V1Pod | undefined
  service: k8s.V1Service | undefined
  virtualService: IstioVirtualService | undefined
  readySignal: SignalController<void>
}

const objectAppLabel = "app.kubernetes.io/name"
const objectAppLabelValue = "yt-minion"
const objectClanLabel = "yt/clan"
const objectMinionLabel = "yt/minion"

// SECURITY NOTES:
//   - It's better to set `automountServiceAccountToken: false` on Pods.

export class MinionClan {
  readonly #kubeConfig: k8s.KubeConfig
  readonly #kubernetesServiceLocator: KubernetesServiceLocator
  readonly #namespace: string
  readonly #clanName: string
  readonly #minionStates = new Map<string, MinionState>()
  readonly #appPorts: AppPort[]
  readonly host: string
  readonly #gateways: string[]

  private constructor(
    kubeConfig: k8s.KubeConfig,
    kubernetesServiceLocator: KubernetesServiceLocator,
    namespace: string,
    clanName: string,
    appPorts: AppPort[],
    host: string,
    gateways: string[]
  ) {
    this.#kubeConfig = kubeConfig
    this.#kubernetesServiceLocator = kubernetesServiceLocator
    this.#namespace = namespace
    this.#clanName = clanName
    this.#appPorts = appPorts
    this.host = host
    this.#gateways = gateways
  }

  #clanLabelSelector(): string {
    return `${objectClanLabel}=${this.#clanName}`
  }

  #getMinionNameFromObject(object: k8s.KubernetesObject): string | undefined {
    const clan = object.metadata?.labels?.[objectClanLabel]
    if (clan !== this.#clanName) return undefined
    return object.metadata?.labels?.[objectMinionLabel]
  }

  #buildObjectName(minionName: string): string {
    return `minion-${this.#clanName}-${minionName}`
  }

  #buildMinionLabelsMap(minionName: string): Record<string, string> {
    return {
      [objectAppLabel]: objectAppLabelValue,
      [objectClanLabel]: this.#clanName,
      [objectMinionLabel]: minionName,
    }
  }

  #listPods(scope: Scope): Promise<{
    resourceVersion: string
    objects: k8s.V1Pod[]
  }> {
    return listObjects(
      scope,
      this.#kubeConfig,
      this.#namespace,
      podResource,
      this.#clanLabelSelector()
    )
  }

  async #startWatchingPods(
    scope: Scope,
    resourceVersion: string
  ): Promise<void> {
    await watchObjects(
      scope,
      this.#kubeConfig,
      this.#namespace,
      podResource,
      this.#clanLabelSelector(),
      resourceVersion,
      (type, object) => {
        const minionName = this.#getMinionNameFromObject(object)
        if (minionName === undefined) {
          log.info(
            `Ignoring Pod without correct minion label [${
              object.metadata?.name ?? "(unknown)"
            }]`
          )
          return
        }
        const state = this.#minionStates.get(minionName)
        if (state === undefined) {
          log.info(`Ignoring Pod for unknown minion [${minionName}]`)
          return
        }
        log.info(`Pod [${minionName}] is ${type}`)
        if (state.readySignal.get().kind === "pending") {
          if (
            object.status?.phase === "Running" &&
            object.status?.containerStatuses?.every((s) => s.ready === true)
          ) {
            state.readySignal.emit()
          }
        }
        switch (type) {
          case "UPDATED":
            this.#minionStates.set(minionName, {
              ...state,
              pod: object,
            })
            break
          case "DELETED":
            this.#minionStates.set(minionName, {
              ...state,
              pod: undefined,
            })
            // Do more cleanup here
            break
        }
      }
    )
  }

  async #listServices(scope: Scope): Promise<{
    resourceVersion: string
    objects: k8s.V1Service[]
  }> {
    return await listObjects(
      scope,
      this.#kubeConfig,
      this.#namespace,
      serviceResource,
      this.#clanLabelSelector()
    )
  }

  async #startWatchingServices(
    scope: Scope,
    resourceVersion: string
  ): Promise<void> {
    await watchObjects(
      scope,
      this.#kubeConfig,
      this.#namespace,
      serviceResource,
      this.#clanLabelSelector(),
      resourceVersion,
      (type, object) => {
        const minionName = this.#getMinionNameFromObject(object)
        if (minionName === undefined) {
          log.info(
            `Ignoring Service without correct minion label [${
              object.metadata?.name ?? "(unknown)"
            }]`
          )
          return
        }
        const state = this.#minionStates.get(minionName)
        if (state === undefined) {
          log.info(`Ignoring Service for unknown minion [${minionName}]`)
          return
        }
        switch (type) {
          case "UPDATED":
            this.#minionStates.set(minionName, {
              ...state,
              service: object,
            })
            break
          case "DELETED":
            this.#minionStates.set(minionName, {
              ...state,
              service: undefined,
            })
            // Do more cleanup here
            break
        }
      }
    )
  }

  async #listVirtualServices(scope: Scope): Promise<{
    resourceVersion: string
    objects: IstioVirtualService[]
  }> {
    return await listObjects(
      scope,
      this.#kubeConfig,
      this.#namespace,
      istioVirtualServiceResource,
      this.#clanLabelSelector()
    )
  }

  async #startWatchingVirtualServices(
    scope: Scope,
    resourceVersion: string
  ): Promise<void> {
    await watchObjects(
      scope,
      this.#kubeConfig,
      this.#namespace,
      istioVirtualServiceResource,
      this.#clanLabelSelector(),
      resourceVersion,
      (type, object) => {
        const minionName = this.#getMinionNameFromObject(object)
        if (minionName === undefined) {
          log.info(
            `Ignoring VirtualService without correct minion label [${
              object.metadata?.name ?? "(unknown)"
            }]`
          )
          return
        }
        const state = this.#minionStates.get(minionName)
        if (state === undefined) {
          log.info(`Ignoring VirtualService for unknown minion [${minionName}]`)
          return
        }
        switch (type) {
          case "UPDATED":
            this.#minionStates.set(minionName, {
              ...state,
              virtualService: object,
            })
            break
          case "DELETED":
            this.#minionStates.set(minionName, {
              ...state,
              virtualService: undefined,
            })
            // Do more cleanup here
            break
        }
      }
    )
  }

  static async build(
    scope: Scope,
    kubeConfig: k8s.KubeConfig,
    kubernetesServiceLocator: KubernetesServiceLocator,
    namespace: string,
    clanName: string,
    appPorts: AppPort[],
    host: string,
    gateways: string[]
  ): Promise<MinionClan> {
    const minionClan = new MinionClan(
      kubeConfig,
      kubernetesServiceLocator,
      namespace,
      clanName,
      appPorts,
      host,
      gateways
    )
    {
      const { resourceVersion, objects } = await minionClan.#listPods(scope)
      for (const object of objects) {
        await deleteObject(
          scope,
          kubeConfig,
          namespace,
          abortIfUndefined(object.metadata?.name),
          podResource
        )
      }
      await minionClan.#startWatchingPods(scope, resourceVersion)
    }
    {
      const { resourceVersion, objects } = await minionClan.#listServices(scope)
      for (const object of objects) {
        await deleteObject(
          scope,
          kubeConfig,
          namespace,
          abortIfUndefined(object.metadata?.name),
          serviceResource
        )
      }
      await minionClan.#startWatchingServices(scope, resourceVersion)
    }
    {
      const { resourceVersion, objects } =
        await minionClan.#listVirtualServices(scope)
      for (const object of objects) {
        await deleteObject(
          scope,
          kubeConfig,
          namespace,
          abortIfUndefined(object.metadata?.name),
          istioVirtualServiceResource
        )
      }
      await minionClan.#startWatchingVirtualServices(scope, resourceVersion)
    }
    return minionClan
  }

  getMinionServiceInternalAddress(name: string, port: number): string {
    return this.#kubernetesServiceLocator(
      this.#namespace,
      this.#buildObjectName(name),
      port
    )
  }

  getMinionServiceExternalPath(name: string, port: number): string {
    return `minions/minion-${this.#clanName}-${encodeURIComponent(
      name
    )}/${port}`
  }

  async createMinion(
    scope: Scope,
    name: string,
    podSpec: k8s.V1PodSpec
  ): Promise<void> {
    log.info(`Creating minion [${name}]`)
    if (this.#minionStates.has(name)) {
      throw new Error(`Minion [${name}] already exists`)
    }
    const readySignal = new SignalController<void>()
    this.#minionStates.set(name, {
      pod: undefined,
      service: undefined,
      virtualService: undefined,
      readySignal,
    })
    const labelsMap = this.#buildMinionLabelsMap(name)
    const ownerReference = buildSelfPodOnwerReference()
    const ownerReferences =
      ownerReference === undefined ? undefined : [ownerReference]
    await createPod(
      scope,
      this.#kubeConfig,
      {
        namespace: this.#namespace,
        name: this.#buildObjectName(name),
        labels: labelsMap,
        ...makeOptionalField("ownerReferences", ownerReferences),
      },
      podSpec
    )
    await createService(
      scope,
      this.#kubeConfig,
      {
        namespace: this.#namespace,
        name: this.#buildObjectName(name),
        labels: labelsMap,
        ...makeOptionalField("ownerReferences", ownerReferences),
      },
      this.#appPorts,
      labelsMap
    )
    await createObject(scope, this.#kubeConfig, {
      apiVersion: istioVirtualServiceResource.apiVersion,
      kind: istioVirtualServiceResource.kind,
      metadata: {
        namespace: this.#namespace,
        name: this.#buildObjectName(name),
        labels: labelsMap,
        ...makeOptionalField("ownerReferences", ownerReferences),
      },
      spec: {
        hosts: [this.host],
        gateways: this.#gateways,
        http: this.#appPorts
          .filter((appPort) => appPort.name.startsWith("http"))
          .map((appPort) => ({
            match: [
              {
                uri: {
                  prefix: `/minions/${encodeURIComponent(
                    this.#buildObjectName(name)
                  )}/${appPort.port}/`,
                },
              },
            ],
            rewrite: {
              uri: "/",
            },
            route: [
              {
                destination: {
                  host: `${this.#buildObjectName(name)}.${
                    this.#namespace
                  }.svc.cluster.local`,
                  port: {
                    number: appPort.port,
                  },
                },
              },
            ],
          })),
      },
    })
    log.info(`Waiting for minion [${name}] to become ready`)
    await readySignal.waitUntilReady(scope)
    // Wait until Istio is ready
    await sleepSeconds(scope, 1)
    log.info(`Minion [${name}] is ready`)
  }

  async deleteMinion(scope: Scope, name: string): Promise<void> {
    log.info(`Deleting minion [${name}]`)
    const minionState = this.#minionStates.get(name)
    if (minionState === undefined) {
      throw new Error(`Minion [${name}] does not exist`)
    }
    this.#minionStates.delete(name)
    const objectName = this.#buildObjectName(name)
    try {
      await deleteObject(
        scope,
        this.#kubeConfig,
        this.#namespace,
        objectName,
        podResource
      )
    } catch (e) {
      log.info(`Failed to delete the Pod of minion [${name}]: ${String(e)}`)
    }
    try {
      await deleteObject(
        scope,
        this.#kubeConfig,
        this.#namespace,
        objectName,
        serviceResource
      )
    } catch (e) {
      log.info(`Failed to delete the Service of minion [${name}]: ${String(e)}`)
    }
    try {
      await deleteObject(
        scope,
        this.#kubeConfig,
        this.#namespace,
        objectName,
        istioVirtualServiceResource
      )
    } catch (e) {
      log.info(
        `Failed to delete the VirtualService of minion [${name}]: ${String(e)}`
      )
    }
  }
}
