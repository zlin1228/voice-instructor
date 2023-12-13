import requests
import base64
  
url = 'https://us-central1.quantum-engine.ai/quantum-mock/mockEchoV1'

params = {
    "id": "id-1",
    "character": "Alice"
}

with open("sample.wav", "rb") as audio_pipe:
    encoded_string = base64.b64encode(audio_pipe.read())
    params["audio"] = "data:audio," + encoded_string.decode("utf-8")

r = requests.post(url=url, json=params)
data = r.json()

# Sample JSON response:
# {
#   "utterance": "xxx",
#   "person": "ppp",
#   "message": "mmm",
#   "flagged": false,
#   "audio": "data:audio,aabbccdd"
# }

print(data)
