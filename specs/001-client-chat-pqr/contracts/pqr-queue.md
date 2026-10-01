# Contract: cola PQR del coordinador

`GET /api/pqr`

Solo la usa la interfaz del coordinador. No devuelve indicadores de operación normal ni novedades de campo.

## Response

```json
{
  "cases": [
    {
      "serviceNumber": "#1042",
      "priority": "alta",
      "rating": 2,
      "comment": "texto",
      "photoUrl": "url firmada o null",
      "label": "calidad",
      "confidencePercent": 82,
      "vision": "corresponde | no_corresponde | sin_foto | sin_texto",
      "summary": "resumen en español",
      "openedAt": "2026-10-01T16:00:00.000Z"
    }
  ]
}
```

## Rules

- La lista solo incluye casos abiertos por la regla de menos de 3 estrellas.
- `label: "pending"` se muestra como clasificación pendiente, no como una clase de negocio.
- Esta ruta no crea ni cierra novedades de campo y no calcula promedios de cumplimiento.
