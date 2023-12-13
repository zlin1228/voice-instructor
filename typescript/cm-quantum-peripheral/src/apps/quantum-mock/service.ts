import { Scope } from "base-core/lib/scope.js"
import { QuantumMockHttpService } from "./apis/schema.js"
import { stringHasher } from "base-core/lib/data-structures.js"
import {
  stringCutFirst,
  stringSplitToVector,
  stringToInt,
} from "base-core/lib/string.js"
import { readBytesFile, readTextFile } from "base-node/lib/file.js"
import { bytesToBase64 } from "base-core/lib/data.js"
import { arraySplitToChunks } from "base-core/lib/array.js"
import { abortIfUndefined } from "base-core/lib/debug.js"
import { readGcsBytesFile, readGcsTextFile } from "base-gcp/lib/gcs.js"

export async function buildQuantumMockHttpService(
  scope: Scope,
  config: {}
): Promise<QuantumMockHttpService> {
  return {
    post_mockEchoV1: async (scope, request) => {
      return {
        utterance: `id=${request.id} character=${
          request.character ?? "unknown"
        }`,
        person: "sample-person",
        message: "sample-messge",
        flagged: false,
        audio: request.audio,
      }
    },
    get_mockRadioPopularityV1: async (scope, request) => {
      const keywords = request.keywords.split(",")
      return {
        exec_time_ms: 0,
        message: "",
        data: Object.fromEntries(
          keywords.map((keyword) => [
            keyword,
            Math.max(
              0,
              (Math.floor(Math.abs(stringHasher(keyword))) % 200) - 100
            ),
          ])
        ),
        code: 0,
        server_time: Math.floor(Date.now() / 1000),
      }
    },
    post_mockRadioAudioV1: async (scope, request) => {
      const next_id =
        (stringToInt(request.next_id ?? "") ??
          Math.floor(Math.random() * 10000)) + 1
      const question_text =
        request.question === undefined ? undefined : "fake-question-text"
      const audioBytes = await readBytesFile("quantum-mock/speech-short.aac")
      return {
        exec_time_ms: 0,
        message: "",
        data: {
          next_id: next_id.toString(),
          question_text,
          answer_audio_url: `data:audio/aac;base64,${bytesToBase64(
            audioBytes
          )}`,
          answer_audio_texts: [
            { offset_ms: 0, text: "This is the first line" },
            { offset_ms: 2000, text: "The second line comes here" },
            { offset_ms: 6000, text: `The current next_id is ${next_id}` },
          ],
        },
        code: 0,
        server_time: Math.floor(Date.now() / 1000),
      }
    },
    post_mockRadioAudioV11: async (scope, request) => {
      const next_id =
        (stringToInt(request.next_id ?? "") ??
          Math.floor(Math.random() * 10000)) + 1
      const question_text =
        request.question === undefined ? undefined : "fake-question-text"
      const audioBytes = await readGcsBytesFile(
        scope,
        "gs://quantum-engine-public/quantum-peripheral/mock/BBC World Service_BBC News Summary__28032023_0330.aac"
      )
      const textsBytes = await readGcsTextFile(
        scope,
        "gs://quantum-engine-public/quantum-peripheral/mock/BBC World Service_BBC News Summary__28032023_0330.srt"
      )
      const lines = textsBytes.split("\n")
      const answer_audio_texts = arraySplitToChunks(lines, 4).map(
        (sentence) => {
          const timestamp = abortIfUndefined(
            stringCutFirst(abortIfUndefined(sentence[1]), " ")
          )[0]
          const timeParts = abortIfUndefined(
            stringSplitToVector(timestamp, ":", 3)
          )
          const secParts = abortIfUndefined(
            stringSplitToVector(timeParts[2], ",", 2)
          )
          const h = abortIfUndefined(stringToInt(timeParts[0]))
          const m = abortIfUndefined(stringToInt(timeParts[1]))
          const s = abortIfUndefined(stringToInt(secParts[0]))
          const ms = abortIfUndefined(stringToInt(secParts[1]))
          const offset_ms = ((h * 60 + m) * 60 + s) * 1000 + ms
          const text = abortIfUndefined(sentence[2])
          return { offset_ms, text }
        }
      )
      return {
        exec_time_ms: 0,
        message: "",
        data: {
          next_id: next_id.toString(),
          question_text,
          answer_audio_url: `data:audio/aac;base64,${bytesToBase64(
            audioBytes
          )}`,
          answer_audio_texts,
        },
        code: 0,
        server_time: Math.floor(Date.now() / 1000),
      }
    },
    post_mockRadioAudioV12: async (scope, request) => {
      const next_id =
        (stringToInt(request.next_id ?? "") ??
          Math.floor(Math.random() * 10000)) + 1
      const question_text =
        request.question === undefined ? undefined : "fake-question-text"
      const ask = request.question ?? request.subjects?.join(",") ?? "(default)"
      const hash = stringHasher(ask)
      const audioIdx = (Math.abs(hash) % 8) + 1
      const audioBytes = await readGcsBytesFile(
        scope,
        `gs://quantum-engine-public/quantum-peripheral/mock/BBC World Service_BBC News Summary/${audioIdx}.aac`
      )
      const textsBytes = await readGcsTextFile(
        scope,
        `gs://quantum-engine-public/quantum-peripheral/mock/BBC World Service_BBC News Summary/${audioIdx}.srt`
      )
      const lines = textsBytes.split("\n")
      const answer_audio_texts = arraySplitToChunks(lines, 4).map(
        (sentence) => {
          const timestamp = abortIfUndefined(
            stringCutFirst(abortIfUndefined(sentence[1]), " ")
          )[0]
          const timeParts = abortIfUndefined(
            stringSplitToVector(timestamp, ":", 3)
          )
          const secParts = abortIfUndefined(
            stringSplitToVector(timeParts[2], ",", 2)
          )
          const h = abortIfUndefined(stringToInt(timeParts[0]))
          const m = abortIfUndefined(stringToInt(timeParts[1]))
          const s = abortIfUndefined(stringToInt(secParts[0]))
          const ms = abortIfUndefined(stringToInt(secParts[1]))
          const offset_ms = ((h * 60 + m) * 60 + s) * 1000 + ms
          const text = abortIfUndefined(sentence[2])
          return { offset_ms, text }
        }
      )
      return {
        exec_time_ms: 0,
        message: "",
        data: {
          next_id: next_id.toString(),
          question_text,
          answer_audio_url: `data:audio/aac;base64,${bytesToBase64(
            audioBytes
          )}`,
          answer_audio_texts,
        },
        code: 0,
        server_time: Math.floor(Date.now() / 1000),
      }
    },
  }
}
