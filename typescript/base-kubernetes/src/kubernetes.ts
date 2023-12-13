import k8s from "@kubernetes/client-node"

import { throwError } from "base-core/lib/exception.js"
import { log } from "base-core/lib/logging.js"
import { catchErrorSync } from "base-core/lib/one-of.js"
import {
  Scope,
  buildAttachmentForCancellation,
  checkAndGetCancelToken,
  launchBackgroundScope,
  sleepSeconds,
  sleepUntilCancel,
} from "base-core/lib/scope.js"
import { buildPromise } from "base-core/lib/utils.js"
import {
  KubernetesNamespacedResource,
  KubernetesNamespacedResourceUnypted,
  NamedMetadata,
} from "./common.js"
import { podResource } from "./core.js"

export async function listObjects<T extends k8s.KubernetesObject>(
  scope: Scope,
  kubeConfig: k8s.KubeConfig,
  namespace: string,
  resource: KubernetesNamespacedResource<T>,
  labelSelector: string
): Promise<{
  resourceVersion: string
  objects: T[]
}> {
  const client = k8s.KubernetesObjectApi.makeApiClient(kubeConfig)
  const { body } = await client.list(
    resource.apiVersion,
    resource.kind,
    namespace,
    undefined,
    undefined,
    undefined,
    undefined,
    labelSelector
  )
  return {
    resourceVersion:
      body.metadata?.resourceVersion ?? throwError("No resourceVersion"),
    objects: body.items as T[],
  }
}

export async function watchObjects<T extends k8s.KubernetesObject>(
  scope: Scope,
  kubeConfig: k8s.KubeConfig,
  namespace: string,
  resource: KubernetesNamespacedResource<T>,
  labelSelector: string,
  resourceVersion: string,
  onChange: (type: "UPDATED" | "DELETED", obj: T) => void
): Promise<void> {
  // Reference: https://kubernetes.io/docs/reference/using-api/api-concepts/#efficient-detection-of-changes
  log.info(`Watching ${resource.kind} in ${namespace}`)
  const watch = new k8s.Watch(kubeConfig)
  const url = `/${
    resource.apiVersion.includes("/") ? "apis" : "api"
  }/${encodeURIComponent(resource.apiVersion)}/namespaces/${encodeURIComponent(
    namespace
  )}/${encodeURIComponent(resource.resourceType)}`
  launchBackgroundScope(scope, async (scope) => {
    const cancelTokenOrError = catchErrorSync(Error, () =>
      checkAndGetCancelToken(scope)
    )
    if (cancelTokenOrError.kind === "error") {
      return
    }
    let gotUpdatedResourceVersion = true
    while (cancelTokenOrError.value.cancelReason === undefined) {
      const { cancel, attachment } = buildAttachmentForCancellation(true)
      await Scope.with(scope, [attachment], async (scope) => {
        const { promise, resolve } = buildPromise()
        log.info(
          `Starting watch for ${resource.kind} in ${namespace} at resource version [${resourceVersion}]`
        )
        if (!gotUpdatedResourceVersion) {
          log.info(
            "Got no updated resource version during watch. Reset resource version and sleep for 1 second before retrying"
          )
          await sleepSeconds(scope, 1)
          resourceVersion = ""
        }
        gotUpdatedResourceVersion = false
        const watchCtrl: unknown = await watch.watch(
          url,
          {
            resourceVersion,
            labelSelector,
            allowWatchBookmarks: true,
          },
          (phase, apiObj: unknown, watchObj: unknown) => {
            const updatedResourceVersion = (apiObj as k8s.KubernetesObject)
              .metadata?.resourceVersion
            if (updatedResourceVersion !== undefined) {
              resourceVersion = updatedResourceVersion
              gotUpdatedResourceVersion = true
            }
            if (
              phase === "ADDED" ||
              phase === "MODIFIED" ||
              phase === "DELETED"
            ) {
              onChange(phase === "DELETED" ? "DELETED" : "UPDATED", apiObj as T)
              return
            } else if (phase === "BOOKMARK") {
              return
            } else {
              log.info("Unknown phase: " + phase)
              console.log(watchObj)
              cancel(new Error(`Encountered unknown phase: ${phase}`))
              return
            }
          },
          (err: unknown) => {
            if (err === undefined || err === null) {
              cancel(new Error("Watch aborted"))
              resolve()
              return
            }
            log.info(`Error from watch: ${String(err)}`)
            console.log(err)
            cancel(new Error("Watch aborted"))
            resolve()
          }
        )
        scope.onLeave(async () => {
          ;(watchCtrl as { abort(): void }).abort()
          await promise
        })
        await sleepUntilCancel(scope)
      })
    }
  })
}

export interface AppPort {
  readonly name: string
  readonly protocol: "TCP" | "UDP"
  readonly port: number
}

export function buildContainerPort(appPort: AppPort): k8s.V1ContainerPort {
  return {
    name: appPort.name,
    protocol: appPort.protocol,
    containerPort: appPort.port,
  }
}

export function buildServicePort(appPort: AppPort): k8s.V1ServicePort {
  return {
    name: appPort.name,
    protocol: appPort.protocol,
    targetPort: appPort.port,
    port: appPort.port,
  }
}

export async function createPod(
  scope: Scope,
  kubeConfig: k8s.KubeConfig,
  metadata: NamedMetadata,
  spec: k8s.V1PodSpec
): Promise<void> {
  log.info(`Creating pod ${metadata.name} in ${metadata.namespace}`)
  const k8sCoreApi = kubeConfig.makeApiClient(k8s.CoreV1Api)
  await k8sCoreApi.createNamespacedPod(metadata.namespace, {
    apiVersion: "v1",
    kind: "Pod",
    metadata,
    spec,
  })
}

export async function createService(
  scope: Scope,
  kubeConfig: k8s.KubeConfig,
  metadata: NamedMetadata,
  appPorts: AppPort[],
  selector: Record<string, string>
): Promise<void> {
  log.info(`Creating service ${metadata.name} in ${metadata.namespace}`)
  const k8sCoreApi = kubeConfig.makeApiClient(k8s.CoreV1Api)
  await k8sCoreApi.createNamespacedService(metadata.namespace, {
    apiVersion: "v1",
    kind: "Service",
    metadata,
    spec: {
      ports: appPorts.map(buildServicePort),
      selector,
    },
  })
}

export async function createObject<T extends k8s.KubernetesObject>(
  scope: Scope,
  kubeConfig: k8s.KubeConfig,
  object: T & {
    apiVersion: string
    kind: string
    metadata: NamedMetadata
  }
): Promise<void> {
  log.info(`Creating ${object.kind} ${object.metadata.name}`)
  const client = k8s.KubernetesObjectApi.makeApiClient(kubeConfig)
  await client.create(object)
}

export async function deleteObject(
  scope: Scope,
  kubeConfig: k8s.KubeConfig,
  namespace: string,
  name: string,
  resource: KubernetesNamespacedResourceUnypted
) {
  log.info(`Deleting ${resource.kind} ${name} in ${namespace}`)
  const client = k8s.KubernetesObjectApi.makeApiClient(kubeConfig)
  await client.delete(
    {
      apiVersion: resource.apiVersion,
      kind: resource.kind,
      metadata: {
        name,
        namespace,
      },
    },
    undefined,
    undefined,
    0
  )
}

export async function fetchObject<T extends k8s.KubernetesObject>(
  scope: Scope,
  kubeConfig: k8s.KubeConfig,
  namespace: string,
  name: string,
  resource: KubernetesNamespacedResource<T>
): Promise<T> {
  log.info(`Fetching ${resource.kind} ${name} in ${namespace}`)
  const client = k8s.KubernetesObjectApi.makeApiClient(kubeConfig)
  const { body } = await client.read<T>(
    {
      apiVersion: resource.apiVersion,
      kind: resource.kind,
      metadata: {
        name,
        namespace,
      },
    },
    undefined,
    undefined
  )
  return body
}

export function buildKubeProxyServiceEndpointPath(
  namespace: string,
  service: string,
  port: number
): string {
  return `api/v1/namespaces/${encodeURIComponent(
    namespace
  )}/services/${encodeURIComponent(service)}:${port}/proxy`
}

export function buildInClusterServiceHostname(
  namespace: string,
  service: string
): string {
  return `${service}.${namespace}.svc.cluster.local`
}

export type KubernetesServiceLocator = (
  namespace: string,
  service: string,
  port: number
) => string

export function getSelfPodName(): string | undefined {
  return process.env["KUBERNETES_POD_NAME"]
}

export function getSelfPodNamespace(): string | undefined {
  return process.env["KUBERNETES_POD_NAMESPACE"]
}

export function getSelfPodIp(): string | undefined {
  return process.env["KUBERNETES_POD_IP"]
}

export function getSelfPodUid(): string | undefined {
  return process.env["KUBERNETES_POD_UID"]
}

export function buildSelfPodOnwerReference(): k8s.V1OwnerReference | undefined {
  const name = getSelfPodName()
  const uid = getSelfPodUid()
  if (name === undefined || uid === undefined) {
    return undefined
  }
  return {
    apiVersion: podResource.apiVersion,
    kind: podResource.kind,
    name,
    uid,
  }
}
