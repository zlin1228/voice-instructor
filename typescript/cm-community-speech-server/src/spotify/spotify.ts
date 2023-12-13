import {
  objectType,
  stringType,
  emptyObjectType,
  CookType,
  booleanType,
  timestampType,
  doubleType,
} from "base-core/lib/types.js"

export const cmSpotifyPlayerControlType = objectType([
  {
    name: "playSearchTop",
    type: objectType([
      { name: "query", type: stringType },
    ] as const),
    optional: true,
  },
  {
    name: "playTrack",
    type: objectType([{ name: "spotifyTrackUri", type: stringType }] as const),
    optional: true,
  },
  {
    name: "playSpotifyUriWithName",
    type: objectType([
      { name: "spotifyUri", type: stringType },
      { name: "name", type: stringType },
    ] as const),
    optional: true,
  },
  {
    name: "playLikedSongs",
    type: objectType([] as const),
    optional: true,
  },
  {
    name: "playPlaylist",
    type: objectType([
      { name: "spotifyPlaylistUri", type: stringType },
    ] as const),
    optional: true,
  },
  {
    name: "playSearch",
    type: objectType([
      { name: "query", type: stringType },
      { name: "type", type: stringType },
    ] as const),
    optional: true,
  },
  {
    name: "switchResume",
    type: emptyObjectType,
    optional: true,
  },
  {
    name: "previous",
    type: emptyObjectType,
    optional: true,
  },
  {
    name: "next",
    type: emptyObjectType,
    optional: true,
  },
  {
    name: "switchShuffle",
    type: emptyObjectType,
    optional: true,
  },
  {
    name: "switchRepeatMode",
    type: emptyObjectType,
    optional: true,
  },
  {
    name: "jumpToPosition",
    type: objectType([{ name: "playedRatio", type: doubleType }] as const),
    optional: true,
  },
] as const)
export type CmSpotifyPlayerControl = CookType<
  typeof cmSpotifyPlayerControlType
>

export const cmSpotifyPlayerStatusType = objectType([
  {
    name: "playing",
    type: booleanType,
  },
  {
    // If the player started playing a track at this time, its progress will
    // match the progress of the track.
    name: "matchingStartPlayingTime",
    type: timestampType,
    optional: true,
  },
  {
    name: "playedSeconds",
    type: doubleType,
    optional: true,
  },
  {
    name: "durationSeconds",
    type: doubleType,
  },
  {
    name: "shuffle",
    type: booleanType,
  },
  {
    name: "repeatMode",
    type: stringType, // "off", "track", "context"
  },
  {
    name: "trackName",
    type: stringType,
  },
  {
    name: "trackSpotifyUri",
    type: stringType,
  },
  {
    name: "albumImageUrl",
    type: stringType,
  },
  {
    name: "artistName",
    type: stringType,
  },
] as const)
export type CmSpotifyPlayerStatus = CookType<typeof cmSpotifyPlayerStatusType>
