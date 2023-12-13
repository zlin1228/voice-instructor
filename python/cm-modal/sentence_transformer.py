import modal
from modal import Stub, web_endpoint
from typing import Dict

stub = Stub("sentence_transformer")

image = modal.Image.conda().conda_install("onnxruntime").pip_install("fast-sentence-transformers")

@stub.cls(image=image, cpu=8, retries=3, keep_warm=2)
class SentenceTransformerDeployment:
    def __enter__(self):
        from fast_sentence_transformers import FastSentenceTransformer as SentenceTransformer

        self.encoder = SentenceTransformer("all-MiniLM-L6-v2", device="cpu", quantize=True)

    def predict(self, text: str):
        pred = self.encoder.encode([text])[0]
        embedding = pred.tolist()
        return embedding
    
    @modal.method()
    def predict_fn(self, text: str):
        return self.predict(text)
    
    @modal.web_endpoint(method="POST")
    def predict_web(self, v: Dict):
        return self.predict(v["text"])