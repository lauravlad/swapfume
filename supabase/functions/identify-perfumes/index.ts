// Swapfume — "Take a photo": identify perfume bottles in a picture (Supabase Edge Function).
//
// The member sends one photo (a shelf, a few bottles, or a single bottle). Claude reads the
// labels and returns the perfumes it can see; the website then matches them to the catalog
// and shows the usual "Check your matches" screen, so nothing is added without the member's OK.
//
// Why a function: the Anthropic API key must never be in the website. It is stored as a
// Supabase secret (ANTHROPIC_API_KEY) and only this function on Supabase's servers can read it.
// The photo is not stored anywhere by Swapfume.
//
// Cost control: each member can identify at most 10 photos a day (use_ai_photo(), migration 021).
//
// Deploy: Supabase dashboard → Edge Functions → Deploy a new function → "identify-perfumes",
// paste this file, deploy. Then Edge Functions → Secrets → add ANTHROPIC_API_KEY.
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const SCHEMA = {
  type: "object",
  properties: {
    perfumes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          brand: { type: "string" },
          name: { type: "string" },
          concentration: { type: "string" },
          size: { type: "string", enum: ["sample", "decant", "full", "unknown"] },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
        required: ["brand", "name", "concentration", "size", "confidence"],
        additionalProperties: false,
      },
    },
  },
  required: ["perfumes"],
  additionalProperties: false,
};

const PROMPT = `This photo was taken by a member of a perfume-swapping community to add their perfumes to their collection.
List every distinct perfume you can identify: full bottles, decants (small spray bottles) and samples (tiny vials).
- Read the labels. Give the brand and the perfume name as printed (for example brand "Maison Francis Kurkdjian", name "Baccarat Rouge 540").
- concentration: what the label says (Eau de Parfum, Eau de Toilette, Extrait de Parfum, Parfum, Eau de Cologne), or "" if you can't read it.
- size: "full" for an original retail bottle, "decant" for a small refillable spray, "sample" for a tiny vial, "unknown" if unclear.
- confidence: "high" when the label is clearly readable, "medium" when you recognise the bottle but can't read everything, "low" when it's a guess.
- List each perfume once, even if there are several of the same. Skip anything you can't identify at all, and anything that isn't perfume.
If there is no perfume in the photo, return an empty list.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply(405, { error: "Use POST." });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!Deno.env.get("ANTHROPIC_API_KEY")) return reply(503, { error: "Photo recognition isn't set up yet." });

  // Act as the member, so the database checks who is asking and counts their daily photos.
  const asUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const { data: { user }, error: userErr } = await asUser.auth.getUser();
  if (userErr || !user) return reply(401, { error: "Please sign in again, then try once more." });

  let body: { image?: string; media_type?: string };
  try { body = await req.json(); } catch { return reply(400, { error: "Send the photo as JSON." }); }
  const image = String(body.image ?? "").replace(/^data:image\/\w+;base64,/, "");
  const mediaType = body.media_type === "image/png" ? "image/png" : "image/jpeg";
  if (!image || image.length > 7_000_000) return reply(400, { error: "That photo is missing or too big." });

  const { error: limitErr } = await asUser.rpc("use_ai_photo");
  if (limitErr) return reply(429, { error: limitErr.message });

  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the function's secrets
  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
          { type: "text", text: PROMPT },
        ],
      }],
    });
    if (response.stop_reason === "refusal") return reply(422, { error: "We couldn't read this photo. Try another one." });
    const text = response.content.find((b) => b.type === "text");
    const parsed = text && text.type === "text" ? JSON.parse(text.text) : { perfumes: [] };
    return reply(200, { perfumes: Array.isArray(parsed.perfumes) ? parsed.perfumes.slice(0, 60) : [] });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return reply(429, { error: "Lots of photos right now. Please try again in a minute." });
    if (e instanceof Anthropic.APIError) return reply(502, { error: "Photo recognition is having trouble. Please try again later." });
    return reply(500, { error: "Something went wrong reading the photo." });
  }
});
