import base64
import json
import uuid
import pyaudio
import websocket
from threading import Thread

SAMPLE_RATE = 16000
FRAMES_PER_BUFFER = 512
NUM_SECONDS = 1
NUM_CHANNELS = 1

# Initialize PyAudio
p = pyaudio.PyAudio()

# Create a WebSocket connection
ws = websocket.WebSocketApp("wss://cyberpunk.quantum-engine.ai/session")

print("----------------------record device list---------------------")
info = p.get_host_api_info_by_index(0)
numdevices = info.get("deviceCount")
for i in range(0, numdevices):
    if (p.get_device_info_by_host_api_device_index(0, i).get("maxInputChannels")) > 0:
        print(
            "Input Device id ",
            i,
            " - ",
            p.get_device_info_by_host_api_device_index(0, i).get("name"),
        )

print("-------------------------------------------------------------")

# Open the microphone stream
stream = p.open(
    format=pyaudio.paInt16,
    channels=NUM_CHANNELS,
    input_device_index=1,
    rate=SAMPLE_RATE,
    input=True,
    frames_per_buffer=FRAMES_PER_BUFFER,
)

_uuid = str(uuid.uuid4())


def record_audio():
    print("Recording...")
    frames = []
    for i in range(0, int(SAMPLE_RATE / FRAMES_PER_BUFFER * NUM_SECONDS)):
        data = stream.read(FRAMES_PER_BUFFER)
        frames.append(data)
    # print("Finished recording")

    # add WAV header to the audio
    audio_data = b"".join(frames)
    audio_data_size = len(audio_data)
    wav_bytes = (
        b"RIFF"
        + (audio_data_size + 36).to_bytes(4, "little")
        + b"WAVEfmt "
        + (16).to_bytes(4, "little")  # length of the following
        + (1).to_bytes(2, "little")  # PCM
        + (NUM_CHANNELS).to_bytes(2, "little")
        + (SAMPLE_RATE).to_bytes(4, "little")
        + (SAMPLE_RATE * NUM_CHANNELS * 2).to_bytes(4, "little")  # bytes per second
        + (NUM_CHANNELS * 2).to_bytes(2, "little")  # bytes per sample
        + (16).to_bytes(2, "little")  # bits per sample
        + b"data"
        + (audio_data_size).to_bytes(4, "little")
        + audio_data
    )

    # save the audio to a file
    # with open(f"{str(uuid.uuid4())}.wav", "wb") as f:
    #     f.write(wav_bytes)
    # Convert the audio to base64
    audio_base64bytes = base64.b64encode(wav_bytes)
    audio_str = audio_base64bytes.decode("utf-8")

    # Create a JSON message with the audio and a new UUID
    message = {
        "kernel": {
            "userAudio": {
                "audio": audio_str,
                "uuid": _uuid,
                "character": "Jack",
            }
        }
    }

    # Send the message over the WebSocket connection
    ws.send(json.dumps(message))


def on_message(ws, message):
    # Parse the incoming JSON message
    data = json.loads(message)

    try:
        # Extract the audio and utterance
        audio_str = data["kernel"]["audio"]
        utterance = data["kernel"]["utterance"]

        print(data["kernel"]["visemeAudioOffsets"])
        print(data["kernel"]["visemeIds"])
        # Print the utterance
        print("utterance: ", utterance)

        # Convert the base64 audio to bytes
        audio_bytes = base64.b64decode(audio_str)

        # Play the audio
        stream = p.open(
            format=pyaudio.paInt16, channels=NUM_CHANNELS, rate=SAMPLE_RATE, output=True
        )
        stream.write(audio_bytes)
    except Exception as e:
        print(e)
        print(data)


def on_open(ws):
    """
    {
        global: {
            initialize: {
                token: 4XPB0EP1DF92ZW06O2LUNZGE0TTTOFM0,
                language: en,
            },
        },
    }
    """
    # Create a JSON message with the audio and a new UUID
    message = {
        "global": {
            "initialize": {
                "token": "MSJC29VF0UCN6S1B3Q6B8UUVV4GO9TM8",
                "language": "en",
            }
        }
    }

    # Send the message over the WebSocket connection
    ws.send(json.dumps(message))

    return
    import time

    time.sleep(1)

    # Create a JSON message with the audio and a new UUID
    message = {
        "kernel": {
            "userText": {
                "text": "Hi, what's up?",
                "uuid": str(uuid.uuid4()),
                "character": "Jack",
            }
        }
    }

    # Send the message over the WebSocket connection
    ws.send(json.dumps(message))


# Set the callback for when a message is received
ws.on_message = on_message
ws.on_open = on_open

# Start a new thread for the WebSocket connection
ws_thread = Thread(target=ws.run_forever)
ws_thread.start()

try:
    # Record and send audio
    while True:
        record_audio()
except Exception as e:
    print(e)
    assert False

# Stop and close the stream
stream.stop_stream()
stream.close()
# Close the WebSocket connection and PyAudio when done
ws.close()
p.terminate()
