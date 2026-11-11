/*
  REAL data layer: talks to your Supabase project. Same functions as api-demo.js.
  Used automatically when SUPABASE_URL and SUPABASE_ANON_KEY are set in js/config.js.
*/
(function () {
  window.makeSupabaseApi = function (url, key) {
    const sb = window.supabase.createClient(url, key);
    let uid = null, recovering = false;
    const listeners = [];
    const fail = (m) => { throw new Error(m); };
    // Turn database error text into something friendlier.
    const check = ({ data, error }) => {
      if (error) {
        const m = error.message || String(error);
        if (/row-level security|permission denied/i.test(m)) fail("You are not allowed to do that.");
        if (/duplicate key.*reviews/i.test(m)) fail("You already reviewed this swap.");
        if (/duplicate key.*wishlist/i.test(m)) fail("Already on your wishlist.");
        if (/duplicate key.*perfume_reviews/i.test(m)) fail("You already reviewed this perfume — edit your review instead.");
        if (/18 or older|Database error saving new user/i.test(m)) fail("Sorry — you must be 18 or older to join Swapfume.");
        fail(m);
      }
      return data;
    };
    const me = () => uid || fail("Please sign in first.");
    // Where email links (confirm sign-up, reset password) should land: this page on the web,
    // the public website when running inside the iPhone app.
    const siteUrl = () => (window.Capacitor?.isNativePlatform?.() && window.APP_CONFIG.PUBLIC_SITE_URL) || location.origin + location.pathname;
    const LITE = "id,display_name,city,country,country_code,is_banned,avatar_url";
    const ITEM_SEL = `*, perfume:perfumes(*), owner:profiles(${LITE})`;
    const WISH_SEL = `*, perfume:perfumes(*), user:profiles(${LITE})`;
    const SWAP_SEL = "*, proposer:profiles!swaps_proposer_id_fkey(*), recipient:profiles!swaps_recipient_id_fkey(*), items:swap_items(*, perfume:perfumes(*))";
    const cleanQ = (q) => String(q || "").replace(/[,()%*\\]/g, " ").trim();

    async function uploadPhoto(file) {
      const { blob } = await Util.resizeImage(file, 900, 0.82);
      const path = `${me()}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
      check(await sb.storage.from("bottle-photos").upload(path, blob, { contentType: "image/jpeg" }));
      return sb.storage.from("bottle-photos").getPublicUrl(path).data.publicUrl;
    }

    return {
      mode: "supabase",
      async init() {
        const { data } = await sb.auth.getSession();
        uid = data.session?.user?.id || null;
        sb.auth.onAuthStateChange((ev, session) => {
          if (ev === "PASSWORD_RECOVERY") recovering = true;
          const next = session?.user?.id || null;
          if (next !== uid) { uid = next; listeners.forEach((f) => f()); }
        });
        return uid;
      },
      onAuthChange(f) { listeners.push(f); },
      currentUserId: () => uid,

      async signUp({ email, password, display_name, birthdate, country_code = "US" }) {
        if (!birthdate) fail("Please enter your date of birth.");
        if (String(password || "").length < 8) fail("Use at least 8 characters for your password.");
        const data = check(await sb.auth.signUp({
          email: String(email).trim(), password,
          options: { data: { display_name: String(display_name || "").trim(), birthdate, country_code },  emailRedirectTo: siteUrl() }
        }));
        return { needsConfirmation: !data.session };
      },
      async signIn({ email, password }) {
        const { error } = await sb.auth.signInWithPassword({ email: String(email).trim(), password });
        if (error) fail(/confirm/i.test(error.message) ? "Please confirm your email first (check your inbox). Link expired? Tap \"Resend confirmation email\" below." : "Email or password is not right.");
      },
      async signOut() { await sb.auth.signOut(); },
      // A fresh sign-up confirmation link (the first one expired, was used, or never arrived).
      async resendConfirmation(email) {
        email = String(email || "").trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail("Please enter a valid email address.");
        const { error } = await sb.auth.resend({ type: "signup", email, options: { emailRedirectTo: siteUrl() } });
        if (error && /rate|seconds|too many/i.test(error.message)) fail("Please wait a minute before asking for another email.");
        if (error) fail(error.message);
      },
      // Password reset: Supabase emails a link back to this page; the app then opens #/reset-password.
      async requestPasswordReset(email) {
        email = String(email || "").trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail("Please enter a valid email address.");
        check(await sb.auth.resetPasswordForEmail(email, { redirectTo: siteUrl() }));
        return { demoLink: false };
      },
      canResetPassword: () => !!uid,
      isRecovering: () => recovering,
      async updatePassword(password) {
        if (String(password || "").length < 8) fail("Use at least 8 characters for your password.");
        if (!uid) fail("This reset link has expired. Ask for a new one.");
        check(await sb.auth.updateUser({ password }));
        recovering = false;
      },
      async confirmAdult(birthdate) { check(await sb.rpc("confirm_adult", { p_birthdate: birthdate })); },

      async listBlocks() {
        return check(await sb.from("blocks").select("*, blocked:profiles!blocks_blocked_id_fkey(id,display_name,city,country,is_banned,avatar_url)").eq("blocker_id", me()).order("created_at", { ascending: false }));
      },
      async blockUser(userId) { check(await sb.rpc("block_user", { p_user: userId })); },
      async unblockUser(userId) { check(await sb.rpc("unblock_user", { p_user: userId })); },
      // Runs the Edge Function in supabase/functions/delete-account (see README).
      async deleteAccount() {
        me();
        const { error } = await sb.functions.invoke("delete-account", { method: "POST" });
        if (error) {
          let msg = "";
          try { msg = (await error.context.json()).error; } catch (e) { /* not JSON */ }
          fail(msg || "We couldn't delete your account right now. Please try again, or contact support.");
        }
        await sb.auth.signOut();
      },

      async getProfile(id) {
        const row = check(await sb.from("profiles").select("*").eq("id", id).maybeSingle());
        if (row || !uid) return row;
        // Members who aren't listed anywhere are still reachable from their link (migration 018).
        const r = check(await sb.rpc("get_member", { p_id: id }));
        return r?.[0] || null;
      },
      // A member you know, by their full display name (no partial matches: nobody can list everyone).
      async findMembers(name) {
        name = String(name || "").trim();
        if (name.length < 2) fail("Type their full display name.");
        return check(await sb.rpc("find_members", { p_name: name })) || [];
      },
      async updateProfile(patch) {
        const row = { display_name: String(patch.display_name || "").trim(), city: String(patch.city || "").trim(), country: String(patch.country || "").trim(), bio: String(patch.bio || "").trim() };
        return check(await sb.from("profiles").update(row).eq("id", me()).select().single());
      },
      async getMyAddress() { return check(await sb.from("private_addresses").select("*").eq("user_id", me()).maybeSingle()); },
      async saveMyAddress({ full_name, address }) {
        check(await sb.from("private_addresses").upsert({ user_id: me(), full_name: String(full_name).trim(), address: String(address).trim(), updated_at: new Date().toISOString() }));
      },
      async getPartnerAddress(swapId) {
        const s = check(await sb.from("swaps").select("proposer_id,recipient_id,status,method").eq("id", swapId).single());
        if (!["accepted", "completed"].includes(s.status) || s.method === "meetup") return null;
        const other = s.proposer_id === uid ? s.recipient_id : s.proposer_id;
        if (!other) return null; // partner deleted their account
        return check(await sb.from("private_addresses").select("*").eq("user_id", other).maybeSingle());
      },

      async searchCatalog(q, { limit = 30, sort = "name", perfumer = "" } = {}) {
        let query = sb.from("perfumes").select("*").eq("status", "approved");
        if (perfumer) query = query.contains("perfumers", [perfumer]);
        cleanQ(q).split(/\s+/).filter(Boolean).forEach((t) => { query = query.or(`brand.ilike.%${t}%,name.ilike.%${t}%,perfumers_search.ilike.%${t}%`); });
        query = sort === "rating"
          ? query.order("rating_avg", { ascending: false, nullsFirst: false }).order("rating_count", { ascending: false }).order("brand")
          : query.order("brand").order("name");
        return check(await query.limit(limit));
      },
      // "Take a photo": the identify-perfumes Edge Function asks the AI which perfumes are in the picture.
      async identifyPerfumes(file) {
        me();
        const { dataUrl } = await Util.resizeImage(file, 1568, 0.85);
        const { data, error } = await sb.functions.invoke("identify-perfumes", { method: "POST", body: { image: dataUrl, media_type: "image/jpeg" } });
        if (error) {
          let msg = "";
          try { msg = (await error.context.json()).error; } catch (e) { /* not JSON */ }
          fail(msg || "We couldn't read this photo right now. Please try again.");
        }
        return data?.perfumes || [];
      },
      // Every approved perfume (id, brand, name, concentration) for "Paste your list" matching. Loaded in pages of 1000.
      async catalogIndex() {
        const out = [];
        for (let from = 0; from < 20000; from += 1000) {
          const rows = check(await sb.from("perfumes").select("id,brand,name,concentration").eq("status", "approved").order("id").range(from, from + 999));
          out.push(...rows); if (rows.length < 1000) break;
        }
        return out;
      },
      async getPerfume(id) { return check(await sb.from("perfumes").select("*").eq("id", id).maybeSingle()); },
      async requestPerfume({ brand, name, concentration, year }) {
        return check(await sb.rpc("request_perfume", { p_brand: brand, p_name: name, p_concentration: concentration || "", p_year: year ? Number(year) : null }));
      },
      async similarPerfumes(brand, name, excludeId = null) {
        return check(await sb.rpc("similar_perfumes", { p_brand: brand, p_name: name, p_exclude: excludeId ? Number(excludeId) : null })) || [];
      },
      async perfumeLookup(brand, name) { return check(await sb.rpc("perfume_lookup", { p_brand: brand, p_name: name })); },
      async catalogBrands() { return check(await sb.rpc("catalog_brands")) || []; },

      // country: only listings by members of that country (matches, browse — swaps stay inside one country).
      async listItems({ ownerId, tradeableOnly, perfumeIds, excludeOwnerId, country, limit = 200 } = {}) {
        let q = sb.from("collection_items").select(country ? ITEM_SEL.replace("owner:profiles(", "owner:profiles!inner(") : ITEM_SEL);
        if (country) q = q.eq("owner.country_code", country);
        if (ownerId) q = q.eq("owner_id", ownerId);
        if (tradeableOnly) q = q.eq("tradeable", true);
        if (perfumeIds) { if (!perfumeIds.length) return []; q = q.in("perfume_id", perfumeIds); }
        if (excludeOwnerId) q = q.neq("owner_id", excludeOwnerId);
        const rows = check(await q.order("created_at", { ascending: false }).limit(limit));
        return tradeableOnly ? rows.filter((r) => !r.owner?.is_banned) : rows;
      },
      async getItem(id) { return check(await sb.from("collection_items").select(ITEM_SEL).eq("id", id).maybeSingle()); },
      async addItem(data, photoFile) {
        const photo_url = photoFile ? await uploadPhoto(photoFile) : null;
        const row = { owner_id: me(), perfume_id: Number(data.perfume_id), size: data.size, volume_ml: data.volume_ml ? Number(data.volume_ml) : null, fill_pct: Number(data.fill_pct ?? 100), quantity: Number(data.quantity ?? 1), tradeable: !!data.tradeable, note: String(data.note || ""), photo_url };
        return check(await sb.from("collection_items").insert(row).select(ITEM_SEL).single());
      },
      async updateItem(id, patch, photoFile) {
        const row = {};
        ["size", "note", "tradeable"].forEach((k) => { if (patch[k] !== undefined) row[k] = patch[k]; });
        if (patch.volume_ml !== undefined) row.volume_ml = patch.volume_ml ? Number(patch.volume_ml) : null;
        if (patch.fill_pct !== undefined) row.fill_pct = Number(patch.fill_pct);
        if (patch.quantity !== undefined) row.quantity = Number(patch.quantity);
        if (photoFile) row.photo_url = await uploadPhoto(photoFile);
        return check(await sb.from("collection_items").update(row).eq("id", id).select(ITEM_SEL).single());
      },
      async deleteItem(id) { check(await sb.from("collection_items").delete().eq("id", id)); },

      async listWishes({ userId, perfumeIds, excludeUserId, country } = {}) {
        let q = sb.from("wishlist_items").select(country ? WISH_SEL.replace("user:profiles(", "user:profiles!inner(") : WISH_SEL);
        if (country) q = q.eq("user.country_code", country);
        if (userId) q = q.eq("user_id", userId);
        if (perfumeIds) { if (!perfumeIds.length) return []; q = q.in("perfume_id", perfumeIds); }
        if (excludeUserId) q = q.neq("user_id", excludeUserId);
        const rows = check(await q);
        return excludeUserId ? rows.filter((r) => !r.user?.is_banned) : rows;
      },
      async addWish(perfumeId) { check(await sb.from("wishlist_items").insert({ user_id: me(), perfume_id: Number(perfumeId) })); },
      async removeWish(id) { check(await sb.from("wishlist_items").delete().eq("id", id)); },

      // qty: { itemId: how many } — several vials of one listing. Missing = 1.
      async proposeSwap({ recipientId, myItemIds, theirItemIds, message, method = "mail", qty = {} }) {
        return check(await sb.rpc("propose_swap_qty", { p_recipient: recipientId, p_my_items: myItemIds.map(Number), p_their_items: theirItemIds.map(Number), p_message: message || "", p_method: method,
          p_my_qty: myItemIds.map((i) => Number(qty[i] || 1)), p_their_qty: theirItemIds.map((i) => Number(qty[i] || 1)) }));
      },
      async offerGift({ recipientId, myItemIds, message, method = "mail", qty = {} }) {
        return check(await sb.rpc("offer_gift_qty", { p_recipient: recipientId, p_my_items: myItemIds.map(Number), p_message: message || "", p_method: method, p_my_qty: myItemIds.map((i) => Number(qty[i] || 1)) }));
      },
      // Prepaid shipping label for a gift (migration 019): private file, only the two people in the gift can open it.
      async addGiftLabel(swapId, file) {
        if (!file || !["application/pdf", "image/jpeg", "image/png"].includes(file.type)) fail("Choose a PDF, JPG or PNG of your shipping label.");
        if (file.size > 5 * 1024 * 1024) fail("That file is bigger than 5 MB.");
        const ext = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
        const path = `${Number(swapId)}/${Date.now()}-label.${ext}`;
        check(await sb.storage.from("shipping-labels").upload(path, file, { contentType: file.type }));
        check(await sb.rpc("set_gift_label", { p_swap: Number(swapId), p_path: path }));
      },
      async removeGiftLabel(swapId, path) {
        check(await sb.rpc("set_gift_label", { p_swap: Number(swapId), p_path: null }));
        if (path) await sb.storage.from("shipping-labels").remove([path]);
      },
      async giftLabelUrl(path) {
        const { data, error } = await sb.storage.from("shipping-labels").createSignedUrl(path, 600);
        if (error) fail("Couldn't open the label. Please try again.");
        return data.signedUrl;
      },
      // ---- Messages (migration 020): only between the two people in a swap, or about a listing ----
      async swapThread(swapId) { return check(await sb.rpc("swap_thread", { p_swap: Number(swapId) })); },
      async itemThread(itemId) { return check(await sb.rpc("item_thread", { p_item: Number(itemId) })); },
      async sendMessage(threadId, body) { return check(await sb.rpc("send_message", { p_thread: Number(threadId), p_body: String(body || "") })); },
      async markThreadRead(threadId) { check(await sb.rpc("mark_thread_read", { p_thread: Number(threadId) })); },
      async unreadThreads() { if (!uid) return 0; return check(await sb.rpc("unread_threads")) || 0; },
      async getThread(id) {
        const t = check(await sb.from("threads").select(`*, a:profiles!threads_user_a_fkey(${LITE}), b:profiles!threads_user_b_fkey(${LITE}), perfume:perfumes(id,brand,name,concentration), swap:swaps(id,is_gift,status)`).eq("id", id).maybeSingle());
        if (!t) return null;
        t.messages = check(await sb.from("messages").select("*").eq("thread_id", id).order("created_at").limit(500));
        return t;
      },
      async listThreads() {
        me();
        const ts = check(await sb.from("threads").select(`*, a:profiles!threads_user_a_fkey(${LITE}), b:profiles!threads_user_b_fkey(${LITE}), perfume:perfumes(id,brand,name), swap:swaps(id,is_gift,status)`)
          .not("last_message_at", "is", null).order("last_message_at", { ascending: false }).limit(100));
        if (!ts.length) return [];
        const ids = ts.map((t) => t.id);
        const [msgs, reads] = await Promise.all([
          sb.from("messages").select("thread_id,sender_id,body,created_at").in("thread_id", ids).order("created_at", { ascending: false }).limit(500),
          sb.from("thread_reads").select("thread_id,last_read_at").eq("user_id", uid).in("thread_id", ids)]);
        const last = {}, readAt = {};
        check(msgs).forEach((m) => { if (!last[m.thread_id]) last[m.thread_id] = m; });
        check(reads).forEach((r) => { readAt[r.thread_id] = r.last_read_at; });
        return ts.map((t) => { const l = last[t.id]; return { ...t, last: l || null, unread: !!(l && l.sender_id !== uid && (!readAt[t.id] || l.created_at > readAt[t.id])) }; });
      },
      async setMeetPlan(id, plan) { check(await sb.rpc("set_meet_plan", { p_swap: Number(id), p_plan: plan || "" })); },
      async markMet(id) { check(await sb.rpc("mark_met", { p_swap: Number(id) })); },

      // Location: ZIP code is private; others only get rounded distances.
      async getMyLocation() { if (!uid) return null; return check(await sb.from("private_locations").select("zip").eq("user_id", uid).maybeSingle()); },
      async setMyLocation(zip, cc = "US") {
        const z = await Util.postalLookup(zip, cc);
        check(await sb.rpc("set_my_location", { p_zip: z.zip, p_lat: z.lat, p_lon: z.lon }));
      },
      async clearMyLocation() { check(await sb.rpc("clear_my_location")); },
      // Blurred point (rounded to 0.1°) for the general-area map; null if no ZIP or not allowed.
      async memberArea(userId) {
        if (!uid || !userId) return null;
        const rows = check(await sb.rpc("member_area", { p_user: userId }));
        return rows?.length ? { lat: Number(rows[0].lat), lon: Number(rows[0].lon) } : null;
      },
      async memberDistances(userIds) {
        const ids = [...new Set(userIds)].filter(Boolean);
        if (!ids.length || !uid) return {};
        const rows = check(await sb.rpc("member_distances", { p_user_ids: ids }));
        const out = {}; rows.forEach((r) => { out[r.user_id] = r.miles; }); return out;
      },
      async listMySwaps() {
        me();
        return check(await sb.from("swaps").select(SWAP_SEL).or(`proposer_id.eq.${uid},recipient_id.eq.${uid}`).order("updated_at", { ascending: false }));
      },
      async getSwap(id) { return check(await sb.from("swaps").select(SWAP_SEL).eq("id", id).single()); },
      async respondSwap(id, accept) { check(await sb.rpc("respond_swap", { p_swap: Number(id), p_accept: !!accept })); },
      async cancelSwap(id) { check(await sb.rpc("cancel_swap", { p_swap: Number(id) })); },
      async markShipped(id) { check(await sb.rpc("mark_shipped", { p_swap: Number(id) })); },
      async markReceived(id) { check(await sb.rpc("mark_received", { p_swap: Number(id) })); },

      async listReviews({ revieweeId, reviewerId, swapId } = {}) {
        let q = sb.from("reviews").select("*, reviewer:profiles!reviews_reviewer_id_fkey(id,display_name,avatar_url)");
        if (revieweeId) q = q.eq("reviewee_id", revieweeId);
        if (reviewerId) q = q.eq("reviewer_id", reviewerId);
        if (swapId) q = q.eq("swap_id", swapId);
        return check(await q.order("created_at", { ascending: false }));
      },
      async leaveReview({ swapId, revieweeId, rating, comment }) {
        check(await sb.from("reviews").insert({ swap_id: Number(swapId), reviewer_id: me(), reviewee_id: revieweeId, rating: Number(rating), comment: String(comment || "") }));
      },
      async getStats(userIds) {
        const ids = [...new Set(userIds)].filter(Boolean);
        if (!ids.length) return {};
        const rows = check(await sb.rpc("profile_stats", { p_user_ids: ids }));
        const out = {};
        rows.forEach((r) => { out[r.user_id] = { completed_swaps: r.completed_swaps, review_count: r.review_count, avg_rating: r.avg_rating == null ? null : Number(r.avg_rating) }; });
        return out;
      },

      async report({ targetUserId, targetItemId, targetPerfumeReviewId, reason }) {
        const row = { reporter_id: me(), target_user_id: targetUserId || null, target_item_id: targetItemId ? Number(targetItemId) : null, reason: String(reason || "").trim() };
        if (targetPerfumeReviewId) row.target_perfume_review_id = Number(targetPerfumeReviewId);
        check(await sb.from("reports").insert(row));
      },

      // Perfume reviews (stars + tags)
      async listPerfumeReviews(perfumeId) {
        me();
        const rows = check(await sb.from("perfume_reviews").select("*, author:profiles!perfume_reviews_user_id_fkey(id,display_name,city,country,is_banned,avatar_url)")
          .eq("perfume_id", Number(perfumeId)).order("created_at", { ascending: false }).limit(300));
        const ids = rows.map((r) => r.id);
        const mine = ids.length ? check(await sb.from("perfume_review_votes").select("review_id").in("review_id", ids)) : [];
        const voted = new Set(mine.map((v) => v.review_id));
        return rows.map((r) => ({ ...r, voted: voted.has(r.id) }));
      },
      async savePerfumeReview({ perfumeId, rating, body, longevity, sillage, seasons, daytimes }) {
        const row = { rating: Number(rating), body: String(body || "").trim().slice(0, 1000), longevity: longevity || null, sillage: sillage || null, seasons: seasons || [], daytimes: daytimes || [], updated_at: new Date().toISOString() };
        const existing = check(await sb.from("perfume_reviews").select("id").eq("perfume_id", Number(perfumeId)).eq("user_id", me()).maybeSingle());
        if (existing) check(await sb.from("perfume_reviews").update(row).eq("id", existing.id));
        else check(await sb.from("perfume_reviews").insert({ ...row, perfume_id: Number(perfumeId), user_id: me() }));
      },
      async deletePerfumeReview(id) { check(await sb.from("perfume_reviews").delete().eq("id", Number(id)).eq("user_id", me())); },
      async voteHelpful(reviewId, on) {
        if (on) check(await sb.from("perfume_review_votes").upsert({ review_id: Number(reviewId), user_id: me() }, { ignoreDuplicates: true }));
        else check(await sb.from("perfume_review_votes").delete().eq("review_id", Number(reviewId)).eq("user_id", me()));
      },
      async setPerfumeReviewHidden(id, hidden) { check(await sb.rpc("admin_set_perfume_review_hidden", { p_review: Number(id), p_hidden: !!hidden })); },
      async importPerfumes(rows, commit, allowPre2000 = false) {
        return check(await sb.rpc("admin_import_perfumes", { p_rows: rows, p_commit: !!commit, p_allow_pre2000: !!allowPre2000 }));
      },

      async suggestNotes({ perfumeId, family, top, heart, base, perfumers, comment }) {
        const clean = (x) => (x || []).map((v) => String(v).trim()).filter(Boolean).slice(0, 15);
        if (![top, heart, base, perfumers].some((x) => clean(x).length)) fail("Add at least one note or a perfumer.");
        check(await sb.from("note_suggestions").insert({ perfume_id: Number(perfumeId), suggested_by: me(), family: family || null, notes_top: clean(top), notes_heart: clean(heart), notes_base: clean(base), perfumers: clean(perfumers).slice(0, 8), comment: String(comment || "") }));
      },
      async latestMemberPhoto(perfumeId) {
        return check(await sb.from("collection_items").select(`photo_url, created_at, owner:profiles(${LITE})`)
          .eq("perfume_id", perfumeId).not("photo_url", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle());
      },
      async listNoteSuggestions() {
        return check(await sb.from("note_suggestions").select("*, perfume:perfumes(*), suggester:profiles!note_suggestions_suggested_by_fkey(id,display_name)").eq("status", "pending").order("created_at"));
      },
      async reviewNoteSuggestion(id, approve) { check(await sb.rpc("admin_review_note_suggestion", { p_id: Number(id), p_approve: !!approve })); },
      async setPerfumeYear(perfumeId, year) {
        check(await sb.rpc("admin_set_perfume_year", { p_perfume: Number(perfumeId), p_year: year === "" || year == null ? null : Number(year) }));
      },
      async setPerfumeImage(perfumeId, file, credit) {
        const url = file ? await uploadPhoto(file) : null;
        check(await sb.rpc("admin_set_perfume_image", { p_perfume: Number(perfumeId), p_url: url, p_credit: credit || "" }));
      },
      // Profile photo (avatar). file = null removes it.
      async setMyAvatar(file) {
        let url = null;
        if (file) url = await (async () => {
          const { blob } = await Util.resizeImage(file, 400, 0.85);
          const path = `${me()}/avatar-${Date.now()}.jpg`;
          check(await sb.storage.from("bottle-photos").upload(path, blob, { contentType: "image/jpeg" }));
          return sb.storage.from("bottle-photos").getPublicUrl(path).data.publicUrl;
        })();
        check(await sb.rpc("set_my_avatar", { p_url: url }));
        return this.getProfile(me());
      },
      async adminClearAvatar(userId) { check(await sb.rpc("admin_clear_avatar", { p_user: userId })); },
      // Members suggest a photo of their own bottle as the catalog picture; an admin approves it.
      async suggestPhoto(perfumeId, file) {
        if (!file) fail("Choose a photo first.");
        const url = await uploadPhoto(file);
        check(await sb.from("photo_suggestions").insert({ perfume_id: Number(perfumeId), suggested_by: me(), image_url: url }));
      },
      async myPendingPhoto(perfumeId) {
        if (!uid) return null;
        return check(await sb.from("photo_suggestions").select("id, image_url, created_at").eq("perfume_id", Number(perfumeId)).eq("suggested_by", uid).eq("status", "pending").limit(1).maybeSingle());
      },
      async listPhotoSuggestions() {
        return check(await sb.from("photo_suggestions").select("*, perfume:perfumes(*), suggester:profiles!photo_suggestions_suggested_by_fkey(id,display_name)").eq("status", "pending").order("created_at"));
      },
      async reviewPhotoSuggestion(id, approve) { check(await sb.rpc("admin_review_photo_suggestion", { p_id: Number(id), p_approve: !!approve })); },

      async isAdmin() { if (!uid) return false; const p = await this.getProfile(uid); return !!p?.is_admin; },
      async listPendingPerfumes() {
        const rows = check(await sb.from("perfumes").select("*, requester:profiles!perfumes_requested_by_fkey(id,display_name)").eq("status", "pending").order("created_at"));
        await Promise.all(rows.map(async (r) => { r.similar = await this.similarPerfumes(r.brand, r.name, r.id); }));
        return rows;
      },
      async findDuplicatePerfumes() { return check(await sb.rpc("admin_find_duplicate_perfumes")) || []; },
      async markNotDuplicate(a, b) { check(await sb.rpc("admin_mark_not_duplicate", { p_a: Number(a), p_b: Number(b) })); },
      async mergePerfumes(dupId, keepId, useDupName = false) {
        return check(await sb.rpc("admin_merge_perfumes", { p_dup: Number(dupId), p_keep: Number(keepId), p_use_dup_name: !!useDupName }));
      },
      async reviewPerfume(id, approve) { check(await sb.rpc("admin_review_perfume", { p_id: Number(id), p_approve: !!approve })); },
      async listReports() {
        return check(await sb.from("reports").select(`*, reporter:profiles!reports_reporter_id_fkey(${LITE}), target_user:profiles!reports_target_user_id_fkey(${LITE}), target_item:collection_items(*, perfume:perfumes(*)), target_perfume_review:perfume_reviews(*, perfume:perfumes(*), author:profiles!perfume_reviews_user_id_fkey(id,display_name))`).order("created_at", { ascending: false }));
      },
      async resolveReport(id) { check(await sb.from("reports").update({ status: "resolved" }).eq("id", id)); },
      async setBan(userId, banned) { check(await sb.rpc("admin_set_ban", { p_user: userId, p_banned: !!banned })); },
      async setItemHidden(id, hidden) { check(await sb.rpc("admin_set_item_hidden", { p_item: Number(id), p_hidden: !!hidden })); },
      async listMembers() { return check(await sb.from("profiles").select("*").order("created_at", { ascending: false })); },

      // ---- Countries ----
      async setMyCountry(code) { check(await sb.rpc("set_my_country", { p_code: code })); },
      // "Bring Swapfume to my country" — anyone, signed in or not.
      async requestCountry(email, country) { check(await sb.rpc("request_country", { p_email: String(email || "").trim(), p_country: String(country || "").trim() })); },
      async listCountryRequests() { return check(await sb.from("country_requests").select("*").order("created_at", { ascending: false })); },
      async deleteCountryRequest(id) { check(await sb.from("country_requests").delete().eq("id", id)); },

      // ---- Community meetups ----
      async listEvents({ country, past = false } = {}) {
        let q = sb.from("events").select(`*, organizer:profiles!events_organizer_id_fkey(${LITE}), attendees:event_attendees(user_id)`);
        if (country) q = q.eq("country_code", country);
        const now = new Date(Date.now() - 6 * 3600e3).toISOString();
        q = past ? q.lt("starts_at", now).order("starts_at", { ascending: false }).limit(30) : q.gte("starts_at", now).order("starts_at");
        return check(await q);
      },
      async getEvent(id) {
        const e = check(await sb.from("events").select(`*, organizer:profiles!events_organizer_id_fkey(${LITE})`).eq("id", id).maybeSingle());
        if (!e) return null;
        const [att, com] = await Promise.all([
          sb.from("event_attendees").select(`user_id, created_at, user:profiles!event_attendees_user_id_fkey(${LITE})`).eq("event_id", id).order("created_at"),
          sb.from("event_comments").select(`*, user:profiles!event_comments_user_id_fkey(${LITE})`).eq("event_id", id).order("created_at")]);
        e.attendees = check(att); e.comments = check(com);
        return e;
      },
      async saveEvent(id, d) {
        return check(await sb.rpc("save_event", { p_id: id ? Number(id) : null, p_title: d.title, p_description: d.description || "", p_city: d.city, p_place: d.place,
          p_starts_at: new Date(d.starts_at).toISOString(), p_max_people: d.max_people ? Number(d.max_people) : null }));
      },
      async cancelEvent(id) { check(await sb.rpc("cancel_event", { p_id: Number(id) })); },
      async joinEvent(id, going) { check(await sb.rpc("join_event", { p_id: Number(id), p_going: !!going })); },
      async commentEvent(id, body) { check(await sb.rpc("comment_event", { p_id: Number(id), p_body: body })); },
      async deleteEventComment(id) { check(await sb.from("event_comments").delete().eq("id", id)); },
      async setEventHidden(id, hidden) { check(await sb.rpc("admin_set_event_hidden", { p_id: Number(id), p_hidden: !!hidden })); }
    };
  };
})();
