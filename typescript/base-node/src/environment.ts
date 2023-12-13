import { fileExists } from "./file.js"

export async function isInKubernetesEnvironment(): Promise<boolean> {
  return process.env["KUBERNETES_SERVICE_HOST"] !== undefined
}

export async function isInDockerEnvironment(): Promise<boolean> {
  return await fileExists("/.dockerenv")
}
