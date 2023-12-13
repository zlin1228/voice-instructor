import { google, youtube_v3 } from "googleapis"
import { Scope } from "base-core/lib/scope.js"
import { ImageWithDimension } from "cm-quantum-peripheral-common/lib/schema/common.js"
import {
  YoutubeResource,
  YoutubeSearch,
} from "cm-quantum-peripheral-common/lib/schema/youtube.js"

const youtubeApiKey = "AIzaSyA-13Y4s3OFOn37YXwsYQvH_RfNpVPh1Ps"

function normalizeImageWithDimensionFromYoutube(
  thumbnail: youtube_v3.Schema$Thumbnail | null | undefined
): ImageWithDimension | undefined {
  return thumbnail == null
    ? undefined
    : {
        url: thumbnail.url ?? undefined,
        width: thumbnail.width ?? undefined,
        height: thumbnail.height ?? undefined,
      }
}

function normalizeYoutubeResourceFromSearchResult(
  searchResult: youtube_v3.Schema$SearchResult
): YoutubeResource {
  const id =
    (searchResult.id?.kind === "youtube#video"
      ? searchResult.id.videoId
      : searchResult.id?.kind === "youtube#playlist"
      ? searchResult.id.playlistId
      : searchResult.id?.kind === "youtube#channel"
      ? searchResult.id.channelId
      : undefined) ?? undefined
  return {
    kind: searchResult.id?.kind ?? undefined,
    id,
    channelId: searchResult.snippet?.channelId ?? undefined,
    channelTitle: searchResult.snippet?.channelTitle ?? undefined,
    description: searchResult.snippet?.description ?? undefined,
    publishedAt:
      searchResult.snippet?.publishedAt == null
        ? undefined
        : new Date(searchResult.snippet.publishedAt),
    thumbnails:
      searchResult.snippet?.thumbnails == null
        ? undefined
        : {
            default: normalizeImageWithDimensionFromYoutube(
              searchResult.snippet.thumbnails.default
            ),
            high: normalizeImageWithDimensionFromYoutube(
              searchResult.snippet.thumbnails.high
            ),
            maxres: normalizeImageWithDimensionFromYoutube(
              searchResult.snippet.thumbnails.maxres
            ),
            medium: normalizeImageWithDimensionFromYoutube(
              searchResult.snippet.thumbnails.medium
            ),
            standard: normalizeImageWithDimensionFromYoutube(
              searchResult.snippet.thumbnails.standard
            ),
          },
    title: searchResult.snippet?.title ?? undefined,
    link: id === undefined ? undefined : `vnd.youtube://${id}`,
  }
}

export async function youtubeSearch(
  scope: Scope,
  request: YoutubeSearch
): Promise<YoutubeResource[]> {
  const youtube = google.youtube({
    version: "v3",
    auth: youtubeApiKey,
  })
  const resp = await youtube.search.list({
    part: ["id", "snippet"],
    q: request.query,
  })
  return (
    resp.data.items?.map((item) =>
      normalizeYoutubeResourceFromSearchResult(item)
    ) ?? []
  )
}
