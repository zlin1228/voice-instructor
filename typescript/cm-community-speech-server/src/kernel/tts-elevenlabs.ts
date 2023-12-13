import { Scope, launchBackgroundScope } from "base-core/lib/scope.js"
import { azure_to_oculus } from "./viseme.js"

export interface SpeechSegment {
  data: string
  duration: number
  visemeAudioOffsets: number[]
  visemeIds: string[]
}

import azureSpeechSdk, {
  SpeechSynthesisOutputFormat,
} from "microsoft-cognitiveservices-speech-sdk"

const azureSubscriptionKey = "fce543c254dd46fe97fbdc6f2e515ed0"
const azureRegion = "westus"

const azureSpeechConfig = azureSpeechSdk.SpeechConfig.fromSubscription(
  azureSubscriptionKey,
  azureRegion
)
azureSpeechConfig.speechSynthesisOutputFormat =
  SpeechSynthesisOutputFormat.Raw16Khz16BitMonoPcm
azureSpeechConfig.speechSynthesisVoiceName = "en-US-SaraNeural"

const synthesizer = new azureSpeechSdk.SpeechSynthesizer(
  azureSpeechConfig,
  undefined
)

import axios from 'axios';
import ffmpeg from 'fluent-ffmpeg';
import { Readable, PassThrough } from "stream"

// It fails if we set Error.stackTraceLimit (???)

export async function elevenlabsTextToSpeech(
  scope: Scope,
  text: string,
  language: string,
  voiceId: string,
): Promise<SpeechSegment> {
  
  console.log("Voice ID: " + voiceId)
  const apiKey = "4db5e5935ff579e15157f99a6fd80833";

  const response = await axios.post(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?optimize_streaming_latency=3`,
    {
      text: text,
      model_id: 'eleven_monolingual_v1',
    },
    {
      headers: {
        accept: 'audio/mpeg',
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      responseType: 'arraybuffer',
    },
  );

  const audioBuffer = Buffer.from(response.data, 'binary');
  const readable = new Readable();
  readable.push(audioBuffer);
  readable.push(null);

  const outputData = await new Promise((resolve, reject) => {

    const outputBufferStream = new PassThrough()

    let outputData = Buffer.alloc(0)

    outputBufferStream.on("data", (chunk) => {
      outputData = Buffer.concat([outputData, chunk])
    })

    outputBufferStream.on("end", () => {
      resolve(new Uint8Array(outputData))
    })
    
    ffmpeg(readable)
      .audioFrequency(16000)
      .audioChannels(1)
      .outputFormat('s16le')
      .on('end', resolve)
      .on('error', reject)
      .pipe(outputBufferStream);
  });

  // since we know that the bytes are in s16le format, we can calculate the duration
  // @ts-ignore
  const audioDuration = outputData.length / 2 / 16000;
  // this is the duration in seconds

  // get responseBase64 from outputData
  // @ts-ignore
  const responseBase64 = Buffer.from(outputData).toString('base64');

  // const responseBase64 = fs.readFileSync(outputFileName).toString('base64');

  return {
    data: responseBase64,
    duration: audioDuration,
    visemeAudioOffsets: [],
    visemeIds: [],
  };

}
