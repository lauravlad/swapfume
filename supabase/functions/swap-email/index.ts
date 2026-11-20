// Swapfume — "You have a new swap / gift" email (Supabase Edge Function).
//
// Called by the proposer's browser right after they propose a swap or offer a gift.
// It emails the other member from "Swapfume <hello@swapfume.com>" through Resend, with what's
// offered/asked and a button to open the proposal. No addresses or other private details.
//
// Safety: claim_swap_email() (migration 022) runs as the proposer and allows one email per
// proposal, only for their own fresh proposal, and only if the recipient hasn't turned emails off.
//
// Secrets (Supabase → Edge Functions → Secrets): RESEND_API_KEY (a Resend key with sending access).
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
const SIZE: Record<string, string> = { sample: "Sample", decant: "Decant", full: "Full bottle" };

type Item = { from_user_id: string; size: string; volume_ml: number | null; quantity: number | null; perfume: { brand: string; name: string } | null };

function list(items: Item[]) {
  return items.map((i) => {
    const bits = [(i.quantity ?? 1) > 1 ? `${i.quantity} × ${SIZE[i.size] ?? i.size}` : SIZE[i.size] ?? i.size, i.volume_ml ? `${+i.volume_ml} ml` : ""].filter(Boolean).join(" · ");
    return `<li style="margin:0 0 8px"><b>${esc(i.perfume?.name)}</b> <span style="color:#7A6A63">${esc(i.perfume?.brand)} · ${esc(bits)}</span></li>`;
  }).join("");
}

function emailHtml(o: { title: string; intro: string; blocks: string; message: string; link: string; button: string }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(o.title)}</title></head>
<body style="margin:0;padding:0;background:#FAF6F1;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF6F1;padding:32px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border-radius:18px;border:1px solid #E7DCD2;">
<tr><td align="center" style="padding:32px 32px 8px;">
<img src="${SITE}icons/icon-192.png" width="56" height="56" alt="Swapfume" style="display:block;border:0;border-radius:14px;">
<div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;color:#2A211E;margin-top:12px;">Swapfume</div>
<div style="font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:15px;color:#8C3B4A;margin-top:2px;">Sharing is caring</div></td></tr>
<tr><td style="padding:16px 36px 4px;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;color:#2A211E;">
<h1 style="font-family:Georgia,'Times New Roman',serif;font-weight:normal;font-size:24px;margin:0 0 12px;">${esc(o.title)}</h1>
<p style="margin:0 0 14px">${o.intro}</p>${o.blocks}${o.message}</td></tr>
<tr><td align="center" style="padding:14px 36px 8px;">
<a href="${o.link}" style="display:inline-block;background:#8C3B4A;color:#FFFFFF;text-decoration:none;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;font-weight:600;padding:14px 28px;border-radius:999px;">${esc(o.button)}</a></td></tr>
<tr><td style="padding:12px 36px 28px;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;color:#7A6A63;">
<p style="margin:0">Swapfume never involves money. Never send payment or share your address outside Swapfume — addresses are shared in the app only after you both accept.</p></td></tr>
</table>
<p style="font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;color:#9A8A83;margin:16px 0 0;">You get this email because a member sent you a proposal on Swapfume.<br>Don't want these? Turn them off under <a href="${SITE}#/me" style="color:#8C3B4A;">Me</a> · <a href="mailto:hello@swapfume.com" style="color:#8C3B4A;">hello@swapfume.com</a></p>
</td></tr></table></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply(405, { error: "Use POST." });
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) return reply(503, { error: "Emails aren't set up yet." });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const asUser = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } }, auth: { persistSession: false } });
  const { data: { user }, error: userErr } = await asUser.auth.getUser();
  if (userErr || !user) return reply(401, { error: "Please sign in again." });

  let swapId = 0;
  try { swapId = Number((await req.json()).swap_id); } catch { /* handled below */ }
  if (!Number.isInteger(swapId) || swapId <= 0) return reply(400, { error: "Missing swap." });

  // One email per fresh proposal, only the proposer can ask, only if the recipient wants emails.
  const { data: recipientId, error: claimErr } = await asUser.rpc("claim_swap_email", { p_swap: swapId });
  if (claimErr) return reply(400, { error: claimErr.message });
  if (!recipientId) return reply(200, { sent: false });

  const admin = createClient(url, service, { auth: { persistSession: false } });
  const [{ data: swap }, { data: items }, { data: who }, { data: to }] = await Promise.all([
    admin.from("swaps").select("id, is_gift, method, message").eq("id", swapId).single(),
    admin.from("swap_items").select("from_user_id, size, volume_ml, quantity, perfume:perfumes(brand, name)").eq("swap_id", swapId),
    admin.from("profiles").select("display_name").eq("id", user.id).single(),
    admin.auth.admin.getUserById(recipientId as string),
  ]);
  const email = to?.user?.email;
  if (!swap || !email) return reply(200, { sent: false });

  const name = who?.display_name || "A Swapfume member";
  const all = (items ?? []) as unknown as Item[];
  const give = all.filter((i) => i.from_user_id === user.id), get = all.filter((i) => i.from_user_id !== user.id);
  const link = `${SITE}#/swap/${swapId}`;
  const meet = swap.method === "meetup" ? `<p style="margin:0 0 14px;color:#7A6A63">${esc(name)} suggests <b>meeting in person</b> — no addresses are shared.</p>` : "";
  const note = swap.message ? `<p style="margin:0 0 14px;padding:12px 14px;background:#F5E6E6;border-radius:12px;font-style:italic">“${esc(String(swap.message).slice(0, 400))}”</p>` : "";
  const box = (label: string, its: Item[]) => its.length ? `<p style="margin:0 0 6px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#A0782C">${label}</p><ul style="margin:0 0 14px;padding-left:18px">${list(its)}</ul>` : "";

  const subject = swap.is_gift ? `${name} wants to give you a gift 💐` : `${name} would like to swap with you 💐`;
  const html = swap.is_gift
    ? emailHtml({ title: "You've been offered a gift!", intro: `<b>${esc(name)}</b> would like to give you something from their collection — nothing asked in return.`, blocks: box("Their gift to you", give) + meet, message: note, link, button: "See the gift" })
    : emailHtml({ title: "You have a new swap proposal", intro: `<b>${esc(name)}</b> would like to swap with you on Swapfume.`, blocks: box("You'd receive", give) + box("You'd give", get) + meet, message: note, link, button: "See the proposal" });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Swapfume <hello@swapfume.com>", to: [email], subject, html, reply_to: "hello@swapfume.com" }),
  });
  if (!res.ok) return reply(502, { error: "The email couldn't be sent.", detail: (await res.text()).slice(0, 300) });
  return reply(200, { sent: true });
});
