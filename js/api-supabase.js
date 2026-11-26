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

    const api = {
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
      // "Continue with Google / Apple" (switch each one on in Supabase → Authentication → Providers,
      // then list it in APP_CONFIG.OAUTH_PROVIDERS). The 18+ check happens on the next screen.
      async signInWithProvider(provider) {
        const { error } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo: siteUrl() } });
        if (error) fail(error.message);
      },
      // ---- Invite links (migration 031) ----
      async myInviteCode() { return check(await sb.rpc("my_invite_code")); },
      async invitePreview(code) { try { return check(await sb.rpc("invite_preview", { p_code: String(code || "") })); } catch (e) { return null; } },
      async claimInvite(code) { return check(await sb.rpc("claim_invite", { p_code: String(code || "") })); },
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
      // Email the other member about a new proposal or gift (best effort: a failure never blocks the swap).
      async notifySwap(swapId) {
        if (!uid || !window.APP_CONFIG.SWAP_EMAIL_FUNCTION) return;
        try { await sb.functions.invoke(window.APP_CONFIG.SWAP_EMAIL_FUNCTION, { method: "POST", body: { swap_id: Number(swapId) } }); } catch (e) { /* ignore */ }
      },
      async setEmailNotifications(on) {
        return check(await sb.from("profiles").update({ email_notifications: !!on }).eq("id", me()).select().single());
      },
      // ---- Pass-arounds and giveaways (migration 029) ----
      async listCircles({ mine = false } = {}) {
        const v = me();
        let q = sb.from("circles").select(`*, host:profiles!circles_host_id_fkey(${LITE}), perfume:perfumes(id,brand,name,concentration,image_url,member_photo_url), members:circle_members(user_id,won)`)
          .order("created_at", { ascending: false }).limit(60);
        if (mine) q = q.or(`host_id.eq.${v}`);
        const rows = check(await q);
        return rows.map((c) => ({ ...c, count: c.members.filter((m) => m.user_id !== c.host_id).length, joined: c.members.some((m) => m.user_id === v), won: c.members.some((m) => m.user_id === v && m.won) }));
      },
      async getCircle(id) {
        const v = me();
        const c = check(await sb.from("circles").select(`*, host:profiles!circles_host_id_fkey(${LITE}), perfume:perfumes(*)`).eq("id", Number(id)).maybeSingle());
        if (!c) return null;
        c.members = check(await sb.from("circle_members").select(`*, user:profiles!circle_members_user_id_fkey(${LITE})`).eq("circle_id", c.id).order("joined_at"));
        c.me = c.members.find((m) => m.user_id === v) || null;
        return c;
      },
      async createCircle({ kind, title, description, perfumeId, size, amount, spots, endsAt }) {
        return check(await sb.rpc("create_circle", { p_kind: kind, p_title: title, p_description: description || "", p_perfume: Number(perfumeId),
          p_size: size || "sample", p_amount: amount || "", p_spots: Number(spots), p_ends_at: endsAt ? new Date(endsAt).toISOString() : null }));
      },
      async joinCircle(id, going) { check(await sb.rpc("join_circle", { p_circle: Number(id), p_going: !!going })); },
      async startPassaround(id) { check(await sb.rpc("start_passaround", { p_circle: Number(id) })); },
      async circleNextAddress(id) { return (check(await sb.rpc("circle_next_address", { p_circle: Number(id) })) || [])[0] || null; },
      async circleSent(id) { check(await sb.rpc("circle_sent", { p_circle: Number(id) })); },
      async circleReceived(id) { check(await sb.rpc("circle_received", { p_circle: Number(id) })); },
      async drawGiveaway(id) { return check(await sb.rpc("draw_giveaway", { p_circle: Number(id) })); },
      async cancelCircle(id) { check(await sb.rpc("cancel_circle", { p_circle: Number(id) })); },
      async setCircleHidden(id, hidden) { check(await sb.rpc("admin_set_circle_hidden", { p_circle: Number(id), p_hidden: !!hidden })); },
      // ---- Notifications (migration 027): written by database triggers, read here ----
      async listNotifications({ limit = 60 } = {}) {
        me();
        return check(await sb.from("notifications").select(`*, actor:profiles!notifications_actor_id_fkey(${LITE}), post:posts(id,body,kind), event:events(id,title), swap:swaps(id,is_gift), circle:circles(id,title,kind), perfume:perfumes(id,brand,name)`)
          .order("created_at", { ascending: false }).limit(limit));
      },
      async unreadNotifications() { if (!uid) return 0; try { return check(await sb.rpc("unread_notifications")) || 0; } catch (e) { return 0; } },
      async markNotificationsRead(id = null) { check(await sb.rpc("mark_notifications_read", { p_id: id == null ? null : Number(id) })); },
      async deleteNotification(id) { check(await sb.from("notifications").delete().eq("id", Number(id))); },
      async setWishAlerts(on) {
        return check(await sb.from("profiles").update({ wish_alerts: !!on }).eq("id", me()).select().single());
      },
      async setEmailActivity(on) {
        return check(await sb.from("profiles").update({ email_activity: !!on }).eq("id", me()).select().single());
      },
      // Calls back whenever a new notification arrives for me (Supabase Realtime). Returns a stop function.
      onNotification(cb) {
        if (!uid) return () => {};
        const ch = sb.channel(`notif-${uid}`)
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` }, (p) => cb(p.new))
          .subscribe();
        return () => { sb.removeChannel(ch); };
      },
      // "Take a photo": the identify-perfumes Edge Function asks the AI which perfumes are in the picture.
      async identifyPerfumes(file) {
        me();
        const { dataUrl } = await Util.resizeImage(file, 1568, 0.85);
        const { data, error } = await sb.functions.invoke(window.APP_CONFIG.AI_PHOTO_FUNCTION || "identify-perfumes", { method: "POST", body: { image: dataUrl, media_type: "image/jpeg" } });
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
      async sendMessage(threadId, body, photoFile = null) {
        const photo = photoFile ? await uploadPhoto(photoFile) : null;
        return check(await sb.rpc("send_message", { p_thread: Number(threadId), p_body: String(body || ""), p_photo_url: photo }));
      },
      // Live updates for one conversation: new messages, the other person's "read up to" time,
      // and "typing…" (a Realtime broadcast, nothing stored). Returns { stop, typing }.
      watchThread(threadId, { onMessage, onRead, onTyping } = {}) {
        if (!uid) return { stop() {}, typing() {} };
        const id = Number(threadId);
        const ch = sb.channel(`thread-${id}`, { config: { broadcast: { self: false } } })
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `thread_id=eq.${id}` }, (p) => onMessage?.(p.new))
          .on("postgres_changes", { event: "*", schema: "public", table: "thread_reads", filter: `thread_id=eq.${id}` }, (p) => { if (p.new?.user_id && p.new.user_id !== uid) onRead?.(p.new.last_read_at); })
          .on("broadcast", { event: "typing" }, (p) => { if (p.payload?.user !== uid) onTyping?.(); })
          .subscribe();
        let last = 0;
        return {
          stop() { sb.removeChannel(ch); },
          typing() { const n = Date.now(); if (n - last > 2500) { last = n; ch.send({ type: "broadcast", event: "typing", payload: { user: uid } }).catch(() => {}); } }
        };
      },
      async markThreadRead(threadId) { check(await sb.rpc("mark_thread_read", { p_thread: Number(threadId) })); },
      async unreadThreads() { if (!uid) return 0; return check(await sb.rpc("unread_threads")) || 0; },
      async getThread(id) {
        const t = check(await sb.from("threads").select(`*, a:profiles!threads_user_a_fkey(${LITE}), b:profiles!threads_user_b_fkey(${LITE}), perfume:perfumes(id,brand,name,concentration), swap:swaps(id,is_gift,status)`).eq("id", id).maybeSingle());
        if (!t) return null;
        const [msgs, reads] = await Promise.all([
          sb.from("messages").select("*").eq("thread_id", id).order("created_at").limit(500),
          sb.from("thread_reads").select("user_id, last_read_at").eq("thread_id", id)
        ]);
        t.messages = check(msgs);
        // "Seen": when the other person last read this conversation (older databases: unknown).
        t.other_read_at = (reads.data || []).find((r) => r.user_id !== uid)?.last_read_at || null;
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
      // ---- Tracking numbers and claims (migration 033) ----
      async setTracking(id, tracking) { check(await sb.rpc("set_tracking", { p_swap: Number(id), p_tracking: String(tracking || "") })); },
      async listClaims({ swapId = null, open = false } = {}) {
        me();
        let q = sb.from("swap_claims").select(`*, opener:profiles!swap_claims_opened_by_fkey(${LITE}), swap:swaps(id, proposer_id, recipient_id, is_gift, proposer_tracking, recipient_tracking, proposer_shipped_at, recipient_shipped_at, proposer:profiles!swaps_proposer_id_fkey(${LITE}), recipient:profiles!swaps_recipient_id_fkey(${LITE}))`).order("created_at", { ascending: false });
        if (swapId) q = q.eq("swap_id", Number(swapId));
        if (open) q = q.eq("status", "open");
        try { return check(await q.limit(100)); } catch (e) { return []; }
      },
      async openClaim(id, kind, details) { return check(await sb.rpc("open_claim", { p_swap: Number(id), p_kind: kind, p_details: String(details || "") })); },
      async resolveClaim(id, resolution) { check(await sb.rpc("resolve_claim", { p_claim: Number(id), p_resolution: String(resolution || "") })); },

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

      async report({ targetUserId, targetItemId, targetPerfumeReviewId, targetPostId, targetPostCommentId, targetPerfumePhotoId, reason }) {
        const row = { reporter_id: me(), target_user_id: targetUserId || null, target_item_id: targetItemId ? Number(targetItemId) : null, reason: String(reason || "").trim() };
        if (targetPerfumeReviewId) row.target_perfume_review_id = Number(targetPerfumeReviewId);
        if (targetPostId) row.target_post_id = Number(targetPostId);
        if (targetPostCommentId) row.target_post_comment_id = Number(targetPostCommentId);
        if (targetPerfumePhotoId) row.target_perfume_photo_id = Number(targetPerfumePhotoId);
        check(await sb.from("reports").insert(row));
      },

      // ---- Member photos kept under each perfume (migration 024) ----
      async listPerfumePhotos(perfumeId) {
        me();
        return check(await sb.from("perfume_photos").select(`*, user:profiles!perfume_photos_user_id_fkey(id,display_name)`)
          .eq("perfume_id", Number(perfumeId)).order("created_at", { ascending: false }).limit(24));
      },
      async listRecentPerfumePhotos() {
        return check(await sb.from("perfume_photos").select(`*, user:profiles!perfume_photos_user_id_fkey(id,display_name), perfume:perfumes(id,brand,name,concentration)`)
          .order("created_at", { ascending: false }).limit(60));
      },
      async deletePerfumePhoto(id) { check(await sb.from("perfume_photos").delete().eq("id", Number(id))); },
      async setPerfumePhotoHidden(id, hidden) { check(await sb.rpc("admin_set_perfume_photo_hidden", { p_id: Number(id), p_hidden: !!hidden })); },

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
        return check(await sb.from("reports").select(`*, reporter:profiles!reports_reporter_id_fkey(${LITE}), target_user:profiles!reports_target_user_id_fkey(${LITE}), target_item:collection_items(*, perfume:perfumes(*)), target_perfume_review:perfume_reviews(*, perfume:perfumes(*), author:profiles!perfume_reviews_user_id_fkey(id,display_name)), target_post:posts(id,body,kind,is_hidden,author_id), target_post_comment:post_comments(id,body,post_id,user_id), target_perfume_photo:perfume_photos(id,image_url,perfume_id,is_hidden)`).order("created_at", { ascending: false }));
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
      async setEventHidden(id, hidden) { check(await sb.rpc("admin_set_event_hidden", { p_id: Number(id), p_hidden: !!hidden })); },

      // ---- Community: friends (migration 023) ----
      // Rows you're part of: { other, status: "friends" | "sent" | "received", since }
      async listFriendships() {
        const v = me();
        const rows = check(await sb.from("friendships").select(`*, a:profiles!friendships_user_a_fkey(${LITE}), b:profiles!friendships_user_b_fkey(${LITE})`));
        return rows.map((r) => ({ other: r.user_a === v ? r.b : r.a, other_id: r.user_a === v ? r.user_b : r.user_a,
          status: r.status === "accepted" ? "friends" : r.requested_by === v ? "sent" : "received", since: r.accepted_at || r.created_at }))
          .filter((r) => r.other);
      },
      async friendStatus(userId) {
        const v = me(); if (userId === v) return "me";
        const [a, b] = v < userId ? [v, userId] : [userId, v];
        const r = check(await sb.from("friendships").select("*").eq("user_a", a).eq("user_b", b).maybeSingle());
        return !r ? "none" : r.status === "accepted" ? "friends" : r.requested_by === v ? "sent" : "received";
      },
      async sendFriendRequest(userId) { return check(await sb.rpc("send_friend_request", { p_user: userId })); },
      async respondFriendRequest(userId, accept) { check(await sb.rpc("respond_friend_request", { p_user: userId, p_accept: !!accept })); },
      async removeFriend(userId) { check(await sb.rpc("remove_friend", { p_user: userId })); },

      // ---- Community: posts ----
      // scope: "feed" (me + friends), "discover" (my country), or authorId (one member's posts).
      async listPosts({ scope = "discover", authorId, groupId, limit = 40 } = {}) {
        const v = me();
        let q = sb.from("posts").select(`*, author:profiles!posts_author_id_fkey(${LITE}), perfume:perfumes(id,brand,name,concentration,family), likes:post_likes(user_id), comments:post_comments(count), group:groups(id,name,emoji)`);
        if (groupId) q = q.eq("group_id", Number(groupId));
        else if (authorId) q = q.eq("author_id", authorId);
        else if (scope === "feed") {
          const fr = (await this.listFriendships()).filter((f) => f.status === "friends").map((f) => f.other_id);
          q = q.in("author_id", [v, ...fr]).is("group_id", null);
        } else {
          const p = await this.getProfile(v); q = q.eq("country_code", p?.country_code || "US").is("group_id", null);
        }
        if (!authorId && !groupId && scope !== "feed") q = q.order("is_pinned", { ascending: false });
        const rows = check(await q.order("created_at", { ascending: false }).limit(limit));
        const out = rows.filter((r) => !r.author?.is_banned).map((r) => ({ ...r, like_count: r.likes.length, liked: r.likes.some((l) => l.user_id === v), comment_count: r.comments?.[0]?.count || 0 }));
        return this._withExtras(out);
      },
      // Poll totals and "saved" for a list of posts (migration 032; skipped quietly on older databases).
      async _withExtras(posts) {
        if (!posts.length) return posts;
        const ids = posts.map((p) => p.id), polls = posts.filter((p) => p.poll).map((p) => p.id);
        const [pc, sv] = await Promise.all([
          polls.length ? sb.rpc("poll_counts", { p_posts: polls }) : { data: [] },
          sb.from("saved_posts").select("post_id").in("post_id", ids)
        ]);
        const saved = new Set((sv.data || []).map((r) => r.post_id));
        posts.forEach((p) => {
          p.saved = saved.has(p.id);
          if (p.poll) {
            const rows = (pc.data || []).filter((r) => r.post_id === p.id);
            p.poll_votes = p.poll.map((_, i) => Number(rows.find((r) => r.choice === i)?.votes || 0));
            p.my_vote = rows.find((r) => r.mine)?.choice ?? null;
          }
        });
        return posts;
      },
      async getPost(id) {
        const v = me();
        const r = check(await sb.from("posts").select(`*, author:profiles!posts_author_id_fkey(${LITE}), perfume:perfumes(id,brand,name,concentration,family), likes:post_likes(user_id)`).eq("id", Number(id)).maybeSingle());
        if (!r) return null;
        r.comments = check(await sb.from("post_comments").select(`*, user:profiles!post_comments_user_id_fkey(${LITE})`).eq("post_id", r.id).order("created_at"));
        const [full] = await this._withExtras([{ ...r, like_count: r.likes.length, liked: r.likes.some((l) => l.user_id === v), comment_count: r.comments.length }]);
        return full;
      },
      async createPost({ kind, body, perfumeId, photoFile, photoFiles = [], groupId = null, poll = null }) {
        const files = [photoFile, ...photoFiles].filter(Boolean).slice(0, 4);
        const urls = [];
        for (const f of files) urls.push(await uploadPhoto(f));
        return check(await sb.rpc("create_post", { p_kind: kind, p_body: body, p_perfume: perfumeId ? Number(perfumeId) : null, p_photo_url: urls[0] || null,
          p_group: groupId ? Number(groupId) : null, p_photos: urls.slice(1), p_poll: poll && poll.length ? poll : null }));
      },
      async editPost(id, body) { check(await sb.rpc("edit_post", { p_post: Number(id), p_body: body })); },
      async pinPost(id, on) { check(await sb.rpc("pin_post", { p_post: Number(id), p_on: !!on })); },
      async votePoll(id, choice) { check(await sb.rpc("vote_poll", { p_post: Number(id), p_choice: Number(choice) })); },
      async savePost(id, on) {
        if (on) check(await sb.from("saved_posts").upsert({ user_id: me(), post_id: Number(id) }));
        else check(await sb.from("saved_posts").delete().eq("user_id", me()).eq("post_id", Number(id)));
      },
      async listSavedPosts() {
        const v = me();
        const ids = (check(await sb.from("saved_posts").select("post_id, created_at").eq("user_id", v).order("created_at", { ascending: false }).limit(100)) || []).map((r) => r.post_id);
        if (!ids.length) return [];
        const rows = check(await sb.from("posts").select(`*, author:profiles!posts_author_id_fkey(${LITE}), perfume:perfumes(id,brand,name,concentration,family), likes:post_likes(user_id), comments:post_comments(count), group:groups(id,name,emoji)`).in("id", ids));
        const out = ids.map((id) => rows.find((r) => r.id === id)).filter(Boolean).map((r) => ({ ...r, like_count: r.likes.length, liked: r.likes.some((l) => l.user_id === v), comment_count: r.comments?.[0]?.count || 0 }));
        return this._withExtras(out);
      },
      async searchPeople(q) { return check(await sb.rpc("search_people", { p_q: String(q || "") })) || []; },
      async searchPosts(q) {
        const v = me(), t = cleanQ(q);
        if (t.length < 2) return [];
        const rows = check(await sb.from("posts").select(`*, author:profiles!posts_author_id_fkey(${LITE}), perfume:perfumes(id,brand,name,concentration,family), likes:post_likes(user_id), comments:post_comments(count), group:groups(id,name,emoji)`)
          .ilike("body", `%${t}%`).order("created_at", { ascending: false }).limit(30));
        return this._withExtras(rows.filter((r) => !r.author?.is_banned).map((r) => ({ ...r, like_count: r.likes.length, liked: r.likes.some((l) => l.user_id === v), comment_count: r.comments?.[0]?.count || 0 })));
      },
      // ---- Groups (migration 030) ----
      async listGroups() {
        const v = me();
        const rows = check(await sb.from("groups").select("*, members:group_members(user_id, role)").order("is_official", { ascending: false }).order("name"));
        return rows.map((g) => ({ ...g, member_count: g.members.length, joined: g.members.some((m) => m.user_id === v), role: g.members.find((m) => m.user_id === v)?.role || null }));
      },
      async getGroup(id) { return (await this.listGroups()).find((g) => g.id === Number(id)) || null; },
      async joinGroup(id, join) { check(await sb.rpc("join_group", { p_group: Number(id), p_join: !!join })); },
      async createGroup({ name, description, emoji }) { return check(await sb.rpc("create_group", { p_name: name, p_description: description || "", p_emoji: emoji || "" })); },
      async setGroupHidden(id, hidden) { check(await sb.rpc("admin_set_group_hidden", { p_group: Number(id), p_hidden: !!hidden })); },
      async deletePost(id) { check(await sb.from("posts").delete().eq("id", Number(id))); },
      async likePost(id, on) { check(await sb.rpc("like_post", { p_post: Number(id), p_on: !!on })); },
      async commentPost(id, body, parentId = null) { check(await sb.rpc("comment_post", { p_post: Number(id), p_body: body, p_parent: parentId ? Number(parentId) : null })); },
      async deletePostComment(id) { check(await sb.from("post_comments").delete().eq("id", Number(id))); },
      async setPostHidden(id, hidden) { check(await sb.rpc("admin_set_post_hidden", { p_post: Number(id), p_hidden: !!hidden })); },
      async trendingWishes() {
        const rows = check(await sb.rpc("trending_wishes", { p_days: 30 })) || [];
        if (!rows.length) return [];
        const ps = check(await sb.from("perfumes").select("*").in("id", rows.map((r) => r.perfume_id)));
        return rows.map((r) => ({ perfume: ps.find((p) => p.id === r.perfume_id), wanted: Number(r.wanted) })).filter((r) => r.perfume);
      }
    };
    // After anything that notifies someone else, ask the activity-email function to email them
    // (it decides who, if anyone; at most one email per member every 30 minutes). A few seconds'
    // wait gathers several quick actions into one call. Never blocks or fails the action itself.
    let emailTimer = null;
    const nudgeEmails = () => {
      const fn = window.APP_CONFIG.ACTIVITY_EMAIL_FUNCTION;
      if (!fn || !uid) return;
      clearTimeout(emailTimer);
      emailTimer = setTimeout(() => { sb.functions.invoke(fn, { method: "POST", body: {} }).catch(() => {}); }, 4000);
    };
    ["sendMessage", "commentPost", "sendFriendRequest", "respondFriendRequest", "respondSwap", "cancelSwap", "markShipped",
     "markReceived", "leaveReview", "joinEvent", "commentEvent", "cancelEvent", "openClaim", "resolveClaim",
     "joinCircle", "startPassaround", "circleSent", "circleReceived", "drawGiveaway", "cancelCircle", "addItem", "updateItem"].forEach((k) => {
      const f = api[k];
      if (f) api[k] = async function (...a) { const r = await f.apply(this, a); nudgeEmails(); return r; };
    });
    return api;
  };
})();
