import * as mediasoup from "mediasoup"

import {
  Scope,
  checkAndGetCancelToken,
  launchBackgroundScope,
  sleepSeconds,
} from "base-core/lib/scope.js"
import { abort, abortIfUndefined } from "base-core/lib/debug.js"
import { log } from "base-core/lib/logging.js"
import { throwError } from "base-core/lib/exception.js"
import {
  MediasoupCreateWebRtcTransportResponse,
  MediasoupConsumeRequest,
  MediasoupConsumeResponse,
  MediasoupGetRouterRtpCapabilitiesResponse,
  MediasoupConnectWebRtcTransportRequest,
} from "cm-browsing-minion-common/lib/schema/schema.js"

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
  readonly #rtpTransport: mediasoup.types.PlainTransport
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
    rtpTransport: mediasoup.types.PlainTransport,
    webRtcServer: mediasoup.types.WebRtcServer,
    producer: mediasoup.types.Producer
  ) {
    this.#worker = worker
    this.#router = router
    this.#rtpTransport = rtpTransport
    this.#webRtcServer = webRtcServer
    this.#producer = producer
  }

  static async build(scope: Scope, selfHost: string): Promise<Room> {
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
        ip: "0.0.0.0",
      },
      rtcpMux: false,
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
          ip: "0.0.0.0",
          announcedIp: selfHost,
          port: 20000,
        },
        {
          protocol: "tcp",
          ip: "0.0.0.0",
          announcedIp: selfHost,
          port: 20000,
        },
      ],
    })

    // launchBackgroundScope(scope, async (scope) => {
    //   const cancelToken = checkAndGetCancelToken(scope)
    //   while (cancelToken.cancelReason === undefined) {
    //     await Room.monitorJitter(producer)
    //     await sleepSeconds(scope, 5)
    //   }
    // })

    return new Room(worker, router, rtpTransport, webRtcServer, producer)
  }

  getProducerPorts(): {
    rtpPort: number
    rtcpPort: number
  } {
    return {
      rtpPort: this.#rtpTransport.tuple.localPort,
      rtcpPort: abortIfUndefined(this.#rtpTransport.rtcpTuple).localPort,
    }
  }

  async getRouterRtpCapabilities(): Promise<MediasoupGetRouterRtpCapabilitiesResponse> {
    return {
      rtpCapabilitiesJson: JSON.stringify(this.#router.rtpCapabilities),
    }
  }

  async createWebRtcTransport(): Promise<MediasoupCreateWebRtcTransportResponse> {
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

  async consume(
    consumeRequest: MediasoupConsumeRequest
  ): Promise<MediasoupConsumeResponse> {
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
    request: MediasoupConnectWebRtcTransportRequest
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

  static async monitorJitter(
    producer: mediasoup.types.Producer
  ): Promise<void> {
    const stats = await producer.getStats()
    console.log(stats)
  }
}
