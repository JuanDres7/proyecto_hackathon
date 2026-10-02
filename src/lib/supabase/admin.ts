import { createClient } from "@supabase/supabase-js";

function usable(value: string | undefined) {
  const v = value?.trim() ?? "";
  if (!v || v.includes("replace-with")) return "";
  return v;
}

export function createAdminClient() {
  const url = usable(process.env.NEXT_PUBLIC_SUPABASE_URL) || usable(process.env.SUPABASE_URL);
  const key = usable(process.env.SUPABASE_SECRET_KEY) || usable(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function withAdminTimeout<T>(promise: PromiseLike<T>, ms = 2000): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), ms);
      }),
    ]);
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
