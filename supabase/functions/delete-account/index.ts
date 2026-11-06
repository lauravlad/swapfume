// Swapfume — "Delete my account" (Supabase Edge Function).
//
// Why a function: removing a login needs the project's service-role key,
// which must never be in the website. This runs on Supabase's servers,
// where that key is provided automatically.
//
// What it does, for the signed-in member who calls it:
//   1. delete_my_account()  (migration 008) — refuses if a swap is in progress,
//      withdraws open proposals, deletes listings, wishlist, address, blocks.
//   2. Deletes their photos in the bottle-photos bucket (except any photo an
//      admin set as a catalog picture).
//   3. Deletes their login. That removes the profile; completed swaps and the
//      reviews they wrote stay, shown as "Former member".
//
// Deploy (once):  supabase functions deploy delete-account --project-ref <your-ref>
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply(405, { error: "Use POST." });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";

  // Act as the member first, so the database checks who is asking.
  const asUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const { data: { user }, error: userErr } = await asUser.auth.getUser();
  if (userErr || !user) return reply(401, { error: "Please sign in again, then try once more." });

  const { error: rpcErr } = await asUser.rpc("delete_my_account");
  if (rpcErr) return reply(400, { error: rpcErr.message });

  const admin = createClient(url, service, { auth: { persistSession: false } });

  // Photos: everything in bottle-photos/<user id>/, except catalog pictures.
  const bucket = admin.storage.from("bottle-photos");
  const { data: keep } = await admin.from("perfumes").select("image_url").like("image_url", `%/bottle-photos/${user.id}/%`);
  const keepNames = new Set((keep ?? []).map((r) => String(r.image_url).split("/").pop()));
  let skip = 0; // files kept on purpose stay at the start of the listing
  for (;;) {
    const { data: files, error } = await bucket.list(user.id, { limit: 100, offset: skip, sortBy: { column: "name", order: "asc" } });
    if (error) return reply(500, { error: "Could not remove your photos. Please contact support." });
    if (!files?.length) break;
    const kept = files.filter((f) => keepNames.has(f.name)).length;
    const remove = files.filter((f) => !keepNames.has(f.name)).map((f) => `${user.id}/${f.name}`);
    if (remove.length) {
      const { error: rmErr } = await bucket.remove(remove);
      if (rmErr) return reply(500, { error: "Could not remove your photos. Please contact support." });
    }
    skip += kept;
    if (files.length < 100 && !remove.length) break;
  }

  const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
  if (delErr) return reply(500, { error: "Your data was removed but the login could not be deleted. Please contact support." });

  return reply(200, { ok: true });
});
