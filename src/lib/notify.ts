import { createAdminClient } from "@/lib/supabase/admin";

type PushSub = {
  endpoint: string;
  keys?: { p256dh: string; auth: string };
};

async function sendEmail(to: string, subject: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFY_FROM_EMAIL ?? "LimpiAPP <onboarding@resend.dev>";
  if (!key) return { ok: false as const, reason: "no_resend_key" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, text }),
  });
  if (!res.ok) return { ok: false as const, reason: await res.text() };
  return { ok: true as const };
}

async function sendWebPush(sub: PushSub, title: string, body: string) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const mailto = process.env.VAPID_MAILTO ?? "mailto:ops@limpiapp.local";
  if (!publicKey || !privateKey) return { ok: false as const, reason: "no_vapid" };
  const webpush = await import("web-push");
  webpush.setVapidDetails(mailto.startsWith("mailto:") ? mailto : `mailto:${mailto}`, publicKey, privateKey);
  await webpush.sendNotification(
    {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.keys?.p256dh ?? "", auth: sub.keys?.auth ?? "" },
    },
    JSON.stringify({ title, body }),
  );
  return { ok: true as const };
}

export async function dispatchAlert(opts: {
  title: string;
  body: string;
  recipientIds?: string[];
  extraEmail?: string | null;
}) {
  const admin = createAdminClient();
  const emails = new Set<string>();
  const inbox = process.env.COORDINATOR_ALERT_EMAIL;
  if (inbox) emails.add(inbox);
  if (opts.extraEmail) emails.add(opts.extraEmail);

  const recipients = [...(opts.recipientIds ?? [])];
  if (admin) {
    if (recipients.length === 0) {
      const { data: coords } = await admin.from("profiles").select("id").eq("role", "coordinador");
      recipients.push(...(coords ?? []).map((p) => p.id));
    }
    for (const id of recipients) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
      await admin.from("notifications").insert({
        recipient_id: isUuid ? id : null,
        channel: "in_app",
        title: opts.title,
        body: opts.body,
      });
      if (isUuid) {
        const { data: user } = await admin.auth.admin.getUserById(id);
        if (user.user?.email) emails.add(user.user.email);
        const { data: subs } = await admin.from("push_subscriptions").select("endpoint, p256dh, auth").eq("user_id", id);
        for (const s of subs ?? []) {
          try {
            await sendWebPush({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, opts.title, opts.body);
            await admin.from("notifications").insert({
              recipient_id: id,
              channel: "push",
              title: opts.title,
              body: opts.body,
            });
          } catch {
            /* expired subscription */
          }
        }
      }
    }
  }

  for (const to of emails) {
    const mail = await sendEmail(to, opts.title, opts.body);
    if (mail.ok && admin) {
      await admin.from("notifications").insert({
        recipient_id: recipients[0] ?? null,
        channel: "email",
        title: opts.title,
        body: `${opts.body} → ${to}`,
      });
    }
  }
}
