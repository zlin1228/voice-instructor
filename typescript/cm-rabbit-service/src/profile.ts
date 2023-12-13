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
import { SpotifyClient } from "./rabbits/spotify/spotify-client.js"
import { BrowsingClient } from "./browsing/browsing-client.js"
import { stringRemovePrefix } from "base-core/lib/string.js"
import { abortIfUndefined } from "base-core/lib/debug.js"

export interface Os2Profile {
  readonly webApp:
    | {
        // The upstream service handling the web app requests
        readonly upstreamUrl: string
        // The base path of the upstream service. It should start with a slash.
        readonly basePath: string
      }
    | undefined
  readonly authClient: AuthClient
  readonly modelClient: ModelClient
  readonly kubeConfig: k8s.KubeConfig
  readonly spotifyClient: SpotifyClient
  readonly kubernetesServiceLocator: KubernetesServiceLocator
}

export async function buildOs2DevProfile(scope: Scope): Promise<Os2Profile> {
  const authClient = await AuthClient.build(
    "https://grateful-manatee-89.clerk.accounts.dev/.well-known/jwks.json"
  )
  const modelClient = await ModelClient.build(
    scope,
    "mongodb+srv://info:eLVGtLSn2qmKZAgp@rabbit-os.fu6px.mongodb.net/?retryWrites=true&w=majority",
    "rabbit-local"
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
  const browsingClient = await BrowsingClient.build(
    scope,
    kubeConfig,
    kubernetesServiceLocator,
    "local.rabbit.tech"
  )
  const spotifyClient = new SpotifyClient(
    kubernetesServiceLocator,
    browsingClient
  )
  return {
    webApp: {
      upstreamUrl: "http://localhost:3000",
      basePath: "/webapp",
    },
    authClient,
    modelClient,
    kubeConfig,
    spotifyClient,
    kubernetesServiceLocator,
  }
}

export async function buildOs2ProdProfile(scope: Scope): Promise<Os2Profile> {
  const authClient = await AuthClient.build(
    "https://clerk.rabbit.tech/.well-known/jwks.json"
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

  const modelClient = await ModelClient.build(
    scope,
    "mongodb+srv://info:eLVGtLSn2qmKZAgp@rabbit-os.fu6px.mongodb.net/?retryWrites=true&w=majority",
    `rabbit-deploy-${abortIfUndefined(stringRemovePrefix(namespace, "os2-"))}`
  )

  const browsingClient = await BrowsingClient.build(
    scope,
    kubeConfig,
    kubernetesServiceLocator,
    namespace === "os2-prod"
      ? "demo.rabbit.tech"
      : `${abortIfUndefined(stringRemovePrefix(namespace, "os2-"))}.rabbit.tech`
  )
  const spotifyClient = new SpotifyClient(
    kubernetesServiceLocator,
    browsingClient
  )
  return {
    webApp: {
      upstreamUrl: "http://os2-next",
      basePath: "/webapp",
    },
    authClient,
    modelClient,
    kubeConfig,
    spotifyClient,
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
