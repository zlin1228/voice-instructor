import {
  Scope,
  sleepSeconds,
} from "base-core/lib/scope.js"
import { ModelClient, UserStorage, sharedCallgraphOutput } from "../../model.js"
import {
  CallgraphSharedParameter,
  CallgraphNode,
} from "../../callgraph/graph.js"
import {
  getUserDocCreateIfNotExist,
  wavToRaw,
} from "../../kernel/kernel-common.js"
import { updateIntentionByRabbitResponse } from "../../kernel/intention.js"
import { Kernel } from "../../kernel/kernel.js"

export async function runSpotifyBunny(kernel: Kernel, spotifyNode: CallgraphNode, scope: Scope): Promise<void> {
    while (kernel.openAiInstructClient == null) {
      await sleepSeconds(scope, 0.1)
      console.log("Waiting for openAillmClient to be initialized...")
    }
    if (spotifyNode.action === "play_music") {
      kernel.musicPlaying = true
      var query: string = spotifyNode.value
      try {
        query =
          JSON.parse(spotifyNode.value).query ?? spotifyNode.value
      } catch (e) {
        console.log(
          "Failed to parse query for play_music: ",
          spotifyNode.value
        )
        query = spotifyNode.value
      }
  
      // transform query by existing callgraph context
      const userDoc = await getUserDocCreateIfNotExist(
        scope,
        kernel.modelClient,
        kernel.language,
        kernel.userId
      )
      const sharedCallgraphOutput = userDoc?.shared_callgraph_output ?? [];
      console.log("sharedCallgraphOutput in Spotify: ", sharedCallgraphOutput);
      const previousBunnyContext : string = JSON.stringify(sharedCallgraphOutput);
      console.log("previousBunnyContext in Spotify: ", previousBunnyContext);

      // TODO (Peiyuan): harden this prompt
      const prompt = `You are an algorithm analyzing human intentions. User reports a natural language query that you are using to play song on Spotify.
However, the original query might be just a placeholder or a hint, like "the from the search function," therefore you need to use your inherent reasoning capabilities to come up with a more complete query.
You have some additional context, which are function calls and their return values, that you can use to help you formulate a better query. 
Your song query will directly be used to play music on Spotify, so it should contain only the song name and artist name, and should be as complete as possible.
The song query: ${query}
The context from function calls: ${previousBunnyContext}
Updated song query (Song name by artist):`;

      var newQuery = await kernel.openAiInstructClient.completion(scope, {
        prompt: prompt,
        stopSequences: [],
        temperature0to1: 0,
        maxTokens: 512,
      });
      console.log("Updated Spotify Query: ", newQuery);

      newQuery = newQuery.replace("by", "AND")
      newQuery = newQuery.replace(", ", " AND ")
      // strip query of special characters like quotes, brackets
      newQuery = newQuery.replace(/[^a-zA-Z0-9 ]/g, "")


      if (newQuery.trim() !== "") {
        kernel.serverMessageQueue.pushBack({
          kind: "json",
          value: {
            kernel: {
              playSpotifyQuery: newQuery,
            },
          },
        })
      }

      var rabbitResponse = "Playing " + query;
      const newIntention = await updateIntentionByRabbitResponse(scope, kernel.modelClient, kernel.openAiInstructClient, kernel.userId, rabbitResponse);
      console.log("New intention: ", newIntention);
    } else if (spotifyNode.action === "play_liked_song") {
      kernel.musicPlaying = true
      kernel.serverMessageQueue.pushBack({
        kind: "json",
        value: {
          kernel: {
            playSpotifyLikedSong: "true",
          },
        },
      })
      var rabbitResponse = "Playing liked songs."
      const newIntention = await updateIntentionByRabbitResponse(scope, kernel.modelClient, kernel.openAiInstructClient, kernel.userId, rabbitResponse);
      console.log("New intention: ", newIntention);
    }
  }