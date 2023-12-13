import * as mediasoupClient from "mediasoup-client"

import { log } from "base-core/lib/logging.js"
import { Scope } from "base-core/lib/scope.js"

import {
  buildHttpServiceClient,
  defaultBuildHttpServiceClientOptions,
} from "base-node/lib/service.js"

import { streamerHttpServiceSchema } from "cm-streamer-common/lib/schema/schema.js"
import { flyingPromise } from "base-core/lib/utils"

export const serviceClient = buildHttpServiceClient(
  streamerHttpServiceSchema,
  defaultBuildHttpServiceClientOptions("http://192.168.1.13:8080")
)

const rtpCapability: mediasoupClient.types.RtpCodecCapability = {
  kind: "audio",
  mimeType: "audio/opus",
  clockRate: 48000,
  channels: 2,
}

export async function testStreamer(scope: Scope) {
  log.info("test start")
  const mediasoupDevice = new mediasoupClient.Device()

  const routerRtpCapabilitiesResponse =
    await serviceClient.post_getRouterRtpCapabilities.fetch(
      {},
      new AbortController().signal
    )

  await mediasoupDevice.load({
    routerRtpCapabilities: JSON.parse(
      routerRtpCapabilitiesResponse.rtpCapabilitiesJson
    ),
  })
  const createWebRtcTransportResponse =
    await serviceClient.post_createWebRtcTransport.fetch(
      {},
      new AbortController().signal
    )

  console.log(createWebRtcTransportResponse)

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
    iceServers: [],
  })

  console.log(recvTransport)

  recvTransport.addListener(
    "connect",
    (
      { dtlsParameters },
      callback,
      errback // eslint-disable-line no-shadow
    ) => {
      console.log("recvTransport connect")
      flyingPromise(async () => {
        try {
          await serviceClient.post_connectWebRtcTransport.fetch(
            {
              transportId: createWebRtcTransportResponse.transportId,
              dtlsParametersJson: JSON.stringify(dtlsParameters),
            },
            new AbortController().signal
          )
          console.log("sent connect")
          callback()
        } catch (e) {
          errback(new Error(String(e)))
        }
      })
    }
  )

  console.log(mediasoupDevice.rtpCapabilities)

  const consumeResponse = await serviceClient.post_consume.fetch(
    {
      transportId: createWebRtcTransportResponse.transportId,
      rtpCapabilitiesJson: JSON.stringify(mediasoupDevice.rtpCapabilities),
    },
    new AbortController().signal
  )

  console.log("Requested consume")

  const consumer = await recvTransport.consume({
    id: consumeResponse.consumerId,
    producerId: consumeResponse.producerId,
    kind: "audio",
    rtpParameters: JSON.parse(consumeResponse.rtpParametersJson),
    streamId: "streamer",
  })

  console.log(consumer)

  console.log("Play track!")

  const audioElement = document.querySelector("#audio")
  const stream = new MediaStream()
  stream.addTrack(consumer.track)
  audioElement.srcObject = stream
  console.log("Done")

  // const { peers } = await this._protoo.request(
  //   'join',
  //   {
  //     displayName     : this._displayName,
  //     device          : this._device,
  //     rtpCapabilities : this._consume
  //       ? this._mediasoupDevice.rtpCapabilities
  //       : undefined,
  //     sctpCapabilities : this._useDataChannel && this._consume
  //       ? this._mediasoupDevice.sctpCapabilities
  //       : undefined
  //   });
}
