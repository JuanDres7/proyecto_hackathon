import { askGemini } from "./gemini";

export async function dissatisfactionSummary(input: {
  rating: number;
  comment: string;
  label: string;
}): Promise<string> {
  const fallback = input.comment.trim()
    ? `Calificación ${input.rating} de 5. ${input.comment.trim()}`
    : `Calificación ${input.rating} de 5, sin comentario.`;
  const gemini = await askGemini(
    `Resume en español, en máximo dos oraciones, la insatisfacción del cliente. No inventes hechos que no estén en el texto. Calificación: ${input.rating}. Clase: ${input.label}. Comentario: ${input.comment || "sin comentario"}. JSON {"reply":"..."}.`,
  );
  if (!gemini.ok || !gemini.data.reply) return fallback;
  return gemini.data.reply;
}
