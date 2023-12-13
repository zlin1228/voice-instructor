import {
  CookType,
  arrayType,
  booleanType,
  doubleType,
  int32Type,
  mapType,
  objectType,
  stringType,
  nullableType,
} from "base-core/lib/types.js"

// https://gue1-spclient.spotify.com/connect-state/v1/devices/hobs_57c0eb2511342408644e64371cb4db31263
export const spotifyApiConnectStateType = objectType([
  {
    name: "player_state",
    type: objectType([
      { name: "context_uri", type: stringType },
      {
        name: "track",
        type: objectType([{ name: "uri", type: stringType }] as const),
      },
      { name: "position_as_of_timestamp", type: doubleType },
      { name: "duration", type: doubleType },
      { name: "is_playing", type: booleanType },
      { name: "is_paused", type: booleanType },
    ] as const),
  },
] as const)

export const spotifyApiImageType = objectType([
  { name: "url", type: stringType },
  { name: "width", type: int32Type },
  { name: "height", type: int32Type },
] as const)

export const spotifyApiArtistType = objectType([
  { name: "uri", type: stringType },
  { name: "name", type: stringType },
] as const)

export const spotifyApiAlbumType = objectType([
  { name: "uri", type: stringType },
  { name: "artists", type: arrayType(spotifyApiArtistType) },
  { name: "images", type: arrayType(spotifyApiImageType) },
] as const)

export const spotifyApiTrackType = objectType([
  { name: "uri", type: stringType },
  { name: "name", type: stringType },
  { name: "album", type: spotifyApiAlbumType },
  { name: "artists", type: arrayType(spotifyApiArtistType) },
  { name: "duration_ms", type: int32Type },
  {
    name: "external_ids",
    type: objectType([
      { name: "isrc", type: stringType, optional: true },
    ] as const),
  },
] as const)

export type SpotifyApiTrackType = CookType<typeof spotifyApiTrackType>

// https://api.spotify.com/v1/tracks?ids=3jr9gtpaDA4XFdDSqRpPZk,7rluktTepDJTxl6Jb35otq,3Zckk6BHuIzsk0oGnH5xAB,3lSOZb5rruEnFbe9xWELF6&market=from_token
export const spotifyApiTracksType = objectType([
  { name: "tracks", type: arrayType(nullableType(spotifyApiTrackType)) },
] as const)

export const spotifyApiTrackPlaybackTrackType = objectType([
  {
    name: "metadata",
    type: objectType([
      { name: "uri", type: stringType },
      { name: "name", type: stringType },
      { name: "authors", type: arrayType(mapType(stringType)) },
      { name: "duration", type: int32Type },
      { name: "images", type: arrayType(spotifyApiImageType) },
    ] as const),
  },
] as const)

export const spotifyApiTrackPlaybackStateType = objectType([
  { name: "track", type: int32Type },
] as const)

// https://gue1-spclient.spotify.com/track-playback/v1/devices/4dc52ab23e17d1ee5c70e586fde66f6de73837c3/state
export const spotifyApiTrackPlaybackType = objectType([
  {
    name: "state_machine",
    type: objectType([
      { name: "tracks", type: arrayType(spotifyApiTrackPlaybackTrackType) },
      { name: "states", type: arrayType(spotifyApiTrackPlaybackStateType) },
      {
        name: "attributes",
        type: objectType([
          {
            name: "options",
            type: objectType([
              { name: "shuffling_context", type: booleanType },
              { name: "repeating_context", type: booleanType },
              { name: "repeating_track", type: booleanType },
            ] as const),
          },
        ] as const),
      },
    ] as const),
  },
  {
    name: "updated_state_ref",
    type: objectType([
      { name: "state_index", type: int32Type },
      { name: "paused", type: booleanType },
    ] as const),
  },
] as const)
