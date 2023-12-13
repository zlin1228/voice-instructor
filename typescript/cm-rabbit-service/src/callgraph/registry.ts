import OpenAI from "openai"
import { getLanguageNameFallback } from "../kernel/language.js"

export const retrieveRelevantBunnies = (intention: string, languageCode: string): OpenAI.Chat.ChatCompletionCreateParams.Function[] => {

    return [
        {
            name: "search",
            description: `Returns a summary from searching Google. Used when the person asks a question that is events after 2021. Rephrase the query to be SEO-friendly.
Additionally, use this action when user and the assistant are following up on previous questions. Don't search when it's personal, philosophical, emotional or common sense.
Use this action when the user wants to know more about a musician, a song, or album. If the user wants to listen to music, use play_music instead.
The search value must be in ${getLanguageNameFallback(languageCode)}.
This function can also be used as a simple calculator for mathematical operations. For example, if the user asks "What is 2 + 2?", you should use search(2 + 2) instead of No-op().`,
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "The search query, e.g. Los Angeles Lakers Roster"
                    }
                },
                required: ["query"]
            }
        },
        {
            name: "internal_reasoning",
            description: `Use the system's internal reasoning capabilities to come up with a response. This may be used when a search for information is not required, or the Conversational Plugin Response indicates that the assistant is thinking. This is a function that you have access to, and it requires no arguments.`,
            parameters: {
                type: "object",
                properties: {
                    option: {
                        type: "string",
                        description: `The only possible value is None.`
                    }
                },
            }
        },
        {
            name: "conversation",
            description: `Use the system's conversational capabilities to wrap up the conversation. This may be used when the Conversational Plugin Response indicates to do something together with the user, or Conversational Plugin Response appears to be unfinished in talking. This is a function that you have access to, and it requires no arguments.`,
            parameters: {
                type: "object",
                properties: {
                    option: {
                        type: "string",
                        description: `The only possible value is None.`
                    }
                },
            }
        },
        {
            name: "play_music",
            description: `If the person indicates that they want to listen to music or wants to play a music track, an artist, a genre or an album. You have to use this if the user wants to play or listen to music. Since this action will help the user log into Spotify before playing the music, use this EVEN IF the user is not logged into Spotify. If the question contains both the artist and the song name, the value must be in the format of [song name], [artist name]
The search value in play music must be in the same language as the one appearing in the Message.`,
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "The music search query, e.g. Counting Stars, OneRepublic"
                    }
                },
                required: ["query"]
            }
        },
        {
            name: "play_liked_song",
            description: `If the person indicates that they want to listen to their liked songs, or their list. For example, "play my list." Use this even if user repeatedly asks to play their liked songs. Do not use play_music for this.`,
            parameters: {
                type: "object",
                properties: {
                    option: {
                        type: "string",
                        description: "The option the user wants to play. The only possible value is liked_songs."
                    }
                },
            }
        },
        {
            name: "change_voice",
            description: `If the person EXPLICITLY says they require a male or a female voice. MUST NOT use this command unless the person EXPLICITLY says they want a different voice. Use sparingly.`,
            parameters: {
                type: "object",
                properties: {
                    voice: {
                        type: "string",
                        description: "voice to change into. Only possible values are male or female."
                    }
                },
                required: ["voice"]
            }
        },
        {
            name: "change_user_name",
            description: `If the person wants the assistant to call them a different name.`,
            parameters: {
                type: "object",
                properties: {
                    name: {
                        type: "string",
                        description: "The name the person wants to be called. Do not use this when the user is asking about their name instead. The name must be in the same language as the one appearing in the Message."
                    }
                },
                required: ["name"]
            }
        },
        {
            name: "get_user_name",
            description: `If the person wants to know what the assistant calls them.`,
            parameters: {
                type: "object",
                properties: {
                    option: {
                        type: "string",
                        description: "The option the user wants to know. The only possible value is name."
                    }
                },
                required: ["name"]
            }
        },
        {
            name: "change_assistant_name",
            description: `If the person wants to call the assistant by a different name.`,
            parameters: {
                type: "object",
                properties: {
                    name: {
                        type: "string",
                        description: "The name the person wants to call the assistant. Do not use this when the user is asking about assistant's name instead. The name must be in the same language as the one appearing in the Message."
                    },
                },
                required: ["name"]
            }
        },
        {
            name: "get_assistant_name",
            description: `If the person wants to know what the assistant's name is.`,
            parameters: {
                type: "object",
                properties: {
                    option: {
                        type: "string",
                        description: "The option the user wants to know. The only possible value is name."
                    }
                },
                required: ["name"]
            }
        },
        {
            name: "clear_history",
            description: `If the person wants to clear the conversation history or make the assistant forget previous conversations.`,
            parameters: {
                type: "object",
                properties: {
                    option: {
                        type: "string",
                        description: "The option the user wants to clear. The only possible value is history."
                    }
                },
            }
        },
        {
            name: "None",
            description: `If no action is required. Use sparringly.`,
            parameters: {
                type: "object",
                properties: {
                    option: {
                        type: "string",
                        description: `The only possible value is None.`
                    }
                },
            }
        }
    ]
}