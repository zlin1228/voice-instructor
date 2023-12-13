import k8s from "@kubernetes/client-node"

export interface KubernetesNamespacedResourceUnypted {
  readonly apiVersion: string
  readonly kind: string
  readonly resourceType: string
}

export interface KubernetesNamespacedResource<T extends k8s.KubernetesObject>
  extends KubernetesNamespacedResourceUnypted {
  readonly typeHolder: (obj: T) => T
}

export interface NamedMetadata extends k8s.V1ObjectMeta {
  name: string
  namespace: string
}
