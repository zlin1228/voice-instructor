import k8s from "@kubernetes/client-node"

import { log } from "base-core/lib/logging.js"
import { Scope } from "base-core/lib/scope.js"
import {
  KubernetesNamespacedResource,
  KubernetesNamespacedResourceUnypted,
  NamedMetadata,
} from "./common.js"

export class KubernetesClient {
  readonly #kubeConfig: k8s.KubeConfig

  private constructor(kubeConfig: k8s.KubeConfig) {
    this.#kubeConfig = kubeConfig
  }

  static async build(scope: Scope): Promise<KubernetesClient> {
    const kubeConfig = new k8s.KubeConfig()
    kubeConfig.loadFromDefault()
    return new KubernetesClient(kubeConfig)
  }

  async createObject<T extends k8s.KubernetesObject>(
    scope: Scope,
    object: T & {
      apiVersion: string
      kind: string
      metadata: NamedMetadata
    }
  ): Promise<void> {
    log.info(`Creating ${object.kind} ${object.metadata.name}`)
    const client = k8s.KubernetesObjectApi.makeApiClient(this.#kubeConfig)
    await client.create(object)
  }

  async deleteObject(
    scope: Scope,
    namespace: string,
    name: string,
    resource: KubernetesNamespacedResourceUnypted
  ) {
    log.info(`Deleting ${resource.kind} ${name} in ${namespace}`)
    const client = k8s.KubernetesObjectApi.makeApiClient(this.#kubeConfig)
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

  async readObject<T extends k8s.KubernetesObject>(
    scope: Scope,
    namespace: string,
    name: string,
    resource: KubernetesNamespacedResource<T>
  ): Promise<
    T & {
      apiVersion: string
      kind: string
      metadata: NamedMetadata
    }
  > {
    const client = k8s.KubernetesObjectApi.makeApiClient(this.#kubeConfig)
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
    return body as T & {
      apiVersion: string
      kind: string
      metadata: NamedMetadata
    }
  }

  async updateObject<T extends k8s.KubernetesObject>(
    scope: Scope,
    object: T & {
      apiVersion: string
      kind: string
      metadata: NamedMetadata
    }
  ): Promise<void> {
    log.info(`Updating ${object.kind} ${object.metadata.name}`)
    const client = k8s.KubernetesObjectApi.makeApiClient(this.#kubeConfig)
    await client.replace(object)
  }
}
