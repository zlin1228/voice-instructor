import * as mediasoup from "mediasoup"

import { Scope } from "base-core/lib/scope.js"
import { abort } from "base-core/lib/debug.js"
import { log } from "base-core/lib/logging.js"
import { throwError } from "base-core/lib/exception.js"
import {
  StreamerHttpService,
  CreateWebRtcTransportResponse,
  ConsumeRequest,
  ConsumeResponse,
  GetRouterRtpCapabilitiesResponse,
  ConnectWebRtcTransportRequest,
} from "cm-streamer-common/lib/schema/schema.js"

// Supported codecs: https://github.com/versatica/mediasoup/blob/v3/node/src/supportedRtpCapabilities.ts
const rtpCapability: mediasoup.types.RtpCodecCapability = {
  kind: "audio",
  mimeType: "audio/opus",
  clockRate: 48000,
  channels: 2,
}

export class Room {
  readonly #worker: mediasoup.types.Worker
  readonly #router: mediasoup.types.Router
  readonly #webRtcServer: mediasoup.types.WebRtcServer
  readonly #producer: mediasoup.types.Producer
  readonly #transports = new Map<
    string,
    {
      transport: mediasoup.types.Transport
      consumerId: string | undefined
      consumer: mediasoup.types.Consumer | undefined
    }
  >()

  private constructor(
    worker: mediasoup.types.Worker,
    router: mediasoup.types.Router,
    webRtcServer: mediasoup.types.WebRtcServer,
    producer: mediasoup.types.Producer
  ) {
    this.#worker = worker
    this.#router = router
    this.#webRtcServer = webRtcServer
    this.#producer = producer
  }

  static async build(scope: Scope): Promise<Room> {
    const worker = await mediasoup.createWorker({
      logLevel: "debug",
      logTags: ["info", "ice", "dtls", "rtp", "srtp", "rtcp"],
      rtcMinPort: 10000,
      rtcMaxPort: 10100,
    })
    scope.onLeave(async () => {
      worker.close()
    })
    worker.on("died", () => {
      throw abort(
        "mediasoup Worker died - see: https://mediasoup.org/documentation/v3/mediasoup/api/#worker-on-died"
      )
    })

    const router = await worker.createRouter({ mediaCodecs: [rtpCapability] })

    const rtpTransportOptions: mediasoup.types.PlainTransportOptions = {
      listenIp: {
        ip: "0.0.0.0", // Replace this with the IP address where you want to listen for the RTP stream
        announcedIp: "192.168.1.13",
      },
      port: 6002,
      rtcpMux: false,
      // rtcpMux: true,
      comedia: true,
    }

    const rtpTransport = await router.createPlainTransport(rtpTransportOptions)
    log.info("rtpTransport")
    log.info(
      `RTP localIP=${rtpTransport.tuple.localIp} localPort=${
        rtpTransport.tuple.localPort
      } remoteIp=${rtpTransport.tuple.remoteIp ?? ""} remotePort=${
        rtpTransport.tuple.remotePort ?? ""
      }`
    )
    log.info(
      `RTCP localIP=${rtpTransport.rtcpTuple?.localIp ?? ""} localPort=${
        rtpTransport.rtcpTuple?.localPort ?? ""
      } remoteIp=${rtpTransport.rtcpTuple?.remoteIp ?? ""} remotePort=${
        rtpTransport.rtcpTuple?.remotePort ?? ""
      }`
    )

    const producer = await rtpTransport.produce({
      kind: "audio",
      rtpParameters: {
        codecs: [
          {
            mimeType: "audio/opus",
            payloadType: 101,
            clockRate: 48000,
            channels: 2,
            parameters: {
              "sprop-stereo": 1,
            },
          },
        ],
        encodings: [
          {
            ssrc: 11111111,
          },
        ],
      },
    })

    log.info(`Producer ID: [${producer.id}]`)

    const webRtcServer = await worker.createWebRtcServer({
      listenInfos: [
        {
          protocol: "udp",
          ip: "192.168.1.13",
          port: 20000,
        },
        {
          protocol: "tcp",
          ip: "192.168.1.13",
          port: 20000,
        },
      ],
    })

    return new Room(worker, router, webRtcServer, producer)
  }

  async getRouterRtpCapabilities(): Promise<GetRouterRtpCapabilitiesResponse> {
    return {
      rtpCapabilitiesJson: JSON.stringify(this.#router.rtpCapabilities),
    }
  }

  async createWebRtcTransport(): Promise<CreateWebRtcTransportResponse> {
    const transport = await this.#router.createWebRtcTransport({
      webRtcServer: this.#webRtcServer,
    })
    await transport.enableTraceEvent(["probation", "bwe"])
    transport.addListener("trace", (trace) => {
      log.info(
        `transport "trace" event [transportId:${transport.id}, trace.type:${trace.type}]`
      )
      console.log(trace)
    })
    this.#transports.set(transport.id, {
      transport,
      consumerId: undefined,
      consumer: undefined,
    })

    return {
      transportId: transport.id,
      iceCandidatesJson: JSON.stringify(transport.iceCandidates),
      iceParametersJson: JSON.stringify(transport.iceParameters),
      dtlsParametersJson: JSON.stringify(transport.dtlsParameters),
      sctpParametersJson: JSON.stringify(transport.sctpParameters) ?? "",
    }
  }

  async consume(consumeRequest: ConsumeRequest): Promise<ConsumeResponse> {
    const transport =
      this.#transports.get(consumeRequest.transportId) ??
      throwError("Transport not found")
    const consumer = await transport.transport.consume({
      producerId: this.#producer.id,
      rtpCapabilities: JSON.parse(consumeRequest.rtpCapabilitiesJson),
      // Enable NACK for OPUS.
      enableRtx: true,
      paused: true,
    })
    transport.consumerId = consumer.id
    transport.consumer = consumer

    await consumer.enableTraceEvent(["rtp", "keyframe", "nack", "pli", "fir"])
    consumer.on("trace", (trace) => {
      // log.info(
      //   `consumer "trace" event [producerId:${consumer.id}, trace.type:${trace.type}]`
      // )
      // console.log(trace)
    })
    consumer.on("producerpause", () => {
      log.info("consumer:producerpause")
    })
    consumer.on("producerresume", () => {
      log.info("consumer:producerresume")
    })
    console.log(consumer.rtpParameters)
    return {
      consumerId: consumer.id,
      producerId: this.#producer.id,
      rtpParametersJson: JSON.stringify(consumer.rtpParameters),
    }
  }

  async connectWebRtcTransport(
    request: ConnectWebRtcTransportRequest
  ): Promise<void> {
    const transport =
      this.#transports.get(request.transportId) ??
      throwError("Transport not found")
    await transport.transport.connect({
      dtlsParameters: JSON.parse(request.dtlsParametersJson),
    })
    await transport.consumer?.resume()
    log.info("transport connected")
  }
}

export async function buildStreamerHttpService(
  scope: Scope,
  config: {}
): Promise<StreamerHttpService> {
  const room = await Room.build(scope)
  return {
    post_getRouterRtpCapabilities: async (scope, request) => {
      return await room.getRouterRtpCapabilities()
    },
    post_createWebRtcTransport: async (scope, request) => {
      return await room.createWebRtcTransport()
    },
    post_consume: async (scope, request) => {
      return await room.consume(request)
    },
    post_connectWebRtcTransport: async (scope, request) => {
      await room.connectWebRtcTransport(request)
      return {}
    },
  }
}
