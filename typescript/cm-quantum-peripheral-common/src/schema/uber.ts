// Uber Rider
// Reference: https://developer.uber.com/docs/riders/ride-requests/tutorials/deep-links/introduction

import {
  objectType,
  stringType,
  CookType,
  booleanType,
} from "base-core/lib/types.js"
import { geoLocationType, linkResponseType } from "./common.js"

export const uberLocationType = objectType([
  { name: "geoLocation", type: geoLocationType },

  // `nickname` is the name of the place, e.g. "UberHQ"
  // Either `nickname` or `formattedAddress` is required.
  { name: "nickname", type: stringType, optional: true },

  // `address` is the address of the place, e.g. "1455 Market St, San Francisco, CA 94103"
  // Either `nickname` or `formattedAddress` is required.
  { name: "formattedAddress", type: stringType, optional: true },
] as const)

export const uberRideRequestLinkType = objectType([
  // If `pickup` is omitted, user's current location is used
  { name: "pickup", type: uberLocationType, optional: true },

  { name: "dropoff", type: uberLocationType },

  // TODO: Add more parameters (product_id)
] as const)

export type UberRideRequestLink = CookType<typeof uberRideRequestLinkType>

export const uberRequestRideRequestType = objectType([
  { name: "pickupAddress", type: stringType },
  { name: "dropoffAddress", type: stringType },
] as const)

export type UberRequestRideRequest = CookType<typeof uberRequestRideRequestType>

export const uberRequestRideResponseType = objectType([
  { name: "ok", type: booleanType },
  { name: "logPath", type: stringType },
] as const)

export type UberRequestRideResponse = CookType<
  typeof uberRequestRideResponseType
>

export const uberEndpoints = [
  {
    kind: "post",
    value: {
      name: "buildUberRideRequestLink",
      request: {
        kind: "json",
        value: uberRideRequestLinkType,
      },
      response: {
        kind: "json",
        value: linkResponseType,
      },
    },
  },
  {
    kind: "post",
    value: {
      name: "uberRequestRide",
      request: {
        kind: "json",
        value: uberRequestRideRequestType,
      },
      response: {
        kind: "json",
        value: uberRequestRideResponseType,
      },
    },
  },
] as const
