# Contract: conversación del cliente

`POST /api/client-chat`

El navegador solo habla con esta ruta. No llama a Gemini ni al contenedor NLP.

## Request

```json
{
  "draftId": "uuid, obligatorio en cotización antes de tener código",
  "serviceNumber": "#1042 o null",
  "phase": "cotizacion | progreso | finalizacion",
  "message": "texto del cliente",
  "confirmation": "yes | no | null",
  "cancellationReason": "data_error | plans_changed | too_expensive | other | null",
  "rating": 1,
  "photoDataUrl": "data:image/... o null"
}
```

`rating` solo se envía en finalización. `cancellationReason` solo al cancelar.

## Response

```json
{
  "draftId": "uuid",
  "serviceNumber": "#1042 o null",
  "phase": "cotizacion | progreso | finalizacion",
  "reply": "texto en español",
  "canEdit": true,
  "canCancel": true,
  "progress": "asignado | en_camino | check_in | en_ejecucion | pausa_novedad | finalizado | pendiente_sincronizacion | null",
  "evaluationSaved": false,
  "pqrOpened": false
}
```

## Rules

- `confirmation: "yes"` con datos incompletos no crea código. La respuesta pide el dato que falta.
- `confirmation: "yes"` con datos completos crea un solo `serviceNumber`. Repetir la llamada devuelve el mismo número.
- `confirmation: "no"` no crea código.
- Si `en_route_at` está puesto, `canEdit` y `canCancel` son `false` y un intento de editar o cancelar responde que ya no es posible.
- Cancelar sin `cancellationReason` no cambia el estado.
- En `progreso`, `reply` sale de la plantilla del estado derivado. No se pide a Gemini que invente el estado.
- En `finalizacion`, guardar la evaluación pone `evaluationSaved: true`. Si `rating` es 1 o 2, `pqrOpened: true`.
- Si Gemini no está disponible durante la cotización, no hay `serviceNumber` nuevo y `reply` explica que no se pudo completar.
- Código desconocido o cancelado: `progress` null y `reply` dice que no hay un servicio activo.
