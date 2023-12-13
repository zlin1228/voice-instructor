import { CookServiceHttpSchema } from "base-core/lib/http-schema"
import {
  objectType,
  stringType,
  CookType,
  arrayType,
  nullableType,
  emptyObjectType,
  booleanType,
  doubleType,
  int32Type,
} from "base-core/lib/types.js"

// Search a track:
// https://developer.spotify.com/documentation/web-api/reference/search

// Play the track:
// https://developer.spotify.com/documentation/web-api/reference/start-a-users-playback

export const spotifyTrackType = objectType([
  { name: "name", type: stringType },
  { name: "spotifyUri", type: stringType },
] as const)

export type SpotifyTrack = CookType<typeof spotifyTrackType>

export const spotifyPlaylistType = objectType([
  { name: "name", type: stringType },
  { name: "spotifyUri", type: stringType },
] as const)

export type SpotifyPlaylist = CookType<typeof spotifyPlaylistType>

export const spotifySearchRequestType = objectType([
  { name: "token", type: stringType },
  { name: "query", type: stringType },
] as const)

export type SpotifySearchRequest = CookType<typeof spotifySearchRequestType>

export const spotifySearchResponseType = objectType([
  { name: "tracks", type: arrayType(spotifyTrackType) },
  { name: "playlists", type: arrayType(spotifyPlaylistType) },
] as const)

export type SpotifySearchResponse = CookType<typeof spotifySearchResponseType>

export const spotifyPlayRequestType = objectType([
  { name: "token", type: stringType },
  { name: "deviceId", type: nullableType(stringType) },
  { name: "trackUris", type: arrayType(stringType), optional: true },
  { name: "contextUri", type: stringType, optional: true },
] as const)

export type SpotifyPlayRequest = CookType<typeof spotifyPlayRequestType>

export const spotifyPauseRequestType = objectType([
  { name: "token", type: stringType },
  { name: "deviceId", type: nullableType(stringType) },
] as const)

export type SpotifyPauseRequest = CookType<typeof spotifyPauseRequestType>

export const spotifySkipToNextRequestType = objectType([
  { name: "token", type: stringType },
  { name: "deviceId", type: nullableType(stringType) },
] as const)

export type SpotifySkipToNextRequest = CookType<
  typeof spotifySkipToNextRequestType
>

export const spotifySkipToPreviousRequestType = objectType([
  { name: "token", type: stringType },
  { name: "deviceId", type: nullableType(stringType) },
] as const)

export type SpotifySkipToPreviousRequest = CookType<
  typeof spotifySkipToPreviousRequestType
>

export const spotifySetRepeatModeRequestType = objectType([
  { name: "token", type: stringType },
  { name: "deviceId", type: nullableType(stringType) },
  { name: "repeatMode", type: stringType },
] as const)

export type SpotifySetRepeatModeRequest = CookType<
  typeof spotifySetRepeatModeRequestType
>

export const spotifySetShuffleModeRequestType = objectType([
  { name: "token", type: stringType },
  { name: "deviceId", type: nullableType(stringType) },
  { name: "shuffleMode", type: booleanType },
] as const)

export type SpotifySetShuffleModeRequest = CookType<
  typeof spotifySetShuffleModeRequestType
>

export const spotifyGetPlaybackStateRequestType = objectType([
  { name: "token", type: stringType },
] as const)

export type SpotifyGetPlaybackStateRequest = CookType<
  typeof spotifyGetPlaybackStateRequestType
>

export const spotifyGetPlaybackStateResponseType = objectType([
  {
    name: "device",
    type: objectType([
      { name: "id", type: stringType },
      { name: "name", type: stringType },
      { name: "volumePercent", type: int32Type },
    ] as const),
  },
  { name: "repeatState", type: stringType },
  { name: "shuffleState", type: booleanType },
  {
    name: "context",
    type: nullableType(
      objectType([
        { name: "type", type: stringType },
        { name: "uri", type: stringType },
      ] as const)
    ),
  },
  { name: "progressMs", type: doubleType },
  { name: "isPlaying", type: booleanType },
  { name: "item", type: nullableType(spotifyTrackType) },
  { name: "currentlyPlayingType", type: stringType },
] as const)

export type SpotifyGetPlaybackStateResponse = CookType<
  typeof spotifyGetPlaybackStateResponseType
>

export const spotifyGetCurrentUserPlaylistsRequestType = objectType([
  { name: "token", type: stringType },
] as const)

export type SpotifyGetCurrentUserPlaylistsRequest = CookType<
  typeof spotifyGetCurrentUserPlaylistsRequestType
>

export const spotifyGetCurrentUserPlaylistsResponseType = objectType([
  { name: "playlists", type: arrayType(spotifyPlaylistType) },
] as const)

export type SpotifyGetCurrentUserPlaylistsResponse = CookType<
  typeof spotifyGetCurrentUserPlaylistsResponseType
>

export const spotifyEndpoints = [
  {
    kind: "post",
    value: {
      name: "spotifySearch",
      request: {
        kind: "json",
        value: spotifySearchRequestType,
      },
      response: {
        kind: "json",
        value: spotifySearchResponseType,
      },
    },
  },
  {
    kind: "post",
    value: {
      name: "spotifyPlay",
      request: {
        kind: "json",
        value: spotifyPlayRequestType,
      },
      response: {
        kind: "json",
        value: emptyObjectType,
      },
    },
  },
  {
    kind: "post",
    value: {
      name: "spotifyPause",
      request: {
        kind: "json",
        value: spotifyPauseRequestType,
      },
      response: {
        kind: "json",
        value: emptyObjectType,
      },
    },
  },
  {
    kind: "post",
    value: {
      name: "spotifySkipToNext",
      request: {
        kind: "json",
        value: spotifySkipToNextRequestType,
      },
      response: {
        kind: "json",
        value: emptyObjectType,
      },
    },
  },
  {
    kind: "post",
    value: {
      name: "spotifySkipToPrevious",
      request: {
        kind: "json",
        value: spotifySkipToPreviousRequestType,
      },
      response: {
        kind: "json",
        value: emptyObjectType,
      },
    },
  },
  {
    kind: "post",
    value: {
      name: "spotifySetRepeatMode",
      request: {
        kind: "json",
        value: spotifySetRepeatModeRequestType,
      },
      response: {
        kind: "json",
        value: emptyObjectType,
      },
    },
  },
  {
    kind: "post",
    value: {
      name: "spotifySetShuffleMode",
      request: {
        kind: "json",
        value: spotifySetShuffleModeRequestType,
      },
      response: {
        kind: "json",
        value: emptyObjectType,
      },
    },
  },
  {
    kind: "post",
    value: {
      name: "spotifyGetPlaybackState",
      request: {
        kind: "json",
        value: spotifyGetPlaybackStateRequestType,
      },
      response: {
        kind: "json",
        value: spotifyGetPlaybackStateResponseType,
      },
    },
  },
  {
    kind: "post",
    value: {
      name: "spotifyGetCurrentUserPlaylists",
      request: {
        kind: "json",
        value: spotifyGetCurrentUserPlaylistsRequestType,
      },
      response: {
        kind: "json",
        value: spotifyGetCurrentUserPlaylistsResponseType,
      },
    },
  },
] as const

export type SpotifyHttpService = CookServiceHttpSchema<typeof spotifyEndpoints>
