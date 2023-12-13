import k8s from "@kubernetes/client-node"

import { KubernetesNamespacedResource } from "./common.js"

export const podResource: KubernetesNamespacedResource<k8s.V1Pod> = {
  apiVersion: "v1",
  kind: "Pod",
  resourceType: "pods",
  typeHolder: (obj) => obj,
}

export const serviceResource: KubernetesNamespacedResource<k8s.V1Service> = {
  apiVersion: "v1",
  kind: "Service",
  resourceType: "services",
  typeHolder: (obj) => obj,
}

export const configMapResource: KubernetesNamespacedResource<k8s.V1ConfigMap> =
  {
    apiVersion: "v1",
    kind: "ConfigMap",
    resourceType: "configmaps",
    typeHolder: (obj) => obj,
  }
