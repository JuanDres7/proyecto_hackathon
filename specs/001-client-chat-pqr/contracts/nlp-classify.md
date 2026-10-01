# Contract: clasificación NLP

Lo llama el servidor de Next.js. El navegador no lo llama.

`POST {NLP_SERVICE_URL}/classify`

El contenedor publica el puerto 8000. En local, `npm run nlp` levanta el servicio definido en `docker-compose.yml`.

## Request

```json
{
  "text": "comentario del cliente en español",
  "serviceNumber": "#1042"
}
```

`text` no se envía vacío. Si el comentario está vacío, Next.js asigna `general` con certeza 100 y no llama a este contrato.

## Response

```json
{
  "label": "inasistencia | calidad | conducta | facturacion | seguridad | general",
  "confidence": 0.82,
  "serviceNumber": "#1042",
  "source": "sentence-transformers"
}
```

`confidence` es una similitud entre 0 y 1. La ficha del coordinador la muestra como porcentaje 0–100.

## Failure

Si el contenedor no responde, Next.js guarda `label: "pending"` y `confidence: null`. La evaluación y, si aplica, el caso de prioridad alta se guardan igual.

## Health

`GET {NLP_SERVICE_URL}/health` responde `{ "ok": true }`. El quickstart lo usa antes de probar una evaluación con comentario.
