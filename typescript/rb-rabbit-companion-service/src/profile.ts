import { Scope } from "base-core/lib/scope.js"
import {
  RabbitCompanionService,
  buildRabbitCompanionService,
} from "./service.js"
import {
  isInDockerEnvironment,
  isInKubernetesEnvironment,
} from "base-node/lib/environment.js"
import {
  KubernetesServiceLocator,
  buildInClusterServiceHostname,
  buildKubeProxyServiceEndpointPath,
  getSelfPodNamespace,
} from "base-kubernetes/lib/kubernetes.js"
import { k8s } from "base-kubernetes/lib/deps.js"
import { stringRemovePrefix } from "base-core/lib/string.js"
import { abortIfUndefined } from "base-core/lib/debug.js"

export interface Profile {
  readonly webappUrl: string
  readonly service: RabbitCompanionService
}

export async function buildDefaultProfile(scope: Scope): Promise<Profile> {
  const inDocker = await isInDockerEnvironment()
  const inKubernetes = await isInKubernetesEnvironment()
  const service = await buildRabbitCompanionService(scope)
  return {
    webappUrl: "http://localhost:3000",
    service,
  }
}
