import k8s from "@kubernetes/client-node"

import { KubernetesNamespacedResource } from "./common.js"

export interface IstioVirtualServiceSpec {
  hosts?: string[]
  gateways?: string[]
  http?: {
    match?: {
      uri?: {
        prefix?: string
      }
    }[]
    rewrite?: {
      uri?: string
    }
    route?: {
      destination?: {
        host?: string
        port?: {
          number?: number
        }
      }
    }[]
  }[]
}

export interface IstioVirtualService extends k8s.KubernetesObject {
  spec?: IstioVirtualServiceSpec
  status?: {}
}

export const istioVirtualServiceResource: KubernetesNamespacedResource<IstioVirtualService> =
  {
    apiVersion: "networking.istio.io/v1beta1",
    kind: "VirtualService",
    resourceType: "virtualservices",
    typeHolder: (obj) => obj,
  }
