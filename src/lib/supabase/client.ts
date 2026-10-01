import { createBrowserClient } from "@supabase/ssr";

function publishableKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ""
  );
}

export function isSupabaseConfigured() {
  const key = publishableKey();
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && key && !key.includes("replace-with"),
  );
}

export function createClient() {
  if (!isSupabaseConfigured()) return null;
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, publishableKey());
}
