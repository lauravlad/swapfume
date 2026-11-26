// Swapfume — "Here's what you missed" activity email (Supabase Edge Function).
//
// Called by a member's browser right after they do something that notifies someone else
// (a message, a comment, a friend request, a swap update, a review, a meetup comment...).
// claim_activity_emails() (migration 027) runs as that member and decides who gets an email:
// only people they just notified, who still haven't seen it, want these emails, and haven't
// had one in the last 30 minutes. Each of them gets ONE email listing their unread activity.
// Likes are never emailed; new proposals and gifts have their own email (swap-email).
//
// Secrets (Supabase → Edge Functions → Secrets): RESEND_API_KEY (the same one swap-email uses).
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided automatically.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SITE = "https://swapfume.com/";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

type N = { actor_id?: string | null; kind: string; detail: string; post_id: number | null; swap_id: number | null; thread_id: number | null; event_id: number | null; circle_id: number | null; created_at: string; actor: { display_name: string } | null };

// Wording and link for each kind (kept in step with js/app.js → NOTIF_TEXT).
function line(n: N) {
  const who = `<b>${esc(n.actor?.display_name || "A member")}</b>`;
  const quote = n.detail ? ` <span style="color:#7A6A63">“${esc(n.detail.slice(0, 90))}”</span>` : "";
  const T: Record<string, [string, string]> = {
    message: [`${who} sent you a message${quote}`, n.thread_id ? `#/chat/${n.thread_id}` : "#/messages"],
    comment: [`${who} commented on your post${quote}`, `#/post/${n.post_id}`],
    also_commented: [`${who} also commented on a post you joined${quote}`, `#/post/${n.post_id}`],
    friend_request: [`${who} sent you a friend request`, "#/friends"],
    friend_accept: [`${who} accepted your friend request`, "#/friends"],
    swap_accepted: [`${who} accepted your swap 🎉`, `#/swap/${n.swap_id}`],
    swap_declined: [`${who} declined your swap`, `#/swap/${n.swap_id}`],
    swap_cancelled: [`${who} cancelled a swap`, `#/swap/${n.swap_id}`],
    swap_shipped: [`${who} shipped their side of your swap 📦`, `#/swap/${n.swap_id}`],
    swap_received: [`${who} received your package`, `#/swap/${n.swap_id}`],
    swap_completed: [`Your swap with ${who} is complete — leave a review?`, `#/swap/${n.swap_id}`],
    review: [`${who} left you a review${quote}`, `#/me`],
    meetup_join: [`${who} is coming to your meetup`, `#/meetup/${n.event_id}`],
    meetup_comment: [`${who} commented on a meetup${quote}`, `#/meetup/${n.event_id}`],
    meetup_cancelled: [`${who} cancelled a meetup you joined${quote}`, `#/meetup/${n.event_id}`],
    circle_join: [`${who} joined your pass-around or giveaway${quote}`, `#/circle/${n.circle_id}`],
    circle_started: [`${who} started the pass-around. You're on the route!${quote}`, `#/circle/${n.circle_id}`],
    circle_turn: [`${who} sent the pass-around bottle on to you 📦${quote}`, `#/circle/${n.circle_id}`],
    circle_moved: [`${who} received your pass-around bottle${quote}`, `#/circle/${n.circle_id}`],
    circle_won: [`${who} drew you as a winner of their giveaway! 🎁${quote}`, `#/circle/${n.circle_id}`],
    circle_cancelled: [`${who} cancelled a pass-around or giveaway you joined${quote}`, `#/circle/${n.circle_id}`],
    invite_joined: [`${who} joined Swapfume with your invite! You're now friends 💐`, `#/u/${n.actor_id}`],
    reply: [`${who} replied to your comment${quote}`, `#/post/${n.post_id}`],
    mention: [`${who} mentioned you${quote}`, `#/post/${n.post_id}`],
    claim_opened: [`${who} opened a claim on a swap (a package problem)`, `#/swap/${n.swap_id}`],
    claim_resolved: [`${who} closed a claim on your swap${quote}`, `#/swap/${n.swap_id}`],
  };
  const [text, link] = T[n.kind] ?? [`${who} did something on Swapfume`, "#/notifications"];
  return `<li style="margin:0 0 12px"><a href="${SITE}${link}" style="color:#2A211E;text-decoration:none">${text}</a></li>`;
}

function emailHtml(items: string, more: number) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>New on Swapfume</title></head>
<body style="margin:0;padding:0;background:#FAF6F1;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF6F1;padding:32px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border-radius:18px;border:1px solid #E7DCD2;">
<tr><td align="center" style="padding:32px 32px 8px;">
<img src="${SITE}icons/icon-192.png" width="56" height="56" alt="Swapfume" style="display:block;border:0;border-radius:14px;">
<div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;color:#2A211E;margin-top:12px;">Swapfume</div>
<div style="font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:15px;color:#8C3B4A;margin-top:2px;">Sharing is caring</div></td></tr>
<tr><td style="padding:16px 36px 4px;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;color:#2A211E;">
<h1 style="font-family:Georgia,'Times New Roman',serif;font-weight:normal;font-size:24px;margin:0 0 14px;">New on Swapfume</h1>
<ul style="margin:0 0 8px;padding-left:18px">${items}</ul>
${more > 0 ? `<p style="margin:0 0 8px;color:#7A6A63">…and ${more} more.</p>` : ""}</td></tr>
<tr><td align="center" style="padding:14px 36px 28px;">
<a href="${SITE}#/notifications" style="display:inline-block;background:#8C3B4A;color:#FFFFFF;text-decoration:none;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;font-weight:600;padding:14px 28px;border-radius:999px;">Open Swapfume</a></td></tr>
</table>
<p style="font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;color:#9A8A83;margin:16px 0 0;">You get at most one of these every 30 minutes, only for things you haven't seen yet.<br>Don't want them? Turn them off under <a href="${SITE}#/me" style="color:#8C3B4A;">Me</a> · <a href="mailto:hello@swapfume.com" style="color:#8C3B4A;">hello@swapfume.com</a></p>
</td></tr></table></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply(405, { error: "Use POST." });
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) return reply(503, { error: "Emails aren't set up yet." });

  const url = Deno.env.get("SUPABASE_URL")!;
  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } }, auth: { persistSession: false } });
  const { data: { user }, error: userErr } = await asUser.auth.getUser();
  if (userErr || !user) return reply(401, { error: "Please sign in again." });

  const { data: ids, error } = await asUser.rpc("claim_activity_emails");
  if (error) return reply(400, { error: error.message });
  const recipients = (ids ?? []) as string[];
  if (!recipients.length) return reply(200, { sent: 0 });

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  let sent = 0;
  for (const rid of recipients) {
    const [{ data: rows }, { data: to }] = await Promise.all([
      admin.from("notifications")
        .select("kind, actor_id, detail, post_id, swap_id, thread_id, event_id, circle_id, created_at, actor:profiles!notifications_actor_id_fkey(display_name)")
        .eq("user_id", rid).is("read_at", null).neq("kind", "like").order("created_at", { ascending: false }).limit(30),
      admin.auth.admin.getUserById(rid),
    ]);
    const email = to?.user?.email;
    const list = (rows ?? []) as unknown as N[];
    if (!email || !list.length) continue;
    const first = list[0];
    const subject = list.length === 1
      ? `${first.actor?.display_name || "A member"} ${first.kind === "message" ? "sent you a message" : "has news for you"} on Swapfume`
      : `You have ${list.length} new things on Swapfume 💐`;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "Swapfume <hello@swapfume.com>", to: [email], subject, html: emailHtml(list.slice(0, 8).map(line).join(""), list.length - 8), reply_to: "hello@swapfume.com" }),
    });
    if (res.ok) sent++;
  }
  return reply(200, { sent });
});
