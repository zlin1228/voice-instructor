
import { ModelClient } from "../model.js"
import {
  Scope,
  launchBackgroundScope,
  ScopeAttachment,
  HandlingQueue,
} from "base-core/lib/scope.js"
import ffmpeg from "fluent-ffmpeg"
import { Readable, PassThrough } from "stream"

export const getUserDocCreateIfNotExist = async (scope: Scope, modelClient: ModelClient, language: string, userId: string): Promise<any> => {
  var userDoc = await modelClient.userStorageCollections
    .get(language)
    ?.getById(scope, userId)
  if (userDoc === undefined) {
    console.log("Creating new user doc...")
    await modelClient.userStorageCollections
      .get(language)
      ?.createIfNotExists(scope, {
        _id: userId,
        current_intention: "",
        current_callgraph: {
          nodes: [],
          edges: [],
          schedule: [],
          current_step: -1,
        },
        shared_callgraph_output: [],
        history: [],
        bunny_mailbox: [],
        conversation_summary: "",
        ord: 0,
        listening: true,
        speaker: "female",
        user_name: "User",
        assistant_name: "Assistant",
        search_config: {
          location: "United States",
          hl: "en",
          google_domain: "google.com",
        },
      })
    userDoc = await modelClient.userStorageCollections
      .get(language)
      ?.getById(scope, userId)
  }
  return userDoc
}

/*
export const getContextCropIfTooLong = async (scope: Scope, userDoc: any, modelClient: ModelClient, language: string): Promise<string> => {
  // crop conversation_context and history to maximum 3000 messages, if either of them is longer than 3500 messages
  const conversationContext = userDoc.conversation_context
  const userHistory = userDoc.history
  const conversationContextLength = conversationContext.length
  const userHistoryLength = userHistory.length
  var conversationContext_ = []
  var userHistory_ = []
  console.log("conversationContextLength: ", conversationContextLength, "userHistoryLength: ", userHistoryLength)
  if (conversationContextLength > 3500) {
    console.log("conversationContextLength too long, cropping...")
    conversationContext_ = conversationContext.slice(0, 3000)
    // bulkMergeFields
    const userDoc_ = {
      _id: userDoc._id,
      conversation_context: conversationContext_,
    }
    await modelClient.userStorageCollections
      .get(language)
      ?.bulkMergeFields(scope, [userDoc_])
  } else {
    conversationContext_ = [...conversationContext]
  }
  if (userHistoryLength > 3500) {
    console.log("userHistoryLength too long, cropping...")
    userHistory_ = userHistory.slice(0, 3000)
    // bulkMergeFields
    const userDoc_ = {
      _id: userDoc._id,
      history: userHistory_,
    }
    await modelClient.userStorageCollections
      .get(language)
      ?.bulkMergeFields(scope, [userDoc_])
  } else {
    userHistory_ = [...userHistory]
  }

  const context = conversationContext_
    .slice(0, 300)
    .join("\n")

  return context
}
*/


export function wavToRaw(data: Uint8Array) {
  return new Promise((resolve, reject) => {
    try {
      const inputBufferStream = new Readable()
      inputBufferStream.push(data)
      inputBufferStream.push(null)

      const outputBufferStream = new PassThrough()

      let outputData = Buffer.alloc(0)

      outputBufferStream.on("data", (chunk) => {
        outputData = Buffer.concat([outputData, chunk])
      })

      outputBufferStream.on("end", () => {
        resolve(new Uint8Array(outputData))
      })

      ffmpeg(inputBufferStream)
        .inputFormat("wav")
        .audioFrequency(16000)
        .audioChannels(1)
        .outputFormat("s16le")
        .on("error", (err) => {
          console.error(err)
          reject(data)
        })
        .pipe(outputBufferStream)
    } catch (e) {
      console.error(e)
      reject(data)
    }
  })
}

export function formatDbMessage(speaker: string, message: string): string {
  const formattedTime = new Date().toUTCString()
  return `${speaker}:${message}[${formattedTime}]`
}
