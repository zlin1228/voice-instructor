import modal
from modal import Stub, web_endpoint
from api import _search
from typing import Dict

stub = Stub("scratch_dev")

image = modal.Image.debian_slim().pip_install(
    "boto3", "beautifulsoup4", "lxml", "fastapi", "starlette", "pymongo", "google-search-results", "openai"
)


@stub.function(image=image, cpu=1)
@web_endpoint(method="POST")
def search(v: Dict):
    return _search(v, "dev")