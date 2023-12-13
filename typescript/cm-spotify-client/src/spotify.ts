import {
  Scope,
  cancelTokenToAbortSignal,
  checkAndGetCancelToken,
} from "base-core/lib/scope.js"
import {
  CookType,
  arrayType,
  booleanType,
  doubleType,
  int32Type,
  nullableType,
  objectType,
  stringType,
} from "base-core/lib/types.js"
import {
  buildHttpServiceClient,
  defaultBuildHttpServiceClientOptions,
} from "base-node/lib/service.js"
import { commonNormalizer } from "base-core/lib/types-common.js"
import { buildUrlSearch } from "base-core/lib/http.js"
import {
  SpotifyTrack,
  SpotifySearchRequest,
  SpotifySearchResponse,
  SpotifyPlayRequest,
  SpotifyPauseRequest,
  SpotifyGetPlaybackStateRequest,
  SpotifyGetPlaybackStateResponse,
  SpotifySkipToNextRequest,
  SpotifySkipToPreviousRequest,
  SpotifySetRepeatModeRequest,
  SpotifySetShuffleModeRequest,
  SpotifyPlaylist,
  SpotifyGetCurrentUserPlaylistsRequest,
  SpotifyGetCurrentUserPlaylistsResponse,
  SpotifyHttpService,
} from "./spotify-schema.js"

const spotifyApiTrackObjectType = objectType([
  { name: "name", type: stringType },
  { name: "uri", type: stringType },
] as const)

type SpotifyApiTrackObject = CookType<typeof spotifyApiPlaylistObjectType>

const spotifyApiPlaylistObjectType = objectType([
  { name: "name", type: stringType },
  { name: "uri", type: stringType },
] as const)

type SpotifyApiPlaylistObject = CookType<typeof spotifyApiPlaylistObjectType>

// https://developer.spotify.com/documentation/web-api/reference/search

const spotifyApiSearchRequestType = objectType([
  { name: "q", type: stringType },
  { name: "type", type: stringType },
] as const)

const spotifyApiSearchResponseType = objectType([
  {
    name: "tracks",
    type: objectType([
      { name: "items", type: arrayType(spotifyApiTrackObjectType) },
    ] as const),
    optional: true,
  },
  {
    name: "playlists",
    type: objectType([
      { name: "items", type: arrayType(spotifyApiPlaylistObjectType) },
    ] as const),
    optional: true,
  },
] as const)

const spotifyV1HttpServiceSchema = [
  {
    kind: "get",
    value: {
      name: "search",
      query: spotifyApiSearchRequestType,
      response: {
        kind: "json",
        value: spotifyApiSearchResponseType,
      },
    },
  },
] as const

function normalizeTrackFromSpotify(track: SpotifyApiTrackObject): SpotifyTrack {
  return {
    name: track.name,
    spotifyUri: track.uri,
  }
}

function normalizePlaylistFromSpotify(
  playlist: SpotifyApiPlaylistObject
): SpotifyPlaylist {
  return {
    name: playlist.name,
    spotifyUri: playlist.uri,
  }
}

export async function spotifySearch(
  scope: Scope,
  request: SpotifySearchRequest
): Promise<SpotifySearchResponse> {
  const client = buildHttpServiceClient(spotifyV1HttpServiceSchema, {
    ...defaultBuildHttpServiceClientOptions("https://api.spotify.com/v1"),
    headers: [{ name: "Authorization", value: `Bearer ${request.token}` }],
  })
  const cancelToken = checkAndGetCancelToken(scope)
  const signal = cancelTokenToAbortSignal(cancelToken)
  const response = await client.get_search.fetch(
    {
      q: request.query,
      type: "track,playlist",
    },
    signal
  )
  return {
    tracks: (response.tracks?.items ?? []).map((track) =>
      normalizeTrackFromSpotify(track)
    ),
    playlists: (response.playlists?.items ?? []).map((playlist) =>
      normalizePlaylistFromSpotify(playlist)
    ),
  }
}

// https://developer.spotify.com/documentation/web-api/reference/start-a-users-playback

const spotifyApiPlayRequestType = objectType([
  { name: "uris", type: arrayType(stringType), optional: true },
  { name: "context_uri", type: stringType, optional: true },
] as const)

export async function spotifyPlay(
  scope: Scope,
  request: SpotifyPlayRequest
): Promise<{}> {
  const cancelToken = checkAndGetCancelToken(scope)
  const signal = cancelTokenToAbortSignal(cancelToken)
  const params = buildUrlSearch(
    request.deviceId === null
      ? []
      : [{ name: "device_id", value: request.deviceId }]
  )
  const resp = await fetch(
    `https://api.spotify.com/v1/me/player/play?${params}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${request.token}`,
      },
      body: JSON.stringify(
        commonNormalizer(spotifyApiPlayRequestType, {
          uris: request.trackUris,
          context_uri: request.contextUri,
        })
      ),
      signal,
    }
  )
  if (!resp.ok) {
    throw new Error(`Spotify API request failed: ${resp.status}`)
  }
  return {}
}

// https://developer.spotify.com/documentation/web-api/reference/pause-a-users-playback

export async function spotifyPause(
  scope: Scope,
  request: SpotifyPauseRequest
): Promise<{}> {
  const cancelToken = checkAndGetCancelToken(scope)
  const signal = cancelTokenToAbortSignal(cancelToken)
  const params = buildUrlSearch(
    request.deviceId === null
      ? []
      : [{ name: "device_id", value: request.deviceId }]
  )
  const resp = await fetch(
    `https://api.spotify.com/v1/me/player/pause?${params}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${request.token}`,
      },
      signal,
    }
  )
  if (!resp.ok) {
    throw new Error(`Spotify API request failed: ${resp.status}`)
  }
  return {}
}

// https://developer.spotify.com/documentation/web-api/reference/skip-users-playback-to-next-track

export async function spotifySkipToNext(
  scope: Scope,
  request: SpotifySkipToNextRequest
): Promise<{}> {
  const cancelToken = checkAndGetCancelToken(scope)
  const signal = cancelTokenToAbortSignal(cancelToken)
  const params = buildUrlSearch(
    request.deviceId === null
      ? []
      : [{ name: "device_id", value: request.deviceId }]
  )
  const resp = await fetch(
    `https://api.spotify.com/v1/me/player/next?${params}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${request.token}`,
      },
      signal,
    }
  )
  if (!resp.ok) {
    throw new Error(`Spotify API request failed: ${resp.status}`)
  }
  return {}
}

// https://developer.spotify.com/documentation/web-api/reference/skip-users-playback-to-previous-track

export async function spotifySkipToPrevious(
  scope: Scope,
  request: SpotifySkipToPreviousRequest
): Promise<{}> {
  const cancelToken = checkAndGetCancelToken(scope)
  const signal = cancelTokenToAbortSignal(cancelToken)
  const params = buildUrlSearch(
    request.deviceId === null
      ? []
      : [{ name: "device_id", value: request.deviceId }]
  )
  const resp = await fetch(
    `https://api.spotify.com/v1/me/player/previous?${params}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${request.token}`,
      },
      signal,
    }
  )
  if (!resp.ok) {
    throw new Error(`Spotify API request failed: ${resp.status}`)
  }
  return {}
}

// https://developer.spotify.com/documentation/web-api/reference/set-repeat-mode-on-users-playback

export async function spotifySetRepeatMode(
  scope: Scope,
  request: SpotifySetRepeatModeRequest
): Promise<{}> {
  const cancelToken = checkAndGetCancelToken(scope)
  const signal = cancelTokenToAbortSignal(cancelToken)
  const params = buildUrlSearch([
    { name: "state", value: request.repeatMode },
    ...(request.deviceId === null
      ? []
      : [{ name: "device_id", value: request.deviceId }]),
  ])
  const resp = await fetch(
    `https://api.spotify.com/v1/me/player/repeat?${params}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${request.token}`,
      },
      signal,
    }
  )
  if (!resp.ok) {
    throw new Error(`Spotify API request failed: ${resp.status}`)
  }
  return {}
}

// https://developer.spotify.com/documentation/web-api/reference/toggle-shuffle-for-users-playback

export async function spotifySetShuffleMode(
  scope: Scope,
  request: SpotifySetShuffleModeRequest
): Promise<{}> {
  const cancelToken = checkAndGetCancelToken(scope)
  const signal = cancelTokenToAbortSignal(cancelToken)
  const params = buildUrlSearch([
    { name: "state", value: request.shuffleMode ? "true" : "false" },
    ...(request.deviceId === null
      ? []
      : [{ name: "device_id", value: request.deviceId }]),
  ])
  const resp = await fetch(
    `https://api.spotify.com/v1/me/player/shuffle?${params}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${request.token}`,
      },
      signal,
    }
  )
  if (!resp.ok) {
    throw new Error(`Spotify API request failed: ${resp.status}`)
  }
  return {}
}

// https://developer.spotify.com/documentation/web-api/reference/get-information-about-the-users-current-playback

const spotifyApiGetPlaybackStateResponseType = objectType([
  {
    name: "device",
    type: objectType([
      { name: "id", type: stringType },
      { name: "name", type: stringType },
      { name: "volume_percent", type: int32Type },
    ] as const),
  },
  { name: "repeat_state", type: stringType },
  { name: "shuffle_state", type: booleanType },
  {
    name: "context",
    type: nullableType(
      objectType([
        { name: "type", type: stringType },
        { name: "uri", type: stringType },
      ] as const)
    ),
  },
  { name: "progress_ms", type: doubleType },
  { name: "is_playing", type: booleanType },
  { name: "item", type: nullableType(spotifyApiTrackObjectType) },
  { name: "currently_playing_type", type: stringType },
] as const)

export async function spotifyGetPlaybackState(
  scope: Scope,
  request: SpotifyGetPlaybackStateRequest
): Promise<SpotifyGetPlaybackStateResponse> {
  const cancelToken = checkAndGetCancelToken(scope)
  const signal = cancelTokenToAbortSignal(cancelToken)
  const resp = await fetch("https://api.spotify.com/v1/me/player", {
    headers: {
      Authorization: `Bearer ${request.token}`,
    },
    signal,
  })
  if (!resp.ok) {
    throw new Error(`Spotify API request failed: ${resp.status}`)
  }
  const apiResp = commonNormalizer(
    spotifyApiGetPlaybackStateResponseType,
    await resp.json()
  )
  return {
    device: {
      id: apiResp.device.id,
      name: apiResp.device.name,
      volumePercent: apiResp.device.volume_percent,
    },
    repeatState: apiResp.repeat_state,
    shuffleState: apiResp.shuffle_state,
    context: apiResp.context,
    progressMs: apiResp.progress_ms,
    isPlaying: apiResp.is_playing,
    item:
      apiResp.item === null ? null : normalizeTrackFromSpotify(apiResp.item),
    currentlyPlayingType: apiResp.currently_playing_type,
  }
}

// https://developer.spotify.com/documentation/web-api/reference/get-a-list-of-current-users-playlists

const spotifyApiGetCurrentUserPlaylistsResponseType = objectType([
  { name: "items", type: arrayType(spotifyApiPlaylistObjectType) },
] as const)

export async function spotifyGetCurrentUserPlaylists(
  scope: Scope,
  request: SpotifyGetCurrentUserPlaylistsRequest
): Promise<SpotifyGetCurrentUserPlaylistsResponse> {
  const cancelToken = checkAndGetCancelToken(scope)
  const signal = cancelTokenToAbortSignal(cancelToken)
  const resp = await fetch("https://api.spotify.com/v1/me/playlists", {
    headers: {
      Authorization: `Bearer ${request.token}`,
    },
    signal,
  })
  if (!resp.ok) {
    throw new Error(`Spotify API request failed: ${resp.status}`)
  }
  const apiResp = commonNormalizer(
    spotifyApiGetCurrentUserPlaylistsResponseType,
    await resp.json()
  )
  return {
    playlists: apiResp.items.map((playlist) =>
      normalizePlaylistFromSpotify(playlist)
    ),
  }
}

export async function buildSpotifyHttpService(
  scope: Scope
): Promise<SpotifyHttpService> {
  return {
    post_spotifySearch: async (scope, request) => {
      return await spotifySearch(scope, request)
    },
    post_spotifyPlay: async (scope, request) => {
      return await spotifyPlay(scope, request)
    },
    post_spotifyPause: async (scope, request) => {
      return await spotifyPause(scope, request)
    },
    post_spotifySkipToNext: async (scope, request) => {
      return await spotifySkipToNext(scope, request)
    },
    post_spotifySkipToPrevious: async (scope, request) => {
      return await spotifySkipToPrevious(scope, request)
    },
    post_spotifySetRepeatMode: async (scope, request) => {
      return await spotifySetRepeatMode(scope, request)
    },
    post_spotifySetShuffleMode: async (scope, request) => {
      return await spotifySetShuffleMode(scope, request)
    },
    post_spotifyGetPlaybackState: async (scope, request) => {
      return await spotifyGetPlaybackState(scope, request)
    },
    post_spotifyGetCurrentUserPlaylists: async (scope, request) => {
      return await spotifyGetCurrentUserPlaylists(scope, request)
    },
  }
}
