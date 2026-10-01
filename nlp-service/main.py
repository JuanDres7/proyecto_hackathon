from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="CampoSync NLP", version="0.1.0")

EXEMPLARS = {
    "inasistencia": [
        "el supervisor no llegó al centro de costo",
        "nadie se presentó a realizar el servicio",
        "estuvieron ausentes y no hubo visita",
    ],
    "calidad": [
        "dejaron el baño sucio y el trabajo incompleto",
        "la limpieza quedó mal hecha",
        "no terminaron las zonas que contratamos",
    ],
    "conducta": [
        "el trato del personal fue grosero",
        "hubo maltrato hacia quien recibió el servicio",
        "la conducta del supervisor fue irrespetuosa",
    ],
    "facturacion": [
        "el cobro no corresponde a lo acordado",
        "me están facturando de más",
        "el precio del servicio está mal",
    ],
    "seguridad": [
        "hubo un riesgo para las personas en el sitio",
        "faltaron elementos de seguridad durante el trabajo",
        "la situación en campo no era segura",
    ],
    "general": [
        "quiero dejar un comentario sobre el servicio",
        "tengo una observación general",
        "solo quiero registrar cómo nos fue",
    ],
}

_model = None
_vectors = None
_owners: list[str] = []


class ClassifyIn(BaseModel):
    text: str
    serviceNumber: str | None = None


def get_model():
    global _model, _vectors, _owners
    if _model is None:
        from sentence_transformers import SentenceTransformer

        _model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
        texts: list[str] = []
        owners: list[str] = []
        for label, phrases in EXEMPLARS.items():
            for phrase in phrases:
                texts.append(phrase)
                owners.append(label)
        _vectors = _model.encode(texts, normalize_embeddings=True)
        _owners = owners
    return _model


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/classify")
def classify(payload: ClassifyIn):
    model = get_model()
    query = model.encode([payload.text], normalize_embeddings=True)[0]
    scores = _vectors @ query
    best_by_label: dict[str, float] = {}
    for score, label in zip(scores, _owners):
        value = float(score)
        if label not in best_by_label or value > best_by_label[label]:
            best_by_label[label] = value
    label = max(best_by_label, key=best_by_label.get)
    return {
        "label": label,
        "confidence": best_by_label[label],
        "serviceNumber": payload.serviceNumber,
        "source": "sentence-transformers",
    }
