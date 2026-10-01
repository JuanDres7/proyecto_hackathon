from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="CampoSync NLP", version="0.1.0")

LABELS = [
    "inasistencia",
    "calidad",
    "conducta",
    "facturacion",
    "seguridad",
    "general",
]

_model = None


class ClassifyIn(BaseModel):
    text: str
    serviceNumber: str | None = None


def get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer

        _model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
    return _model


def embed_labels(model):
    return model.encode(LABELS, normalize_embeddings=True)


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/classify")
def classify(payload: ClassifyIn):
    model = get_model()
    import numpy as np

    vectors = embed_labels(model)
    query = model.encode([payload.text], normalize_embeddings=True)[0]
    scores = vectors @ query
    idx = int(np.argmax(scores))
    return {
        "label": LABELS[idx],
        "confidence": float(scores[idx]),
        "serviceNumber": payload.serviceNumber,
        "source": "sentence-transformers",
    }
