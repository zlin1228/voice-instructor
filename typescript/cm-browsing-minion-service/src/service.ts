import { chromium } from "playwright"

import { Scope } from "base-core/lib/scope.js"

import { BrowsingMinionHttpService } from "cm-browsing-minion-common/lib/schema/schema.js"

import { Room } from "./room.js"
import { BrowsingMinionProfile } from "./profile.js"
import { log } from "base-core/lib/logging.js"

export interface BrowsingMinionConfig {
  profile: BrowsingMinionProfile
}

export async function buildBrowsingMinionService(
  scope: Scope,
  config: BrowsingMinionConfig
): Promise<BrowsingMinionHttpService> {
  const room = await Room.build(scope, config.profile.selfHostForWebRtc)
  const producerPorts = room.getProducerPorts()
  const out = await config.profile.commandExecutor.run(scope, [
    `${config.profile.baseRootDirectory}/layers/cm-browsing-minion/scripts/browsing.sh`,
    config.profile.selfHostForRtp,
    producerPorts.rtpPort.toString(),
    producerPorts.rtcpPort.toString(),
  ])
  console.log(out)
  let ready = false
  // console.log(producerPorts)
  return {
    get_healthz: async (scope, request) => {
      if (!ready) {
        const browser = await chromium.connectOverCDP("http://localhost:9222", {
          timeout: 1000,
        })
        await browser.close()
        ready = true
      } else {
        try {
          const browser = await chromium.connectOverCDP(
            "http://localhost:9222",
            {
              timeout: 10000,
            }
          )
          await browser.close()
        } catch (e) {
          log.info("Failed to connect to chromium after it is ready")
          console.log(e)
          throw e
        }
      }
      return {}
    },
    post_mediasoupGetRouterRtpCapabilities: async (scope, request) => {
      return await room.getRouterRtpCapabilities()
    },
    post_mediasoupCreateWebRtcTransport: async (scope, request) => {
      return await room.createWebRtcTransport()
    },
    post_mediasoupConsume: async (scope, request) => {
      return await room.consume(request)
    },
    post_mediasoupConnectWebRtcTransport: async (scope, request) => {
      await room.connectWebRtcTransport(request)
      return {}
    },
  }
}
