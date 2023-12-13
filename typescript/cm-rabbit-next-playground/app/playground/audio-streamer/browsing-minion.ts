import * as mediasoupClient from "mediasoup-client"

import { log } from "base-core/lib/logging.js"
import { Scope } from "base-core/lib/scope.js"

import { CookHttpServiceClient } from "base-node/lib/service.js"

import { browsingMinionHttpServiceSchema } from "cm-browsing-minion-common/lib/schema/schema.js"
import { flyingPromise } from "base-core/lib/utils"

const rtpCapability: mediasoupClient.types.RtpCodecCapability = {
  kind: "audio",
  mimeType: "audio/opus",
  clockRate: 48000,
  channels: 2,
}

export async function startStreamingAudio(
  scope: Scope,
  serviceClient: CookHttpServiceClient<typeof browsingMinionHttpServiceSchema>,
  iceServersJson: string,
  audioElement: HTMLAudioElement
) {
  log.info("test start")
  const mediasoupDevice = new mediasoupClient.Device()

  const routerRtpCapabilitiesResponse =
    await serviceClient.post_mediasoupGetRouterRtpCapabilities.fetch(
      {},
      new AbortController().signal
    )

  await mediasoupDevice.load({
    routerRtpCapabilities: JSON.parse(
      routerRtpCapabilitiesResponse.rtpCapabilitiesJson
    ),
  })
  const createWebRtcTransportResponse =
    await serviceClient.post_mediasoupCreateWebRtcTransport.fetch(
      {},
      new AbortController().signal
    )

  const recvTransport = mediasoupDevice.createRecvTransport({
    id: createWebRtcTransportResponse.transportId,
    iceParameters: JSON.parse(createWebRtcTransportResponse.iceParametersJson),
    iceCandidates: JSON.parse(createWebRtcTransportResponse.iceCandidatesJson),
    dtlsParameters: {
      ...JSON.parse(createWebRtcTransportResponse.dtlsParametersJson),
      // Remote DTLS role. We know it's always 'auto' by default so, if
      // we want, we can force local WebRTC transport to be 'client' by
      // indicating 'server' here and vice-versa.
      role: "auto",
    },
    sctpParameters:
      createWebRtcTransportResponse.sctpParametersJson === ""
        ? undefined
        : JSON.parse(createWebRtcTransportResponse.sctpParametersJson),
    iceServers: JSON.parse(iceServersJson),
    iceTransportPolicy: "relay",
  })

  recvTransport.addListener(
    "connect",
    (
      { dtlsParameters },
      callback,
      errback // eslint-disable-line no-shadow
    ) => {
      flyingPromise(async () => {
        try {
          await serviceClient.post_mediasoupConnectWebRtcTransport.fetch(
            {
              transportId: createWebRtcTransportResponse.transportId,
              dtlsParametersJson: JSON.stringify(dtlsParameters),
            },
            new AbortController().signal
          )
          callback()
        } catch (e) {
          errback(new Error(String(e)))
        }
      })
    }
  )

  const consumeResponse = await serviceClient.post_mediasoupConsume.fetch(
    {
      transportId: createWebRtcTransportResponse.transportId,
      rtpCapabilitiesJson: JSON.stringify(mediasoupDevice.rtpCapabilities),
    },
    new AbortController().signal
  )

  const consumer = await recvTransport.consume({
    id: consumeResponse.consumerId,
    producerId: consumeResponse.producerId,
    kind: "audio",
    rtpParameters: JSON.parse(consumeResponse.rtpParametersJson),
    // streamId: "streamer",
  })

  const stream = new MediaStream()
  stream.addTrack(consumer.track)
  audioElement.srcObject = stream
}
