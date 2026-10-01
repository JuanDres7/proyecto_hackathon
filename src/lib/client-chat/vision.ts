import { askGemini } from "./gemini";

export async function comparePhoto(comment: string, photoDataUrl?: string | null): Promise<{
  visionValid: boolean | null;
  visionNote: string;
}> {
  if (!photoDataUrl) {
    return { visionValid: null, visionNote: "No se adjuntó foto." };
  }
  if (!comment.trim()) {
    return { visionValid: null, visionNote: "No hay texto que contrastar." };
  }
  const gemini = await askGemini(
    `¿La imagen corresponde al comentario del cliente? Responde JSON {"corresponds":true,"reason":"..."}. Comentario: ${comment}`,
    photoDataUrl,
  );
  if (!gemini.ok) {
    return { visionValid: null, visionNote: "No se pudo revisar la foto." };
  }
  const corresponds = Boolean(gemini.data.corresponds);
  const reason =
    typeof gemini.data.reason === "string"
      ? gemini.data.reason
      : corresponds
        ? "La foto corresponde al comentario."
        : "La foto no corresponde al comentario.";
  return { visionValid: corresponds, visionNote: reason };
}
