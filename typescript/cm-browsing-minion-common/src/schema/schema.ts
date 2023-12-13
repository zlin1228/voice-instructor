import {
  CookType,
  emptyObjectType,
  objectType,
  stringType,
} from "base-core/lib/types.js"
import { CookServiceHttpSchema } from "base-core/lib/http-schema.js"

export const mediasoupGetRouterRtpCapabilitiesResponseType = objectType([
  { name: "rtpCapabilitiesJson", type: stringType },
] as const)

export type MediasoupGetRouterRtpCapabilitiesResponse = CookType<
  typeof mediasoupGetRouterRtpCapabilitiesResponseType
>

export const mediasoupCreateWebRtcTransportResponseType = objectType([
  { name: "transportId", type: stringType },
  { name: "iceParametersJson", type: stringType },
  { name: "iceCandidatesJson", type: stringType },
  { name: "dtlsParametersJson", type: stringType },
  { name: "sctpParametersJson", type: stringType },
] as const)

export type MediasoupCreateWebRtcTransportResponse = CookType<
  typeof mediasoupCreateWebRtcTransportResponseType
>

export const mediasoupConsumeRequestType = objectType([
  { name: "transportId", type: stringType },
  { name: "rtpCapabilitiesJson", type: stringType },
] as const)

export type MediasoupConsumeRequest = CookType<
  typeof mediasoupConsumeRequestType
>

export const mediasoupConsumeResponseType = objectType([
  { name: "consumerId", type: stringType },
  { name: "producerId", type: stringType },
  { name: "rtpParametersJson", type: stringType },
] as const)

export type MediasoupConsumeResponse = CookType<
  typeof mediasoupConsumeResponseType
>

export const mediasoupConnectWebRtcTransportRequestType = objectType([
  { name: "transportId", type: stringType },
  { name: "dtlsParametersJson", type: stringType },
] as const)

export type MediasoupConnectWebRtcTransportRequest = CookType<
  typeof mediasoupConnectWebRtcTransportRequestType
>

export const browsingMinionHttpServiceSchema = [
  {
    kind: "get",
    value: {
      name: "healthz",
      query: emptyObjectType,
      response: {
        kind: "json",
        value: emptyObjectType,
      },
    },
  },
  {
    kind: "post",
    value: {
      name: "mediasoupGetRouterRtpCapabilities",
      request: {
        kind: "json",
        value: emptyObjectType,
      },
      response: {
        kind: "json",
        value: mediasoupGetRouterRtpCapabilitiesResponseType,
      },
    },
  },
  {
    kind: "post",
    value: {
      name: "mediasoupCreateWebRtcTransport",
      request: {
        kind: "json",
        value: emptyObjectType,
      },
      response: {
        kind: "json",
        value: mediasoupCreateWebRtcTransportResponseType,
      },
    },
  },
  {
    kind: "post",
    value: {
      name: "mediasoupConsume",
      request: {
        kind: "json",
        value: mediasoupConsumeRequestType,
      },
      response: {
        kind: "json",
        value: mediasoupConsumeResponseType,
      },
    },
  },
  {
    kind: "post",
    value: {
      name: "mediasoupConnectWebRtcTransport",
      request: {
        kind: "json",
        value: mediasoupConnectWebRtcTransportRequestType,
      },
      response: {
        kind: "json",
        value: emptyObjectType,
      },
    },
  },
] as const

export type BrowsingMinionHttpService = CookServiceHttpSchema<
  typeof browsingMinionHttpServiceSchema
>
