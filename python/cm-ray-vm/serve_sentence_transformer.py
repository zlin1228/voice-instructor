import requests
from starlette.requests import Request
from typing import Dict

# from sentence_transformers import SentenceTransformer
from fast_sentence_transformers import FastSentenceTransformer as SentenceTransformer

from ray import serve


# 1: Wrap the pretrained model in a Serve deployment.
@serve.deployment(route_prefix="/",
                  ray_actor_options={"num_cpus": 4},
                  num_replicas=7)
class SentenceTransformerDeployment:
    def __init__(self):
        self._model = SentenceTransformer("all-MiniLM-L6-v2", device="cpu", quantize=True)
        # SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')

    def __call__(self, request: Request) -> Dict:
        return self._model(request.query_params["text"])[0].tolist()


app = SentenceTransformerDeployment.bind()

# 2: Deploy the deployment.
serve.run(SentenceTransformerDeployment.bind())

# 3: Query the deployment and print the result.
import time

start_time = time.time()
res = requests.get(
    "http://localhost:8000/", params={"text": "Ray Serve is great!"}
).json()
end_time = time.time()
print(f"Time to run: {end_time - start_time} seconds")
print(res)