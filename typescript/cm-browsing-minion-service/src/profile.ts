import os from "node:os"

import { Scope } from "base-core/lib/scope.js"
import { log } from "base-core/lib/logging.js"
import { throwError } from "base-core/lib/exception.js"
import { fileExists } from "base-node/lib/file.js"

import { CommandExecutor } from "./command-executor.js"

export interface BrowsingMinionProfile {
  // for ffmpeg sending RTP packets
  selfHostForRtp: string

  // for web browsers sending WebRTC packets
  selfHostForWebRtc: string

  // for launching external binaries
  commandExecutor: CommandExecutor

  // for specifying the root directory of this repository when launching external binaries
  baseRootDirectory: string
}

export async function buildBrowsingMinionProdProfile(
  scope: Scope
): Promise<BrowsingMinionProfile> {
  const selfHostForWebRtc =
    process.env["CM_BROWSING_MINION_SELF_HOST_FOR_WEBRTC"] ??
    throwError("CM_BROWSING_MINION_SELF_HOST_FOR_WEBRTC is not set")
  return {
    selfHostForRtp: "localhost",
    selfHostForWebRtc: selfHostForWebRtc,
    commandExecutor: new CommandExecutor({
      executableFile: "/bin/bash",
      prefixArgs: ["-c", '"$@"', "--"],
    }),
    baseRootDirectory: "/home/yt/repo",
  }
}

export async function buildBrowsingMinionDevProfile(
  scope: Scope
): Promise<BrowsingMinionProfile> {
  return {
    selfHostForRtp: os.hostname(),
    selfHostForWebRtc: os.hostname(),
    commandExecutor: new CommandExecutor({
      executableFile: "/bin/bash",
      prefixArgs: [
        "-c",
        'SSHPASS=ytytyt sshpass -e ssh -o StrictHostKeyChecking=no -p 4022 yt@localhost -- "$@"',
        "--",
      ],
    }),
    baseRootDirectory: "/home/yt/repo",
  }
}

export async function buildBrowsingMinionProfile(
  scope: Scope
): Promise<BrowsingMinionProfile> {
  if (process.env["KUBERNETES_SERVICE_HOST"] !== undefined) {
    log.info("Running in Kubernetes environment - use prod profile")
    return buildBrowsingMinionProdProfile(scope)
  } else if (await fileExists("/.dockerenv")) {
    log.info("Running in Docker environment - use prod profile")
    return buildBrowsingMinionProdProfile(scope)
  } else {
    log.info("Running in non-Kubernetes environment - use dev profile")
    return buildBrowsingMinionDevProfile(scope)
  }
}
