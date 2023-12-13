import {
  objectType,
  stringType,
  CookType,
  doubleType,
  int32Type,
} from "base-core/lib/types.js"

export const emptyResponseType = objectType([] as const)

export const linkResponseType = objectType([
  { name: "url", type: stringType },
] as const)

export type LinkResponse = CookType<typeof linkResponseType>

export const geoLocationType = objectType([
  { name: "latitude", type: doubleType },
  { name: "longitude", type: doubleType },
] as const)

export type GeoLocation = CookType<typeof geoLocationType>

export const geoLocationBoundType = objectType([
  { name: "northeast", type: geoLocationType },
  { name: "southwest", type: geoLocationType },
] as const)

export type GeoLocationBound = CookType<typeof geoLocationBoundType>

export const imageWithDimensionType = objectType([
  { name: "url", type: stringType, optional: true },
  { name: "width", type: int32Type, optional: true },
  { name: "height", type: int32Type, optional: true },
] as const)

export type ImageWithDimension = CookType<typeof imageWithDimensionType>
