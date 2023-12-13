import { URLParam, buildUrlSearch } from "base-core/lib/http.js"
import { KubernetesServiceLocator } from "base-kubernetes/lib/kubernetes.js"

export async function buildIceServersJson(
  kubernetesServiceLocator: KubernetesServiceLocator,
  userName: string,
  ttl: string
): Promise<string> {
  const params: URLParam[] = [
    { name: "service", value: "turn" },
    { name: "username", value: userName },
    { name: "ttl", value: ttl },
    { name: "iceTransportPolicy", value: "relay" },
  ]
  const search = buildUrlSearch(params)

  const address = kubernetesServiceLocator(
    "stunner-system",
    "stunner-auth",
    8088
  )
  const resp = await fetch(`http://${address}/ice?${search}`)
  const json = await resp.json()
  console.log("DEBUG: Origin ICE Servers")
  console.log(JSON.stringify(json, null, 2))
  const urls = json["iceServers"][0]["urls"]
  json["iceServers"][0]["urls"] = urls.map((url: string) => {
    return "turn" + url.replace("?transport=", "")
  })
  console.log("DEBUG: Fixed ICE Servers")
  console.log(JSON.stringify(json, null, 2))
  const iceServers = (json as { iceServers: unknown })["iceServers"]
  return JSON.stringify(iceServers)
}
