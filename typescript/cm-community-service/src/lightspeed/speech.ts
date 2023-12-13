import { NpcSetting } from "cm-community-common/lib/schema/lightspeed.js"
import { SpeechProfile } from "cm-community-common/lib/schema/speech.js"

// Microsoft voice gallery:
// https://speech.microsoft.com/portal/voicegallery

export function npcToSpeechProfile(
  worldId: string,
  npcId: string,
  npc: NpcSetting
): SpeechProfile {
  if (npc.gender === "F") {
    if (npc.age <= 30) {
      return {
        worldId,
        npcId,
        provider: "azure",
        voiceId: "zh-CN-XiaoxiaoNeural",
      }
    } else {
      return {
        worldId,
        npcId,
        provider: "azure",
        voiceId: "zh-CN-XiaoqiuNeural",
      }
    }
  } else {
    if (npc.age <= 30) {
      return {
        worldId,
        npcId,
        provider: "azure",
        voiceId: "zh-CN-YunxiNeural",
      }
    } else if (npc.age <= 60) {
      return {
        worldId,
        npcId,
        provider: "azure",
        voiceId: "zh-CN-YunjianNeural",
      }
    } else {
      return {
        worldId,
        npcId,
        provider: "azure",
        voiceId: "zh-CN-YunyeNeural",
      }
    }
  }
}
