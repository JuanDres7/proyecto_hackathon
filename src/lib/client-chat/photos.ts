import type { SupabaseClient } from "@supabase/supabase-js";

export async function storeComplaintPhoto(
  db: SupabaseClient,
  serviceNumber: string,
  dataUrl?: string | null,
): Promise<string | null> {
  if (!dataUrl?.startsWith("data:")) return null;
  const [meta, data] = dataUrl.split(",");
  if (!data) return null;
  const mime = meta.match(/data:(.*);base64/)?.[1] ?? "image/jpeg";
  const path = `quejas/${serviceNumber.replace("#", "")}-${Date.now()}`;
  const bytes = Buffer.from(data, "base64");
  const { error } = await db.storage.from("evidencias").upload(path, bytes, {
    contentType: mime,
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return path;
}

export async function signedPhotoUrl(db: SupabaseClient, path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await db.storage.from("evidencias").createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}
