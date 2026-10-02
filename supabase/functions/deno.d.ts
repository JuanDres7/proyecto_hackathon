declare const Deno: {
  env: { get(name: string): string | undefined };
};

declare module "npm:@supabase/server@1" {
  export function withSupabase(
    options: { auth: "user" | "publishable" | "secret" | "none" },
    handler: (req: Request) => Response | Promise<Response>,
  ): (req: Request) => Promise<Response>;
}
