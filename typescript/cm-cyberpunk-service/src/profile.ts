import k8s from "@kubernetes/client-node"

import { Scope } from "base-core/lib/scope.js"
import { log } from "base-core/lib/logging.js"
import { fileExists } from "base-node/lib/file.js"

import { AuthClient } from "./auth.js"
import { ModelClient } from "./model.js"
import {
  KubernetesServiceLocator,
  buildInClusterServiceHostname,
  buildKubeProxyServiceEndpointPath,
  getSelfPodNamespace,
} from "base-kubernetes/lib/kubernetes.js"
import { stringRemovePrefix } from "base-core/lib/string.js"
import { abortIfUndefined } from "base-core/lib/debug.js"

export interface Os2Profile {
  readonly authClient: AuthClient
  readonly modelClient: ModelClient
  readonly kubeConfig: k8s.KubeConfig
  readonly kubernetesServiceLocator: KubernetesServiceLocator
}

export async function buildOs2DevProfile(scope: Scope): Promise<Os2Profile> {
  const modelClient = await ModelClient.build(
    scope,
    "mongodb+srv://cyber:yythKoAZJcqgw8dH@cyberpunk.cj8og.mongodb.net/?retryWrites=true&w=majority",
    "prod"
  )
  const authClient = await AuthClient.build(
    modelClient
  )
  const kubeConfig = new k8s.KubeConfig()
  kubeConfig.loadFromDefault()
  const kubernetesServiceLocator: KubernetesServiceLocator = (
    namespace,
    service,
    port
  ) => {
    return `localhost:8001/${buildKubeProxyServiceEndpointPath(
      namespace,
      service,
      port
    )}`
  }
  return {
    authClient,
    modelClient,
    kubeConfig,
    kubernetesServiceLocator,
  }
}

export async function buildOs2ProdProfile(scope: Scope): Promise<Os2Profile> {
  const modelClient = await ModelClient.build(
    scope,
    "mongodb+srv://cyber:yythKoAZJcqgw8dH@cyberpunk.cj8og.mongodb.net/?retryWrites=true&w=majority",
    "prod"
  )
  const authClient = await AuthClient.build(
    modelClient
  )
  const kubeConfig = new k8s.KubeConfig()
  kubeConfig.loadFromDefault()
  const kubernetesServiceLocator: KubernetesServiceLocator = (
    namespace,
    service,
    port
  ) => {
    return `${buildInClusterServiceHostname(namespace, service)}:${port}`
  }
  const namespace = getSelfPodNamespace() ?? "os2-local"
  return {
    authClient,
    modelClient,
    kubeConfig,
    kubernetesServiceLocator,
  }
}

export async function buildOs2Profile(scope: Scope): Promise<Os2Profile> {
  if (process.env["KUBERNETES_SERVICE_HOST"] !== undefined) {
    log.info("Running in Kubernetes environment - use prod profile")
    return buildOs2ProdProfile(scope)
  } else if (await fileExists("/.dockerenv")) {
    log.info("Running in Docker environment - use prod profile")
    return buildOs2ProdProfile(scope)
  } else {
    log.info("Running in non-Kubernetes environment - use dev profile")
    return buildOs2DevProfile(scope)
  }
}
