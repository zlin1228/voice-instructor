import { Scope, launchBackgroundScope } from "base-core/lib/scope.js"

export interface SpeechSegment {
  data: string
  duration: number
}

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

  // get responseBase64 from outputData
  // @ts-ignore
  const responseBase64 = Buffer.from(outputData).toString('base64');

  // const responseBase64 = fs.readFileSync(outputFileName).toString('base64');

  return {
    data: responseBase64,
    duration: audioDuration
  };

}
