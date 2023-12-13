import * as mediasoupClient from "mediasoup-client"

import {
  Scope,
  checkAndGetAbortSignal,
  launchBackgroundScope,
} from "base-core/lib/scope.js"
import { CookHttpServiceClient } from "base-node/lib/service.js"

import { browsingMinionHttpServiceSchema } from "cm-browsing-minion-common/lib/schema/schema.js"

export async function streamAudio(
  scope: Scope,
  cancel: (error: Error) => void,
  serviceClient: CookHttpServiceClient<typeof browsingMinionHttpServiceSchema>,
  iceServersJson: string
): Promise<MediaStream> {
  const routerRtpCapabilitiesResponse =
    await serviceClient.post_mediasoupGetRouterRtpCapabilities.fetch(
      {},
      checkAndGetAbortSignal(scope)
    )
  const mediasoupDevice = new mediasoupClient.Device()
  await mediasoupDevice.load({
    routerRtpCapabilities: JSON.parse(
      routerRtpCapabilitiesResponse.rtpCapabilitiesJson
    ),
  })
  const createWebRtcTransportResponse =
    await serviceClient.post_mediasoupCreateWebRtcTransport.fetch(
      {},
      checkAndGetAbortSignal(scope)
    )
  const recvTransport = mediasoupDevice.createRecvTransport({
    id: createWebRtcTransportResponse.transportId,
    iceParameters: JSON.parse(createWebRtcTransportResponse.iceParametersJson),
    iceCandidates: JSON.parse(createWebRtcTransportResponse.iceCandidatesJson),
    dtlsParameters: {
      ...JSON.parse(createWebRtcTransportResponse.dtlsParametersJson),
      role: "auto",
    },
    sctpParameters:
      createWebRtcTransportResponse.sctpParametersJson === ""
        ? undefined
        : JSON.parse(createWebRtcTransportResponse.sctpParametersJson),
    iceServers: JSON.parse(iceServersJson),
    iceTransportPolicy: "relay",
  })
  scope.onLeave(async () => {
    recvTransport.close()
  })

  recvTransport.addListener(
    "connect",
    ({ dtlsParameters }, callback, errback) => {
      launchBackgroundScope(scope, async () => {
        try {
          await serviceClient.post_mediasoupConnectWebRtcTransport.fetch(
            {
              transportId: createWebRtcTransportResponse.transportId,
              dtlsParametersJson: JSON.stringify(dtlsParameters),
            },
            checkAndGetAbortSignal(scope)
          )
          callback()
        } catch (e) {
          errback(new Error(String(e)))
        }
      })
    }
  )
  recvTransport.addListener("connectionstatechange", (state) => {
    if (state === "closed") {
      cancel(new Error("Connection to mediasoup closed"))
    } else if (state === "failed") {
      cancel(new Error("Connection to mediasoup failed"))
    } else if (state === "disconnected") {
      cancel(new Error("Disconnected from mediasoup"))
    }
  })
  const consumeResponse = await serviceClient.post_mediasoupConsume.fetch(
    {
      transportId: createWebRtcTransportResponse.transportId,
      rtpCapabilitiesJson: JSON.stringify(mediasoupDevice.rtpCapabilities),
    },
    checkAndGetAbortSignal(scope)
  )
  const consumer = await recvTransport.consume({
    id: consumeResponse.consumerId,
    producerId: consumeResponse.producerId,
    kind: "audio",
    rtpParameters: JSON.parse(consumeResponse.rtpParametersJson),
  })
  const stream = new MediaStream()
  stream.addTrack(consumer.track)
  scope.onLeave(async () => {
    stream.removeTrack(consumer.track)
  })
  return stream
}
