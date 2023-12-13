import { Scope } from "base-core/lib/scope.js"
import {
  OrganizationKeyMap,
  PresetBunnyBuilderService,
  buildPresetBunnyBuilderService,
} from "./service.js"
import {
  isInDockerEnvironment,
  isInKubernetesEnvironment,
} from "base-node/lib/environment.js"
import { BunnyHostClient } from "./bunny-host-client.js"
import {
  KubernetesServiceLocator,
  buildInClusterServiceHostname,
  buildKubeProxyServiceEndpointPath,
  getSelfPodNamespace,
} from "base-kubernetes/lib/kubernetes.js"
import { k8s } from "base-kubernetes/lib/deps.js"
import { ModelClient } from "./model.js"
import { stringRemovePrefix } from "base-core/lib/string.js"
import { abortIfUndefined } from "base-core/lib/debug.js"

// Command to generate a key:
// python3 -c "import random, string; print(''.join(random.SystemRandom().choice(string.ascii_lowercase + string.digits) for _ in range(20)))"
const organizationKeyMap: OrganizationKeyMap = new Map([
  ["10n3ts24gorod5gl24j3", "rabbit"],
  ["lgh7jus8j8qvltrib0bs", "Toloka"],
  ["rp435sv20ymfihofd14m", "M47"],
  ["pmyr3wghde29w33u0pl0", "CloudFactory"],
  ["rwlp2s8p1dyqxdkcm3jd", "Quest"],
])

export interface Profile {
  readonly webappUrl: string
  readonly service: PresetBunnyBuilderService
}

export async function buildModelClient(scope: Scope): Promise<ModelClient> {
  // Link to MongoDB Atlas:
  // https://cloud.mongodb.com/v2/642779155670c554450649c6#/metrics/replicaSet/65190e371332bd51be9123fd/explorer/preset-rabbit
  const namespace = getSelfPodNamespace() ?? "cm-pbb-231024"
  const hostname = abortIfUndefined(stringRemovePrefix(namespace, "cm-"))
  return await ModelClient.build(
    scope,
    "mongodb+srv://info:eLVGtLSn2qmKZAgp@rabbit-os.fu6px.mongodb.net/?retryWrites=true&w=majority",
    hostname
  )
}

async function createBunnyHostClient(
  scope: Scope,
  inKubernetes: boolean
): Promise<BunnyHostClient> {
  const kubeConfig = new k8s.KubeConfig()
  kubeConfig.loadFromDefault()
  const kubernetesServiceLocator: KubernetesServiceLocator = (
    namespace,
    service,
    port
  ) => {
    if (inKubernetes) {
      return `${buildInClusterServiceHostname(namespace, service)}:${port}`
    }
    return `localhost:8001/${buildKubeProxyServiceEndpointPath(
      namespace,
      service,
      port
    )}`
  }
  const namespace = getSelfPodNamespace() ?? "cm-pbb-dev"
  const hostname = abortIfUndefined(stringRemovePrefix(namespace, "cm-"))
  return await BunnyHostClient.build(
    scope,
    kubeConfig,
    kubernetesServiceLocator,
    inKubernetes ? `${hostname}.rabbit.tech` : "local.rabbit.tech",
    "us-docker.pkg.dev/cmc-ai/quantum/cm-bunny-host-web-service:yt-231023-232809",
    !inKubernetes
  )
}

export async function buildDefaultProfile(scope: Scope): Promise<Profile> {
  const inDocker = await isInDockerEnvironment()
  const inKubernetes = await isInKubernetesEnvironment()
  const modelClient = await buildModelClient(scope)
  const bunnyHostClient = await createBunnyHostClient(scope, inKubernetes)
  const service = await buildPresetBunnyBuilderService(
    scope,
    modelClient,
    bunnyHostClient,
    organizationKeyMap
  )
  return {
    webappUrl: "http://localhost:3000",
    service,
  }
}
