/* Swapfume — the app screens. Talks only to `api` (demo or Supabase). */
(async function () {
  const CFG = window.APP_CONFIG;
  const view = document.getElementById("view");
  const bootHash = location.hash; // Supabase email links (reset / confirm) arrive as #access_token=…

  // ---------- Safe HTML templating ----------
  class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const val = (v) => v == null || v === false ? "" : v instanceof Raw ? v.s : Array.isArray(v) ? v.map(val).join("") : esc(v);
  const html = (str, ...vals) => new Raw(str.reduce((out, s, i) => out + s + (i < vals.length ? val(vals[i]) : ""), ""));
  const raw = (s) => new Raw(s);
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  // ---------- Choose the data layer ----------
  let api;
  if (CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY) {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js";
      s.onload = res; s.onerror = () => rej(new Error("Could not load Supabase"));
      document.head.appendChild(s);
    });
    api = window.makeSupabaseApi(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
  } else {
    api = window.DemoApi;
  }

  const state = { uid: null, profile: null };

  // ---------- Small UI helpers ----------
  let toastTimer;
  function toast(msg, kind = "") {
    const t = $("#toast");
    t.textContent = msg; t.className = "toast show " + kind;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.className = "toast"), 3200);
  }
  async function run(btn, fn) {
    if (btn) btn.disabled = true;
    try { return await fn(); }
    catch (e) { console.error(e); toast(e.message || "Something went wrong.", "error"); }
    finally { if (btn && btn.isConnected) btn.disabled = false; }
  }
  const go = (path) => { if (location.hash === "#" + path) route(); else location.hash = path; };
  const setView = (content) => { view.innerHTML = val(content); };
  const loading = () => setView(html`<div class="spinner" role="progressbar" aria-label="Loading"></div>`);

  const modal = $("#modal");
  function openModal(content, bind) {
    modal.innerHTML = val(content);
    modal.showModal();
    $$("[data-close]", modal).forEach((b) => b.addEventListener("click", () => modal.close()));
    if (bind) bind(modal);
    const first = $("input, textarea, select", modal); if (first) first.focus();
  }
  function confirmBox(title, text, okLabel = "Yes") {
    return new Promise((resolve) => {
      openModal(html`<div class="dlg"><h3>${title}</h3><p class="muted">${text}</p>
        <div class="dlg-actions"><button class="btn secondary" data-close>Not now</button><button class="btn" id="dlgOk">${okLabel}</button></div></div>`,
      (m) => {
        $("#dlgOk", m).addEventListener("click", () => { modal.close(); resolve(true); });
        modal.addEventListener("close", () => resolve(false), { once: true });
      });
    });
  }

  const SIZE_LABEL = { sample: "Sample", decant: "Decant", full: "Full bottle" };
  const PALETTE = ["#E8C4C0", "#D9B98A", "#C5D2BA", "#CDC2DD", "#EFD7AE", "#C3D4DB", "#E2BECB", "#D7C9B6"];
  const hash = (s) => { let h = 5381; for (const c of String(s)) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0; return h; };

  // Scent families: liquid tint for the illustrated bottles and the family chip.
  const FAMILY_COLOR = { floral: "#EBC3CB", woody: "#C8A57E", amber: "#D9A35B", citrus: "#EED67E", fresh: "#BFDCE3", aquatic: "#A9CCE3", green: "#B5D0A0", fruity: "#EBA9AE", gourmand: "#D6B08A", musky: "#D9C8B8", leather: "#9C735C", aromatic: "#BACBAB", chypre: "#ADB68D", "fougère": "#9EC2A2" };
  const tint = (p) => FAMILY_COLOR[p?.family] || PALETTE[hash((p?.brand || "") + (p?.name || "")) % PALETTE.length];
  let svgId = 0;
  // Drawn in the app (no product photos). Full bottles get one of five shapes, picked from the perfume's name.
  function bottleSvg(p, size = "full") {
    const h = hash((p?.brand || "") + (p?.name || ""));
    const c = tint(p);
    const id = "s" + (++svgId);
    const shine = `<defs><linearGradient id="${id}" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>`;
    if (size === "sample") return raw(`<svg viewBox="0 0 60 100" aria-hidden="true"><rect x="24" y="12" width="12" height="11" rx="2" fill="#3A2E2A"/><rect x="21" y="23" width="18" height="70" rx="9" fill="#FFFDFB" stroke="#D2C3B6" stroke-width="1.5"/><rect x="24" y="46" width="12" height="44" rx="6" fill="${c}"/><rect x="25" y="28" width="2.5" height="56" rx="1.2" fill="#fff" opacity=".8"/></svg>`);
    if (size === "decant") return raw(`<svg viewBox="0 0 60 100" aria-hidden="true"><rect x="25" y="4" width="10" height="13" rx="2.5" fill="#A0782C"/><rect x="23" y="17" width="14" height="5" rx="1.5" fill="#8C6A2A"/><rect x="17" y="22" width="26" height="72" rx="7" fill="#FFFDFB" stroke="#D2C3B6" stroke-width="1.5"/><rect x="20" y="36" width="20" height="55" rx="5" fill="${c}"/><rect x="21.5" y="27" width="3" height="60" rx="1.5" fill="#fff" opacity=".75"/></svg>`);
    const gold = h % 3 === 0 ? "#3A2E2A" : "#A0782C";
    const label = `<rect x="17" y="56" width="26" height="15" rx="2" fill="#FFFDFB" opacity=".88"/><rect x="21" y="61" width="18" height="2" rx="1" fill="#6B5D57" opacity=".5"/><rect x="24" y="66" width="12" height="1.6" rx=".8" fill="#6B5D57" opacity=".35"/>`;
    const shapes = [
      // classic rounded
      `<rect x="19" y="3" width="22" height="19" rx="4" fill="${gold}"/><rect x="25" y="22" width="10" height="8" fill="#8C6A2A"/><rect x="5" y="30" width="50" height="66" rx="15" fill="${c}"/><rect x="5" y="30" width="50" height="66" rx="15" fill="url(#${id})" opacity=".55"/>`,
      // tall column
      `<rect x="21" y="2" width="18" height="21" rx="2" fill="${gold}"/><rect x="26" y="23" width="8" height="6" fill="#8C6A2A"/><rect x="12" y="29" width="36" height="67" rx="4" fill="${c}"/><rect x="12" y="29" width="36" height="67" rx="4" fill="url(#${id})" opacity=".55"/>`,
      // round flacon with ball cap
      `<circle cx="30" cy="12" r="9" fill="${gold}"/><rect x="26" y="20" width="8" height="10" fill="#8C6A2A"/><ellipse cx="30" cy="64" rx="27" ry="31" fill="${c}"/><ellipse cx="30" cy="64" rx="27" ry="31" fill="url(#${id})" opacity=".55"/>`,
      // chunky square
      `<rect x="15" y="7" width="30" height="17" rx="2" fill="${gold}"/><rect x="4" y="26" width="52" height="70" rx="7" fill="${c}"/><rect x="4" y="26" width="52" height="70" rx="7" fill="url(#${id})" opacity=".55"/><rect x="8" y="30" width="44" height="62" rx="4" fill="none" stroke="#fff" stroke-opacity=".45"/>`,
      // faceted
      `<rect x="23" y="3" width="14" height="19" rx="7" fill="${gold}"/><rect x="26" y="22" width="8" height="6" fill="#8C6A2A"/><polygon points="30,27 55,41 55,83 30,97 5,83 5,41" fill="${c}"/><polygon points="30,27 55,41 55,83 30,97 5,83 5,41" fill="url(#${id})" opacity=".55"/><polyline points="30,27 30,97" stroke="#fff" stroke-opacity=".35"/>`
    ];
    return raw(`<svg viewBox="0 0 60 100" aria-hidden="true">${shine}${shapes[h % shapes.length]}${label}</svg>`);
  }
  const notesOf = (p) => [...(p?.notes_top || []), ...(p?.notes_heart || []), ...(p?.notes_base || [])];
  const classicChip = (p) => p?.is_classic ? html`<span class="pill gold" title="Released before 2000 and still sold today">Classic</span>` : "";
  function familyChip(p) {
    if (!p?.family) return "";
    return html`<span class="fam"><span class="fam-dot" style="background:${tint(p)}" aria-hidden="true"></span>${p.family}</span>`;
  }
  // A short "key notes" line: one from each layer first, then the rest, up to 4.
  function shortNotes(p, max = 4) {
    const layers = [p?.notes_top || [], p?.notes_heart || [], p?.notes_base || []];
    const picked = [];
    for (let i = 0; picked.length < max && i < 6; i++) layers.forEach((l) => { if (l[i] && picked.length < max && !picked.includes(l[i])) picked.push(l[i]); });
    return picked.join(" · ");
  }
  function notesPyramid(p) {
    const layer = (label, list, hint) => html`<div class="layer"><div class="layer-name">${label} <span class="muted small">${hint}</span></div>${list?.length ? html`<div class="row">${list.map((n) => html`<span class="note">${n}</span>`)}</div>` : html`<div class="muted small">Not listed</div>`}</div>`;
    return html`<div class="pyramid">${layer("Top", p.notes_top, "first minutes")}${layer("Heart", p.notes_heart, "the main character")}${layer("Base", p.notes_base, "what lingers")}</div>`;
  }
  function avatar(p, cls = "") {
    const name = p?.display_name || "?";
    const colors = ["#8C3B4A", "#7A5A2B", "#4F6B57", "#5E4F7A", "#8A4F3A", "#3F5E6B"];
    return html`<span class="avatar ${cls}" style="background:${colors[hash(p?.id || name) % colors.length]}" aria-hidden="true">${name.trim().charAt(0).toUpperCase()}</span>`;
  }
  function trust(st) {
    if (!st) return "";
    const n = st.completed_swaps;
    return html`<span class="trust">${n ? html`<span class="pill ok">${n} swap${n === 1 ? "" : "s"} completed</span>` : html`<span class="pill gold">New member</span>`}
      ${st.avg_rating ? html`<span aria-label="Average rating ${st.avg_rating.toFixed(1)} out of 5 from ${st.review_count} reviews"><span class="stars" aria-hidden="true">★</span> ${st.avg_rating.toFixed(1)} <span class="muted">(${st.review_count})</span></span>` : ""}</span>`;
  }
  // Average stars for a catalog perfume, e.g. "★ 4.3 (12)".
  const ratingBadge = (p) => p?.rating_count ? html`<span class="rating" aria-label="Rated ${(+p.rating_avg).toFixed(1)} out of 5 by ${p.rating_count} member${p.rating_count === 1 ? "" : "s"}"><span class="stars" aria-hidden="true">★</span> ${(+p.rating_avg).toFixed(1)} <span class="muted">(${p.rating_count})</span></span>` : "";
  const perfumerLinks = (p) => (p?.perfumers || []).map((n, k) => html`${k ? (k === p.perfumers.length - 1 ? " & " : ", ") : ""}<a href="#/catalog?perfumer=${encodeURIComponent(n)}">${n}</a>`);
  const starsText = (n) => "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n);
  const place = (p) => [p?.city, p?.country].filter(Boolean).join(", ");
  const amount = (i) => [i.volume_ml ? `${+i.volume_ml} ml` : "", i.size !== "sample" && i.fill_pct < 100 ? `about ${i.fill_pct}% left` : ""].filter(Boolean).join(" · ");
  const pTitle = (p) => p ? `${p.brand} ${p.name}` : "Unknown perfume";
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";

  function itemTile(i, { owner = false, mine = false, select = null, checked = false } = {}) {
    const p = i.perfume;
    const art = i.photo_url ? html`<img src="${i.photo_url}" alt="Photo of ${pTitle(p)}" loading="lazy">` : bottleSvg(p, i.size);
    const inner = html`
      <div class="art">${art}</div>
      <div class="corner"><span class="pill ${i.size === "full" ? "rose" : i.size === "decant" ? "gold" : ""}">${SIZE_LABEL[i.size]}</span></div>
      <div class="body">
        <span class="brand">${p?.brand}</span>
        ${select ? html`<span class="pname">${p?.name}</span>` : html`<a class="pname" href="#/perfume/${p?.id}">${p?.name}</a>`}
        <span class="meta">${p?.concentration}${amount(i) ? " · " + amount(i) : ""}</span>
        ${p?.family || p?.is_classic ? html`<div class="row" style="gap:6px;margin-top:2px">${familyChip(p)}${classicChip(p)}</div>` : ""}
        ${notesOf(p).length ? html`<span class="notes-line">${shortNotes(p)}</span>` : ""}
        ${i.size !== "sample" && i.fill_pct != null ? html`<div class="fill" aria-hidden="true"><span style="width:${i.fill_pct}%"></span></div>` : ""}
        ${i.note ? html`<span class="meta">“${i.note}”</span>` : ""}
        ${mine ? html`<div class="row" style="margin-top:4px">${i.tradeable ? html`<span class="pill ok">Open to trade</span>` : html`<span class="pill grey">Keeping</span>`}${i.is_hidden ? html`<span class="pill warn">Hidden by admin</span>` : ""}</div>
          <div class="actions"><button class="btn small secondary" data-edit="${i.id}">Edit</button><button class="btn small ghost" data-toggle="${i.id}">${i.tradeable ? "Keep instead" : "Offer to trade"}</button></div>` : ""}
        ${owner && i.owner ? html`<div class="owner">from <a href="#/u/${i.owner.id}">${i.owner.display_name}</a>${place(i.owner) ? html` <span class="muted">· ${i.owner.city || i.owner.country}</span>` : ""}</div>` : ""}
      </div>`;
    if (select) return html`<label class="tile selectable ${checked ? "on" : ""}"><input type="checkbox" name="${select}" value="${i.id}" ${checked ? raw("checked") : ""}><span class="check" aria-hidden="true"></span>${inner}</label>`;
    return html`<article class="tile">${inner}</article>`;
  }
  function bindSelectable(root) {
    $$(".tile.selectable input", root).forEach((inp) => inp.addEventListener("change", () => inp.closest(".tile").classList.toggle("on", inp.checked)));
  }

  // Perfume search box with suggestions. onPick(perfume)
  function perfumePicker(host, onPick, { placeholder = "Search brand or perfume name" } = {}) {
    host.innerHTML = val(html`<div class="picker">
      <input type="search" role="combobox" aria-expanded="false" aria-autocomplete="list" aria-label="Search the perfume catalog" placeholder="${placeholder}" autocomplete="off">
      <ul class="picker-list" role="listbox" hidden></ul></div>`);
    const input = $("input", host), list = $("ul", host);
    let results = [], active = -1, timer;
    const close = () => { list.hidden = true; input.setAttribute("aria-expanded", "false"); };
    const draw = () => {
      const q = input.value.trim();
      list.innerHTML = val(html`${results.map((p, idx) => html`<li role="option" data-i="${idx}" aria-selected="${idx === active}"><div class="b">${p.brand}</div><div class="n">${p.name} <span class="muted small">${p.concentration}${p.year ? " · " + p.year : ""}${p.family ? " · " + p.family : ""}${p.is_classic ? " · classic" : ""}${p.rating_count ? ` · ★ ${(+p.rating_avg).toFixed(1)}` : ""}</span></div>${p.perfumers?.length ? html`<div class="small muted">by ${p.perfumers.join(", ")}</div>` : ""}</li>`)}
        <li data-req><span class="small">${results.length ? "Not here? " : "No match in the catalog. "}<a href="#/request?brand=&name=${encodeURIComponent(q)}">Ask to add “${q}”</a></span></li>`);
      list.hidden = false; input.setAttribute("aria-expanded", "true");
    };
    input.addEventListener("input", () => {
      clearTimeout(timer);
      const q = input.value.trim();
      if (q.length < 2) { close(); return; }
      timer = setTimeout(async () => { results = await api.searchCatalog(q, { limit: 12 }); active = -1; draw(); }, 160);
    });
    input.addEventListener("keydown", (e) => {
      if (list.hidden) return;
      if (e.key === "ArrowDown") { active = Math.min(results.length - 1, active + 1); draw(); e.preventDefault(); }
      else if (e.key === "ArrowUp") { active = Math.max(0, active - 1); draw(); e.preventDefault(); }
      else if (e.key === "Enter" && active >= 0) { e.preventDefault(); pick(results[active]); }
      else if (e.key === "Escape") close();
    });
    list.addEventListener("mousedown", (e) => { const li = e.target.closest("li[data-i]"); if (li) { e.preventDefault(); pick(results[+li.dataset.i]); } });
    input.addEventListener("blur", () => setTimeout(close, 150));
    function pick(p) { close(); input.value = ""; onPick(p); }
  }

  // ---------- Item form (add / edit) ----------
  function itemForm(existing, presetPerfume) {
    let chosen = existing?.perfume || presetPerfume || null;
    const it = existing || { size: "decant", volume_ml: "", fill_pct: 100, tradeable: true, note: "" };
    openModal(html`<form class="dlg" id="itemForm">
      <h3>${existing ? "Edit this listing" : "Add to your collection"}</h3>
      <div class="field"><label>Perfume</label><div id="pickHost"></div></div>
      <div class="field"><label id="szl">Size</label>
        <div class="seg" role="radiogroup" aria-labelledby="szl">${["sample", "decant", "full"].map((s) => html`<label><input type="radio" name="size" value="${s}" ${it.size === s ? raw("checked") : ""}>${SIZE_LABEL[s]}</label>`)}</div>
        <p class="hint">Sample: a tiny vial (1–2 ml). Decant: perfume moved into a small spray (5–30 ml). Full bottle: the original bottle.</p></div>
      <div class="two field">
        <div><label for="vol">Volume (ml)</label><input id="vol" name="volume_ml" type="number" min="0.5" max="1000" step="0.5" inputmode="decimal" value="${it.volume_ml ?? ""}" placeholder="e.g. 10"></div>
        <div><label for="fill">Amount left: <span id="fillOut">${it.fill_pct}</span>%</label><input id="fill" name="fill_pct" type="range" min="5" max="100" step="5" value="${it.fill_pct}" style="width:100%;accent-color:var(--accent);min-height:46px"></div>
      </div>
      <div class="field"><label class="switch"><input type="checkbox" name="tradeable" ${it.tradeable ? raw("checked") : ""}> I'm open to trading this</label></div>
      <div class="field"><label for="photo">Photo of your bottle <span class="muted">(optional, builds trust)</span></label><input id="photo" name="photo" type="file" accept="image/*"></div>
      <div class="field"><label for="note">Note <span class="muted">(optional)</span></label><input id="note" name="note" type="text" maxlength="300" value="${it.note}" placeholder="Batch, box, how it was stored…"></div>
      <div class="dlg-actions">
        ${existing ? html`<button type="button" class="btn danger" id="delItem" style="margin-right:auto">Remove</button>` : ""}
        <button type="button" class="btn secondary" data-close>Cancel</button><button class="btn" id="saveItem">Save</button></div>
    </form>`, (m) => {
      const host = $("#pickHost", m);
      const drawPick = () => {
        if (chosen) {
          host.innerHTML = val(html`<div class="picked"><div class="grow"><div class="brand">${chosen.brand}</div><div class="pname">${chosen.name}</div><div class="meta">${chosen.concentration}</div></div>${existing ? "" : html`<button type="button" class="btn small ghost" id="chg">Change</button>`}</div>`);
          const b = $("#chg", host); if (b) b.addEventListener("click", () => { chosen = null; drawPick(); });
        } else perfumePicker(host, (p) => { chosen = p; drawPick(); });
      };
      drawPick();
      $("#fill", m).addEventListener("input", (e) => ($("#fillOut", m).textContent = e.target.value));
      $("#itemForm", m).addEventListener("submit", (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        if (!chosen) { toast("Pick a perfume from the catalog first.", "error"); return; }
        const data = { perfume_id: chosen.id, size: f.get("size"), volume_ml: f.get("volume_ml"), fill_pct: f.get("fill_pct"), tradeable: !!f.get("tradeable"), note: f.get("note").trim() };
        const photo = f.get("photo") && f.get("photo").size ? f.get("photo") : null;
        run($("#saveItem", m), async () => {
          if (existing) await api.updateItem(existing.id, data, photo); else await api.addItem(data, photo);
          modal.close(); toast(existing ? "Saved." : "Added to your collection."); route();
        });
      });
      const del = $("#delItem", m);
      if (del) del.addEventListener("click", () => run(del, async () => { await api.deleteItem(existing.id); modal.close(); toast("Removed."); route(); }));
    });
  }

  function reportDialog({ targetUserId, targetItemId, targetPerfumeReviewId, what }) {
    openModal(html`<form class="dlg" id="repForm"><h3>Report ${what}</h3>
      <p class="muted small">Reports go privately to the admins. The person is not told who reported them.</p>
      <label for="reason">What happened?</label><textarea id="reason" required minlength="3" maxlength="1000" placeholder="e.g. Never shipped, fake bottle, rude messages…"></textarea>
      <div class="dlg-actions"><button type="button" class="btn secondary" data-close>Cancel</button><button class="btn" id="repSend">Send report</button></div></form>`,
    (m) => $("#repForm", m).addEventListener("submit", (e) => {
      e.preventDefault();
      run($("#repSend", m), async () => { await api.report({ targetUserId, targetItemId, targetPerfumeReviewId, reason: $("#reason", m).value }); modal.close(); toast("Thank you. An admin will take a look."); });
    }));
  }

  // ---------- Swap helpers ----------
  function swapInfo(s, myReviewed) {
    const uid = state.uid, iAmP = s.proposer_id === uid;
    const other = iAmP ? s.recipient : s.proposer;
    const my = { shipped: iAmP ? s.proposer_shipped_at : s.recipient_shipped_at, received: iAmP ? s.proposer_received_at : s.recipient_received_at };
    const their = { shipped: iAmP ? s.recipient_shipped_at : s.proposer_shipped_at, received: iAmP ? s.recipient_received_at : s.proposer_received_at };
    const give = s.items.filter((x) => x.from_user_id === uid), get = s.items.filter((x) => x.from_user_id !== uid);
    const n = other ? other.display_name || "them" : "Former member";
    let label, needsMe = false, tone = "";
    if (s.status === "proposed") { needsMe = !iAmP; label = iAmP ? `Waiting for ${n} to answer` : `${n} proposed a swap`; tone = needsMe ? "rose" : "gold"; }
    else if (s.status === "declined") { label = "Declined"; tone = "grey"; }
    else if (s.status === "cancelled") { label = "Withdrawn"; tone = "grey"; }
    else if (s.status === "accepted") {
      if (!my.shipped) { needsMe = true; label = "Ship your package"; tone = "rose"; }
      else if (their.shipped && !my.received) { needsMe = true; label = "Confirm their package arrived"; tone = "rose"; }
      else if (!their.shipped) { label = `Waiting for ${n} to ship`; tone = "gold"; }
      else { label = `Waiting for ${n} to confirm arrival`; tone = "gold"; }
    } else if (s.status === "completed") {
      if (!myReviewed) { needsMe = true; label = "Leave a review"; tone = "rose"; } else { label = "Completed"; tone = "ok"; }
    }
    return { iAmP, other, name: n, my, their, give, get, label, needsMe, tone };
  }
  async function myReviewedSet() {
    const rs = await api.listReviews({ reviewerId: state.uid });
    return new Set(rs.map((r) => r.swap_id));
  }
  async function refreshSwapDot() {
    if (!state.uid) return;
    try {
      const [swaps, reviewed] = await Promise.all([api.listMySwaps(), myReviewedSet()]);
      const n = swaps.filter((s) => swapInfo(s, reviewed.has(s.id)).needsMe).length;
      $$("[data-swapdot]").forEach((d) => (d.hidden = !n));
    } catch (e) { /* not critical */ }
  }

  // ======================================================================
  // PAGES
  // ======================================================================
  // ---------- Age, legal pages, password reset ----------
  function isAdult(dateStr) {
    const d = new Date(String(dateStr || "") + "T00:00:00");
    if (isNaN(d) || d.getFullYear() < 1900) return false;
    const cut = new Date(); cut.setFullYear(cut.getFullYear() - CFG.MIN_AGE);
    return d <= cut;
  }
  const backLink = () => html`<a href="#/" class="btn ghost small">&larr; ${state.uid ? "Back" : "Back to sign in"}</a>`;

  function pageLegal(kind) {
    const doc = window.LEGAL[kind];
    // doc.body is fixed text written in js/legal.js (no member input), so it is inserted as-is.
    setView(html`${backLink()}<article class="card legal" style="margin-top:10px"><div class="eyebrow">${CFG.APP_NAME}</div><h1>${doc.title}</h1>
      ${doc.updated ? html`<p class="small muted">Last updated ${doc.updated}</p>` : ""}${raw(doc.body)}</article>`);
  }

  function pageForgot() {
    setView(html`${backLink()}<form class="card narrow" id="fpForm" style="margin-top:10px"><h1>Forgot your password?</h1>
      <p class="muted">Enter the email you signed up with. We'll send you a link to choose a new password.</p>
      <div class="field"><label for="fpEm">Email</label><input id="fpEm" type="email" required autocomplete="email"></div>
      <div class="field"><button class="btn block" id="fpBtn">Send reset link</button></div><div id="fpOut"></div></form>`);
    $("#fpForm").addEventListener("submit", (e) => {
      e.preventDefault();
      run($("#fpBtn"), async () => {
        const r = await api.requestPasswordReset($("#fpEm").value);
        $("#fpOut").innerHTML = val(api.mode === "demo"
          ? (r.demoLink ? html`<div class="notice"><b>Demo mode:</b> no email is sent. In the real app the member gets an email with a link. <a href="#/reset-password">Open the reset link</a></div>`
                        : html`<div class="notice">If an account exists for that email, a reset link is on its way.</div>`)
          : html`<div class="notice">If an account exists for that email, a reset link is on its way. Check your inbox (and spam). The link works once and expires after a while.</div>`);
      });
    });
  }

  function pageResetPassword() {
    if (!api.canResetPassword()) {
      return setView(html`${backLink()}<div class="empty"><h3>This link has expired</h3><p>Reset links work once and only for a short time. Ask for a new one.</p><a class="btn" href="#/forgot">Send a new link</a></div>`);
    }
    setView(html`<form class="card narrow" id="rpForm"><h1>Choose a new password</h1>
      <div class="field"><label for="rp1">New password</label><input id="rp1" type="password" required minlength="8" autocomplete="new-password"><p class="hint">At least 8 characters.</p></div>
      <div class="field"><label for="rp2">Type it again</label><input id="rp2" type="password" required minlength="8" autocomplete="new-password"></div>
      <div class="field"><button class="btn block" id="rpBtn">Save new password</button></div></form>`);
    $("#rpForm").addEventListener("submit", (e) => {
      e.preventDefault();
      run($("#rpBtn"), async () => {
        if ($("#rp1").value !== $("#rp2").value) throw new Error("The two passwords don't match.");
        await api.updatePassword($("#rp1").value);
        toast("Password changed. You're signed in.");
        await onAuth(true); go("/");
      });
    });
  }

  function pageAgeGate() {
    setView(html`<form class="card narrow" id="agForm"><div class="eyebrow">One quick check</div><h1>Please confirm your age</h1>
      <p class="muted">Swapfume is only for people ${CFG.MIN_AGE} and older, because swaps mean shipping perfume and sharing addresses with other members. We keep only a yes/no — never your birthday.</p>
      <div class="field"><label for="agDob">Date of birth</label><input id="agDob" type="date" required min="1900-01-01" max="${new Date().toISOString().slice(0, 10)}" autocomplete="bday"></div>
      <div class="field row"><button class="btn" id="agBtn">Confirm</button><button type="button" class="btn ghost" id="agOut">Sign out</button></div></form>`);
    $("#agOut").addEventListener("click", () => api.signOut());
    $("#agForm").addEventListener("submit", (e) => {
      e.preventDefault();
      run($("#agBtn"), async () => {
        if (!isAdult($("#agDob").value)) throw new Error(`Sorry — Swapfume is only for people ${CFG.MIN_AGE} or older.`);
        await api.confirmAdult($("#agDob").value);
        state.profile = await api.getProfile(state.uid); route();
      });
    });
  }

  function deleteAccountDialog() {
    openModal(html`<form class="dlg" id="delForm"><h3>Delete your account?</h3>
      <p class="muted small">This can't be undone. We remove your profile, collection, wishlist, photos, address and block list, and withdraw any open proposals. Swaps you completed stay in your partners' history, and reviews you wrote (of swaps and of perfumes) stay as “Former member” — delete perfume reviews first if you'd rather they go. Reviews about you are removed.</p>
      <p class="muted small">If a swap is in progress (accepted but not yet received), finish it first.</p>
      <label for="delType">Type <b>DELETE</b> to confirm</label><input id="delType" type="text" autocomplete="off" required>
      <div class="dlg-actions"><button type="button" class="btn secondary" data-close>Keep my account</button><button class="btn danger" id="delGo">Delete forever</button></div></form>`,
    (m) => $("#delForm", m).addEventListener("submit", (e) => {
      e.preventDefault();
      if ($("#delType", m).value.trim().toUpperCase() !== "DELETE") { toast("Type DELETE to confirm.", "error"); return; }
      run($("#delGo", m), async () => { await api.deleteAccount(); modal.close(); location.hash = "/"; toast("Your account has been deleted. Take care!"); });
    }));
  }

  async function pageWelcome() {
    document.body.classList.add("signed-out");
    const demo = api.mode === "demo";
    setView(html`<section class="welcome">
      <div class="hero">
        <div class="eyebrow">A perfume swap community</div>
        <h1>Swap the scents <em>you love.</em></h1>
        <p class="lead">Trade samples, decants and bottles with fellow perfume lovers. No money, ever — just generosity and good packing.</p>
        <div class="hero-art">${bottleSvg({ brand: "a", name: "c" }, "full")}${bottleSvg({ brand: "b", name: "x" }, "decant")}${bottleSvg({ brand: "q", name: "r" }, "sample")}</div>
        <ul class="points">
          <li>List what you have, what you'd trade, and what you're hunting for.</li>
          <li>We find people who have what you want <i>and</i> want what you have.</li>
          <li>Addresses stay private until both of you accept the swap.</li>
          <li>Reviews and a completed-swap count help you trade with confidence.</li>
        </ul>
        <p class="small muted" style="margin-top:14px">Currently for members in the ${CFG.LAUNCH_COUNTRY} only — perfume can't easily cross borders by mail.</p>
      </div>
      <div class="card">
        <div class="tabs" role="tablist"><button role="tab" aria-selected="true" data-tab="in">Sign in</button><button role="tab" aria-selected="false" data-tab="up">Create account</button></div>
        <form id="authForm">
          <div class="field" id="nameField" hidden><label for="dn">Display name</label><input id="dn" type="text" maxlength="40" autocomplete="nickname" placeholder="What should people call you?"></div>
          <div class="field"><label for="em">Email</label><input id="em" type="email" required autocomplete="email"></div>
          <div class="field"><label for="pw">Password</label><input id="pw" type="password" required minlength="8" autocomplete="current-password"><p class="hint" id="pwHint" hidden>At least 8 characters.</p></div>
          <div class="field" id="dobField" hidden><label for="dob">Date of birth</label><input id="dob" type="date" min="1900-01-01" max="${new Date().toISOString().slice(0, 10)}" autocomplete="bday"><p class="hint">Swapfume is for people ${CFG.MIN_AGE} and older. We keep only a yes/no — never your birthday.</p></div>
          <div class="field"><button class="btn block" id="authBtn">Sign in</button></div>
          <p class="small" id="forgotRow" style="margin:0"><a href="#/forgot">Forgot password?</a></p>
          <p class="small muted" id="agreeRow" hidden style="margin:0">By creating an account you agree to the <a href="#/terms">Terms of Use</a> and <a href="#/privacy">Privacy Policy</a>, and confirm you are ${CFG.MIN_AGE} or older.</p>
        </form>
        ${demo ? html`<hr class="soft"><div class="notice"><b>Demo mode.</b> Nothing leaves this browser. Create any account (e.g. you@test.com), or step in as a pretend member:</div>
          <div class="row" style="margin-top:10px" id="demoUsers">${api.demoUsers().filter((u) => u.id.startsWith("m-")).map((u) => html`<button class="btn small secondary" data-as="${u.id}">${u.display_name}${u.is_admin ? " (admin)" : ""}</button>`)}</div>` : ""}
      </div></section>`);
    let mode = "in";
    $$("[data-tab]").forEach((b) => b.addEventListener("click", () => {
      mode = b.dataset.tab;
      $$("[data-tab]").forEach((x) => x.setAttribute("aria-selected", x === b));
      $("#nameField").hidden = mode === "in"; $("#pwHint").hidden = mode === "in";
      $("#dobField").hidden = mode === "in"; $("#dob").required = mode === "up";
      $("#forgotRow").hidden = mode === "up"; $("#agreeRow").hidden = mode === "in";
      $("#authBtn").textContent = mode === "in" ? "Sign in" : "Create account";
      $("#pw").autocomplete = mode === "in" ? "current-password" : "new-password";
    }));
    $("#authForm").addEventListener("submit", (e) => {
      e.preventDefault();
      run($("#authBtn"), async () => {
        const email = $("#em").value, password = $("#pw").value;
        if (mode === "in") await api.signIn({ email, password });
        else {
          const birthdate = $("#dob").value;
          if (!birthdate) throw new Error("Please enter your date of birth.");
          if (!isAdult(birthdate)) throw new Error(`Sorry — you must be ${CFG.MIN_AGE} or older to join Swapfume.`);
          const r = await api.signUp({ email, password, display_name: $("#dn").value, birthdate });
          if (r.needsConfirmation) { toast("Check your email to confirm your account, then sign in."); return; }
          sessionStorage.setItem("swapfume_new", "1");
        }
      });
    });
    $$("[data-as]").forEach((b) => b.addEventListener("click", () => api.demoSwitchUser(b.dataset.as)));
  }

  async function pageHome() {
    const uid = state.uid;
    const [mine, myWishes, address] = await Promise.all([api.listItems({ ownerId: uid }), api.listWishes({ userId: uid }), api.getMyAddress()]);
    const myTradeable = mine.filter((i) => i.tradeable && !i.is_hidden);
    const wantIds = myWishes.map((w) => w.perfume_id);
    const haveIds = [...new Set(myTradeable.map((i) => i.perfume_id))];
    const [theyHave, theyWant] = await Promise.all([
      api.listItems({ tradeableOnly: true, perfumeIds: wantIds, excludeOwnerId: uid }),
      api.listWishes({ perfumeIds: haveIds, excludeUserId: uid })
    ]);
    const people = new Map();
    const person = (u) => { if (!people.has(u.id)) people.set(u.id, { user: u, has: [], wants: [] }); return people.get(u.id); };
    theyHave.forEach((i) => i.owner && person(i.owner).has.push(i));
    theyWant.forEach((w) => w.user && person(w.user).wants.push(w));
    const all = [...people.values()];
    const perfect = all.filter((x) => x.has.length && x.wants.length).sort((a, b) => b.has.length + b.wants.length - a.has.length - a.wants.length);
    const hasOnly = all.filter((x) => x.has.length && !x.wants.length);
    const wantsOnly = all.filter((x) => !x.has.length && x.wants.length);
    const stats = await api.getStats(all.map((x) => x.user.id));
    const p = state.profile;

    const steps = [
      [!!(p.city || p.country), "Add your city and a short bio", "#/me"],
      [!!address, "Add your shipping address (kept private)", "#/me"],
      [mine.length > 0, "Add a perfume you have", "#/collection"],
      [myWishes.length > 0, "Add a perfume you want", "#/collection?tab=want"]
    ];
    const todo = steps.filter((s) => !s[0]);

    const matchCard = (x, kind) => {
      const myMatching = (perfId) => myTradeable.filter((i) => i.perfume_id === perfId);
      return html`<article class="card match">
        <div class="match-head">${avatar(x.user)}<div class="grow"><a class="name" href="#/u/${x.user.id}">${x.user.display_name}</a><div class="row small muted">${place(x.user)} ${trust(stats[x.user.id])}</div></div>
          ${kind === "perfect" ? html`<span class="pill rose">Two-way match</span>` : ""}</div>
        <div class="match-sides">
          ${x.has.length ? html`<div class="side"><h4>They have, you want</h4><ul>${x.has.map((i) => html`<li><b>${i.perfume.name}</b> <span class="muted">${i.perfume.brand} · ${SIZE_LABEL[i.size]}${i.volume_ml ? " " + +i.volume_ml + " ml" : ""}</span></li>`)}</ul></div>` : ""}
          ${x.wants.length ? html`<div class="side"><h4>They want, you have</h4><ul>${x.wants.map((w) => html`<li><b>${w.perfume.name}</b> <span class="muted">${w.perfume.brand} · your ${myMatching(w.perfume_id).map((i) => SIZE_LABEL[i.size].toLowerCase()).join(", ")}</span></li>`)}</ul></div>` : ""}
        </div>
        <div class="row">${x.has.length ? html`<a class="btn" href="#/propose/${x.user.id}">Propose a swap</a>` : html`<a class="btn secondary" href="#/u/${x.user.id}">See their collection</a>`}</div>
      </article>`;
    };

    setView(html`
      <div class="page-head"><div class="eyebrow">Hello, ${p.display_name}</div><h1>Your matches</h1><p>People who have what you want — and, best of all, want what you have.</p></div>
      ${todo.length ? html`<div class="card"><h3>Getting started</h3><ul class="list">${steps.map(([done, text, href]) => html`<li class="row between"><span>${done ? html`<span class="pill ok">Done</span>` : html`<span class="pill">To do</span>`} ${text}</span>${done ? "" : html`<a class="btn small secondary" href="${href}">Go</a>`}</li>`)}</ul></div>` : ""}
      <h2>Two-way matches</h2>
      ${perfect.length ? html`<div class="stack">${perfect.map((x) => matchCard(x, "perfect"))}</div>`
        : html`<div class="empty"><h3>No two-way matches yet</h3><p>Add more to your wishlist and mark bottles as “open to trade” — matches appear here automatically.</p><a class="btn secondary" href="#/collection">Update my collection</a></div>`}
      ${hasOnly.length ? html`<h2>Has something you want</h2><p class="muted">They haven't listed anything of yours on their wishlist, but you can still ask.</p><div class="stack">${hasOnly.map((x) => matchCard(x, "has"))}</div>` : ""}
      ${wantsOnly.length ? html`<h2>Wants something you have</h2><div class="stack">${wantsOnly.map((x) => matchCard(x, "wants"))}</div>` : ""}
    `);
  }

  async function pageBrowse(params) {
    const q = params.get("q") || "", size = params.get("size") || "";
    setView(html`<div class="page-head"><h1>Browse trades</h1><p>Everything members are open to swapping right now.</p></div>
      ${browseTabs("trades")}
      <form id="bf" class="row" role="search" style="margin-bottom:16px">
        <input type="search" name="q" value="${q}" placeholder="Search brand or perfume" aria-label="Search trades" style="flex:1;min-width:200px">
        <div class="seg" role="group" aria-label="Size">${[["", "All"], ["sample", "Samples"], ["decant", "Decants"], ["full", "Bottles"]].map(([v, l]) => html`<button type="button" data-size="${v}" aria-pressed="${size === v}">${l}</button>`)}</div>
      </form><div id="results"><div class="spinner"></div></div>`);
    const submit = (sz = size) => go(`/browse?${new URLSearchParams({ ...($("#bf [name=q]").value ? { q: $("#bf [name=q]").value } : {}), ...(sz ? { size: sz } : {}) })}`);
    $("#bf").addEventListener("submit", (e) => { e.preventDefault(); submit(); });
    $$("[data-size]").forEach((b) => b.addEventListener("click", () => submit(b.dataset.size)));
    let items;
    if (q) {
      const ps = await api.searchCatalog(q, { limit: 200 });
      items = await api.listItems({ tradeableOnly: true, perfumeIds: ps.map((p) => p.id), excludeOwnerId: state.uid });
    } else items = await api.listItems({ tradeableOnly: true, excludeOwnerId: state.uid, limit: 120 });
    if (size) items = items.filter((i) => i.size === size);
    $("#results").innerHTML = val(items.length ? html`<p class="small muted">${items.length} listing${items.length === 1 ? "" : "s"}</p><div class="grid">${items.map((i) => itemTile(i, { owner: true }))}</div>`
      : html`<div class="empty"><h3>Nothing here yet</h3><p>${q ? "No one is trading that right now. Add it to your wishlist and you'll see it in Matches when someone lists it." : "No listings yet."}</p><a class="btn secondary" href="#/collection?tab=want">Go to my wishlist</a></div>`);
  }

  function browseTabs(active) {
    return html`<div class="tabs" role="tablist"><a role="tab" class="tablink" href="#/browse" aria-selected="${active === "trades"}">Trades</a><a role="tab" class="tablink" href="#/catalog" aria-selected="${active === "catalog"}">Catalog &amp; reviews</a></div>`;
  }

  // The full perfume catalog: search (brand, name, perfumer), sort by name or rating, filter by perfumer.
  async function pageCatalog(params) {
    const q = params.get("q") || "", sort = params.get("sort") === "rating" ? "rating" : "name", perfumer = params.get("perfumer") || "";
    setView(html`<div class="page-head"><h1>${perfumer ? html`More by ${perfumer}` : "The catalog"}</h1><p>${perfumer ? "Perfumes this perfumer (“nose”) created, as far as our catalog knows." : "Every perfume in Swapfume, with members' ratings. Search by brand, name or perfumer."}</p></div>
      ${browseTabs("catalog")}
      <form id="cf" class="row" role="search" style="margin-bottom:12px">
        <input type="search" name="q" value="${q}" placeholder="Brand, perfume or perfumer" aria-label="Search the catalog" style="flex:1;min-width:200px">
        <div class="seg" role="group" aria-label="Sort">${[["name", "A–Z"], ["rating", "Top rated"]].map(([v, l]) => html`<button type="button" data-sort="${v}" aria-pressed="${sort === v}">${l}</button>`)}</div>
      </form>
      ${perfumer ? html`<p class="small"><span class="pill">Perfumer: ${perfumer}</span> <a href="#/catalog${q ? "?q=" + encodeURIComponent(q) : ""}">Clear</a></p>` : ""}
      <div id="cres"><div class="spinner"></div></div>`);
    const go2 = (o) => { const sp = new URLSearchParams(); const nq = o.q ?? $("#cf [name=q]").value; if (nq) sp.set("q", nq); if ((o.sort ?? sort) === "rating") sp.set("sort", "rating"); if (perfumer) sp.set("perfumer", perfumer); go(`/catalog?${sp}`); };
    $("#cf").addEventListener("submit", (e) => { e.preventDefault(); go2({}); });
    $$("[data-sort]").forEach((b) => b.addEventListener("click", () => go2({ sort: b.dataset.sort })));
    const LIMIT = 120;
    const list = await api.searchCatalog(q, { limit: LIMIT, sort, perfumer });
    $("#cres").innerHTML = val(list.length ? html`<p class="small muted">${list.length === LIMIT ? `First ${LIMIT} results — search to narrow down.` : `${list.length} perfume${list.length === 1 ? "" : "s"}`}</p>
      <ul class="list card catalog-list">${list.map((p) => html`<li class="row" style="flex-wrap:nowrap;gap:12px"><div class="mini-bottle">${bottleSvg(p, "full")}</div>
        <div class="grow"><div class="brand">${p.brand}</div><a class="pname" href="#/perfume/${p.id}">${p.name}</a> <span class="muted small">${p.concentration}${p.year ? " · " + p.year : ""}</span>
          <div class="row small" style="gap:8px;margin-top:2px">${ratingBadge(p)}${familyChip(p)}${classicChip(p)}${p.perfumers?.length ? html`<span class="muted">by ${perfumerLinks(p)}</span>` : ""}</div></div></li>`)}</ul>`
      : html`<div class="empty"><h3>No match</h3><p>Not in the catalog yet? Suggest it and an admin will add it.</p><a class="btn secondary" href="#/request?name=${encodeURIComponent(q)}">Suggest a perfume</a></div>`);
  }

  async function pageCollection(params) {
    const tab = params.get("tab") === "want" ? "want" : "have";
    const [items, wishes] = await Promise.all([api.listItems({ ownerId: state.uid }), api.listWishes({ userId: state.uid })]);
    setView(html`<div class="page-head"><h1>My collection</h1><p>What you own, what you'd trade, and what you're hoping to find.</p></div>
      <div class="tabs" role="tablist"><button role="tab" data-t="have" aria-selected="${tab === "have"}">I have (${items.length})</button><button role="tab" data-t="want" aria-selected="${tab === "want"}">I want (${wishes.length})</button></div>
      <div id="tabBody"></div>`);
    $$("[data-t]").forEach((b) => b.addEventListener("click", () => go(`/collection${b.dataset.t === "want" ? "?tab=want" : ""}`)));
    const body = $("#tabBody");
    if (tab === "have") {
      body.innerHTML = val(html`<div class="row between" style="margin-bottom:14px"><p class="muted small" style="margin:0">${items.filter((i) => i.tradeable).length} open to trade</p><button class="btn" id="addItem">Add a perfume</button></div>
        ${items.length ? html`<div class="grid">${items.map((i) => itemTile(i, { mine: true }))}</div>` : html`<div class="empty"><h3>Your shelf is empty</h3><p>Add the samples, decants and bottles you own. Mark the ones you'd trade.</p></div>`}`);
      $("#addItem").addEventListener("click", () => itemForm(null));
      $$("[data-edit]", body).forEach((b) => b.addEventListener("click", () => itemForm(items.find((i) => i.id == b.dataset.edit))));
      $$("[data-toggle]", body).forEach((b) => b.addEventListener("click", () => run(b, async () => {
        const i = items.find((x) => x.id == b.dataset.toggle); await api.updateItem(i.id, { tradeable: !i.tradeable }); route();
      })));
    } else {
      const counts = await api.listItems({ tradeableOnly: true, perfumeIds: wishes.map((w) => w.perfume_id), excludeOwnerId: state.uid });
      body.innerHTML = val(html`<div class="field"><label>Add to wishlist</label><div id="wishPick"></div></div>
        ${wishes.length ? html`<ul class="list card" style="margin-top:16px">${wishes.map((w) => {
          const n = counts.filter((i) => i.perfume_id === w.perfume_id).length;
          return html`<li class="row between"><div><div class="brand">${w.perfume.brand}</div><a class="pname" href="#/perfume/${w.perfume.id}">${w.perfume.name}</a> <span class="muted small">${w.perfume.concentration}</span> ${familyChip(w.perfume)}
            <div class="small">${n ? html`<a href="#/perfume/${w.perfume.id}">${n} member${n === 1 ? " is" : "s are"} trading this</a>` : html`<span class="muted">No one is trading it yet</span>`}</div></div>
            <button class="btn small ghost" data-unwish="${w.id}" aria-label="Remove ${pTitle(w.perfume)} from wishlist">Remove</button></li>`;
        })}</ul>` : html`<div class="empty" style="margin-top:16px"><h3>What are you hoping to smell?</h3><p>Search above to add perfumes to your wishlist.</p></div>`}`);
      perfumePicker($("#wishPick"), (p) => run(null, async () => { await api.addWish(p.id); toast(`Added ${p.name} to your wishlist.`); route(); }));
      $$("[data-unwish]", body).forEach((b) => b.addEventListener("click", () => run(b, async () => { await api.removeWish(b.dataset.unwish); route(); })));
    }
  }

  async function pagePerfume(id) {
    const p = await api.getPerfume(id);
    if (!p) return setView(html`<div class="empty"><h3>Perfume not found</h3></div>`);
    const [items, wishes, mineW, memberPhoto] = await Promise.all([
      api.listItems({ tradeableOnly: true, perfumeIds: [p.id], excludeOwnerId: state.uid }),
      api.listWishes({ perfumeIds: [p.id] }), api.listWishes({ userId: state.uid }), api.latestMemberPhoto(p.id)]);
    const onMyList = mineW.find((w) => w.perfume_id === p.id);
    const isAdmin = !!state.profile?.is_admin;
    // Picture: admin-set catalog photo (with rights) > newest member photo > drawn bottle.
    let pic, caption = "";
    if (p.image_url) { pic = html`<img src="${p.image_url}" alt="${pTitle(p)}">`; caption = p.image_credit ? `Photo: ${p.image_credit}` : "Catalog photo"; }
    else if (memberPhoto) { pic = html`<img src="${memberPhoto.photo_url}" alt="A member's bottle of ${pTitle(p)}">`; caption = `Member photo by ${memberPhoto.owner?.display_name || "a member"}`; }
    else { pic = bottleSvg(p, "full"); caption = "Illustration"; }
    setView(html`<div class="card perfume-hero">
        <figure class="hero-pic">${pic}<figcaption>${caption}</figcaption></figure>
        <div><div class="brand">${p.brand}</div><h1 style="margin:2px 0">${p.name}</h1>
          <p class="muted" style="margin:0 0 8px">${p.concentration} · ${p.year || "Year unknown"}${p.status !== "approved" ? " · awaiting approval" : ""}</p>
          ${p.perfumers?.length ? html`<p style="margin:0 0 6px">Perfumer: ${perfumerLinks(p)}</p>` : ""}
          <div class="row" style="gap:6px">${ratingBadge(p)}${familyChip(p)}${classicChip(p)}</div>
          <div class="row" style="margin-top:12px"><button class="btn" id="iHave">I have this</button>${onMyList ? html`<span class="pill rose">On your wishlist</span>` : html`<button class="btn secondary" id="iWant">I want this</button>`}</div></div></div>
      <div class="card"><div class="row between"><h3 style="margin:0">Notes</h3><button class="btn small ghost" id="suggestNotes">Suggest a correction</button></div>
        ${notesOf(p).length ? notesPyramid(p) : html`<p class="muted"><b>Details coming soon.</b> Know this one? Suggest its notes or perfumer.</p>`}
        <p class="hint">Notes are community-maintained and may be approximate.</p></div>
      ${isAdmin ? html`<form class="card" id="yearForm"><h3>Release year <span class="pill gold">Admin</span></h3>
        <p class="muted small">Leave empty if unknown. Years before 2000 mark the perfume as a Classic. Only keep those if it's iconic and still sold.</p>
        <div class="row"><input id="yearIn" type="number" min="1700" max="2100" inputmode="numeric" value="${p.year ?? ""}" aria-label="Release year" style="max-width:140px"><button class="btn small" id="yearSave">Save year</button></div></form>` : ""}
      ${isAdmin ? html`<div class="card"><h3>Catalog photo <span class="pill gold">Admin</span></h3>
        <p class="muted small">Only use a photo you took yourself or have permission to use. Never copy brand or shop product photos.</p>
        <form id="imgForm"><div class="field"><input type="file" id="imgFile" accept="image/*" aria-label="Catalog photo file"></div>
          <div class="field"><label for="imgCredit">Credit</label><input id="imgCredit" type="text" maxlength="200" placeholder="e.g. Photo by Margaux"></div>
          <div class="field"><label class="switch"><input type="checkbox" id="imgRights" required> I have the rights to use this photo</label></div>
          <div class="row"><button class="btn small" id="imgSave">Set catalog photo</button>${p.image_url ? html`<button type="button" class="btn small secondary" id="imgRemove">Remove catalog photo</button>` : ""}</div></form></div>` : ""}
      <div id="prBox"><div class="spinner"></div></div>
      <h2>Open to trade (${items.length})</h2>
      ${items.length ? html`<div class="grid">${items.map((i) => itemTile(i, { owner: true }))}</div>` : html`<p class="muted">No one is trading this right now.</p>`}
      <h2>On ${wishes.length} wishlist${wishes.length === 1 ? "" : "s"}</h2>
      <p>${wishes.length ? wishes.map((w, k) => html`${k ? ", " : ""}<a href="#/u/${w.user.id}">${w.user.display_name}</a>`) : html`<span class="muted">No one yet.</span>`}</p>`);
    $("#iHave").addEventListener("click", () => itemForm(null, p));
    const iw = $("#iWant"); if (iw) iw.addEventListener("click", () => run(iw, async () => { await api.addWish(p.id); toast("Added to your wishlist."); route(); }));
    $("#suggestNotes").addEventListener("click", () => notesDialog(p));
    perfumeReviews(p, $("#prBox"));
    const yf = $("#yearForm");
    if (yf) yf.addEventListener("submit", (e) => { e.preventDefault(); run($("#yearSave"), async () => { await api.setPerfumeYear(p.id, $("#yearIn").value); toast("Year saved."); route(); }); });
    const f = $("#imgForm");
    if (f) {
      f.addEventListener("submit", (e) => { e.preventDefault(); run($("#imgSave"), async () => {
        const file = $("#imgFile").files[0]; if (!file) { toast("Choose a photo first.", "error"); return; }
        await api.setPerfumeImage(p.id, file, $("#imgCredit").value); toast("Catalog photo set."); route(); }); });
      const rm = $("#imgRemove"); if (rm) rm.addEventListener("click", () => run(rm, async () => { await api.setPerfumeImage(p.id, null, ""); toast("Catalog photo removed."); route(); }));
    }
  }

  // ---------- Perfume reviews (stars + quick tags) ----------
  const TAGS = {
    longevity: [["weak", "Weak"], ["moderate", "Moderate"], ["long-lasting", "Long-lasting"], ["beast", "Beast mode"]],
    sillage: [["intimate", "Intimate"], ["moderate", "Moderate"], ["strong", "Strong"]],
    seasons: [["spring", "Spring"], ["summer", "Summer"], ["fall", "Fall"], ["winter", "Winter"]],
    daytimes: [["day", "Day"], ["night", "Night"]]
  };
  const tagLabel = (kind, v) => (TAGS[kind].find((t) => t[0] === v) || [v, v])[1];
  function tagSummary(rs) {
    if (!rs.length) return "";
    const count = (kind, multi) => TAGS[kind].map(([v, l]) => [l, rs.filter((r) => multi ? (r[kind] || []).includes(v) : r[kind] === v).length]).filter((x) => x[1]);
    const voters = (kind, multi) => rs.filter((r) => multi ? (r[kind] || []).length : r[kind]).length;
    const block = (title, kind, multi) => {
      const c = count(kind, multi), n = voters(kind, multi);
      if (!n) return "";
      return html`<div class="tagsum"><div class="small muted">${title}</div>${c.map(([l, k]) => html`<div class="bar-row"><span>${l}</span><span class="bar"><span style="width:${Math.round((k / n) * 100)}%"></span></span><span class="small muted">${k}</span></div>`)}</div>`;
    };
    return html`<div class="tagsums">${block("Longevity", "longevity")}${block("Sillage (how far it projects)", "sillage")}${block("Best seasons", "seasons", true)}${block("Day or night", "daytimes", true)}</div>`;
  }
  async function perfumeReviews(p, box) {
    const all = await api.listPerfumeReviews(p.id);
    const mine = all.find((r) => r.user_id === state.uid);
    const visible = all.filter((r) => !r.is_hidden);
    const others = all.filter((r) => r !== mine);
    let showAll = false;
    const opt = (kind, cur) => TAGS[kind].map(([v, l]) => html`<option value="${v}" ${cur === v ? raw("selected") : ""}>${l}</option>`);
    const checks = (kind, cur) => TAGS[kind].map(([v, l]) => html`<label class="chk"><input type="checkbox" name="${kind}" value="${v}" ${(cur || []).includes(v) ? raw("checked") : ""}> ${l}</label>`);
    const reviewLi = (r) => html`<li class="${r.is_hidden ? "is-hidden" : ""}"><div class="row between"><span><span class="stars" aria-label="${r.rating} out of 5 stars">${starsText(r.rating)}</span> <b>${r.author ? html`<a href="#/u/${r.author.id}">${r.author.display_name}</a>` : "Former member"}</b>${r.demo ? html` <span class="pill grey" title="Sample review that exists only in demo mode">Demo review</span>` : ""}${r.is_hidden ? html` <span class="pill warn">Hidden by admin</span>` : ""}</span><span class="small muted">${fmtDate(r.created_at)}</span></div>
        ${[r.longevity && tagLabel("longevity", r.longevity), r.sillage && tagLabel("sillage", r.sillage) + " sillage", ...(r.seasons || []).map((x) => tagLabel("seasons", x)), ...(r.daytimes || []).map((x) => tagLabel("daytimes", x))].filter(Boolean).length
          ? html`<div class="row" style="gap:6px;margin-top:4px">${[r.longevity && tagLabel("longevity", r.longevity), r.sillage && tagLabel("sillage", r.sillage) + " sillage", ...(r.seasons || []).map((x) => tagLabel("seasons", x)), ...(r.daytimes || []).map((x) => tagLabel("daytimes", x))].filter(Boolean).map((t) => html`<span class="note">${t}</span>`)}</div>` : ""}
        ${r.body ? html`<p style="margin:6px 0 0">${r.body}</p>` : ""}
        ${r.user_id !== state.uid ? html`<div class="row small" style="margin-top:6px;gap:6px"><button class="btn small ghost" data-help="${r.id}" data-on="${!r.voted}" aria-pressed="${!!r.voted}">${r.voted ? "✓ Helpful" : "Helpful"}${r.helpful_count ? ` (${r.helpful_count})` : ""}</button>
          <button class="btn small ghost" data-repr="${r.id}" data-author="${r.user_id || ""}">Report</button>
          ${state.profile?.is_admin ? html`<button class="btn small ghost" data-hider="${r.id}" data-h="${!r.is_hidden}">${r.is_hidden ? "Unhide" : "Hide"} <span class="pill gold">Admin</span></button>` : ""}</div>`
          : r.helpful_count ? html`<div class="small muted" style="margin-top:4px">${r.helpful_count} found this helpful</div>` : ""}</li>`;
    const draw = (editing) => {
      const listed = showAll ? others : others.slice(0, 8);
      box.innerHTML = val(html`<div class="card"><div class="row between"><h3 style="margin:0">Member reviews</h3>${p.rating_count ? html`<span class="rating-lg"><span class="stars">★</span> ${(+p.rating_avg).toFixed(1)} <span class="muted small">from ${p.rating_count} rating${p.rating_count === 1 ? "" : "s"}</span></span>` : ""}</div>
        ${visible.length ? tagSummary(visible) : html`<p class="muted">No reviews yet — be the first to say how it wears.</p>`}
        ${mine && !editing ? html`<hr class="soft"><div class="small muted">Your review</div><ul class="list">${reviewLi(mine)}</ul><div class="row"><button class="btn small secondary" id="prEdit">Edit</button><button class="btn small ghost" id="prDel">Delete</button></div>`
          : html`<hr class="soft"><form id="prForm"><h4 style="margin:0 0 6px">${mine ? "Edit your review" : "Rate this perfume"}</h4>
            <div class="star-input" role="radiogroup" aria-label="Your rating">${[5, 4, 3, 2, 1].map((n) => html`<input type="radio" name="prRating" id="pr${n}" value="${n}" ${mine?.rating === n ? raw("checked") : ""}><label for="pr${n}" title="${n} star${n > 1 ? "s" : ""}" aria-label="${n} star${n > 1 ? "s" : ""}">★</label>`)}</div>
            <div class="two field"><div><label for="prLon">Longevity</label><select id="prLon"><option value="">—</option>${opt("longevity", mine?.longevity)}</select></div>
              <div><label for="prSil">Sillage</label><select id="prSil"><option value="">—</option>${opt("sillage", mine?.sillage)}</select></div></div>
            <div class="field"><div class="small muted">Best for</div><div class="row" style="gap:10px">${checks("seasons", mine?.seasons)}${checks("daytimes", mine?.daytimes)}</div></div>
            <div class="field"><label for="prBody">Your thoughts <span class="muted">(optional)</span></label><textarea id="prBody" maxlength="1000" placeholder="How does it open, how does it dry down, who would love it?">${mine?.body || ""}</textarea></div>
            <div class="row"><button class="btn small" id="prSave">${mine ? "Save changes" : "Post review"}</button>${mine ? html`<button type="button" class="btn small ghost" id="prCancel">Cancel</button>` : ""}</div></form>`}
        ${others.length ? html`<hr class="soft"><ul class="list">${listed.map(reviewLi)}</ul>${!showAll && others.length > listed.length ? html`<button class="btn small ghost" id="prMore">Show all ${others.length} reviews</button>` : ""}` : ""}
        <p class="hint">Reviews are members' personal impressions. Report anything rude, off-topic or selling.</p></div>`);
      const b = (sel, fn) => { const el = $(sel, box); if (el) el.addEventListener("click", fn); };
      b("#prEdit", () => draw(true)); b("#prCancel", () => draw(false)); b("#prMore", () => { showAll = true; draw(editing); });
      b("#prDel", async () => { if (await confirmBox("Delete your review?", "Your stars and text will be removed.", "Delete")) run(null, async () => { await api.deletePerfumeReview(mine.id); toast("Review deleted."); route(); }); });
      const f = $("#prForm", box);
      if (f) f.addEventListener("submit", (e) => {
        e.preventDefault();
        const fd = new FormData(f), rating = fd.get("prRating");
        if (!rating) { toast("Pick a star rating.", "error"); return; }
        run($("#prSave", box), async () => {
          await api.savePerfumeReview({ perfumeId: p.id, rating, body: $("#prBody", box).value, longevity: $("#prLon", box).value, sillage: $("#prSil", box).value, seasons: fd.getAll("seasons"), daytimes: fd.getAll("daytimes") });
          toast(mine ? "Review updated." : "Thanks for your review!"); route();
        });
      });
      $$("[data-help]", box).forEach((x) => x.addEventListener("click", () => run(x, async () => { await api.voteHelpful(x.dataset.help, x.dataset.on === "true"); perfumeReviews(p, box); })));
      $$("[data-repr]", box).forEach((x) => x.addEventListener("click", () => reportDialog({ targetUserId: x.dataset.author || null, targetPerfumeReviewId: x.dataset.repr, what: "this review" })));
      $$("[data-hider]", box).forEach((x) => x.addEventListener("click", () => run(x, async () => { await api.setPerfumeReviewHidden(x.dataset.hider, x.dataset.h === "true"); route(); })));
    };
    draw(false);
  }

  function notesDialog(p) {
    const join = (a) => (a || []).join(", ");
    openModal(html`<form class="dlg" id="nForm"><h3>Suggest details for ${p.name}</h3>
      <p class="muted small">Separate notes with commas. An admin checks every suggestion before it changes the catalog.</p>
      <div class="field"><label for="nFam">Scent family</label><select id="nFam"><option value="">Not sure</option>${window.SCENT_FAMILIES.map((f) => html`<option ${p.family === f ? raw("selected") : ""}>${f}</option>`)}</select></div>
      <div class="field"><label for="nTop">Top notes</label><input id="nTop" type="text" value="${join(p.notes_top)}"></div>
      <div class="field"><label for="nHeart">Heart notes</label><input id="nHeart" type="text" value="${join(p.notes_heart)}"></div>
      <div class="field"><label for="nBase">Base notes</label><input id="nBase" type="text" value="${join(p.notes_base)}"></div>
      <div class="field"><label for="nNose">Perfumer(s)</label><input id="nNose" type="text" value="${join(p.perfumers)}" placeholder="e.g. Francis Kurkdjian"></div>
      <div class="field"><label for="nWhy">Why? <span class="muted">(optional)</span></label><input id="nWhy" type="text" maxlength="500" placeholder="e.g. The brand's own description lists…"></div>
      <div class="dlg-actions"><button type="button" class="btn secondary" data-close>Cancel</button><button class="btn" id="nSend">Send suggestion</button></div></form>`,
    (m) => $("#nForm", m).addEventListener("submit", (e) => {
      e.preventDefault();
      const split = (v) => v.split(",").map((x) => x.trim()).filter(Boolean);
      run($("#nSend", m), async () => {
        await api.suggestNotes({ perfumeId: p.id, family: $("#nFam", m).value, top: split($("#nTop", m).value), heart: split($("#nHeart", m).value), base: split($("#nBase", m).value), perfumers: split($("#nNose", m).value), comment: $("#nWhy", m).value });
        modal.close(); toast("Thanks! An admin will review your suggestion.");
      });
    }));
  }

  async function pageRequest(params) {
    setView(html`<div class="page-head"><h1>Suggest a perfume</h1><p>Can't find it in the catalog? Suggest it — an admin checks every request so the catalog stays tidy.</p></div>
      <form class="card" id="reqForm">
        <div class="two"><div><label for="rb">Brand</label><input id="rb" type="text" required maxlength="80" value="${params.get("brand") || ""}"></div>
        <div><label for="rn">Perfume name</label><input id="rn" type="text" required maxlength="120" value="${params.get("name") || ""}"></div></div>
        <div class="two field"><div><label for="rc">Concentration</label><select id="rc">${["Eau de Parfum", "Eau de Toilette", "Parfum", "Extrait de Parfum", "Eau de Cologne", "Perfume Oil / Attar", "Other / not sure"].map((c) => html`<option>${c}</option>`)}</select></div>
        <div><label for="ry">Release year</label><input id="ry" type="number" min="1700" max="2100" inputmode="numeric" required></div></div>
        <p class="hint">The catalog covers perfumes from 2000 onward, plus true classics from before 2000 that are still sold today.</p>
        <div id="similar" class="field"></div>
        <div class="field"><button class="btn" id="reqBtn">Send suggestion</button></div>
      </form>`);
    const checkSimilar = async () => {
      const b = $("#rb").value, n = $("#rn").value;
      if (!b.trim() || !n.trim()) { $("#similar").innerHTML = ""; return; }
      const sim = await api.similarPerfumes(b, n);
      $("#similar").innerHTML = val(sim.length ? html`<div class="notice">Already in the catalog: ${sim.map((p, k) => html`${k ? ", " : ""}<a href="#/perfume/${p.id}">${pTitle(p)} (${p.concentration})</a>`)}. Only suggest it if yours is a different concentration.</div>` : "");
    };
    $("#rb").addEventListener("change", checkSimilar); $("#rn").addEventListener("change", checkSimilar); checkSimilar();
    $("#reqForm").addEventListener("submit", (e) => {
      e.preventDefault();
      run($("#reqBtn"), async () => {
        const conc = $("#rc").value === "Other / not sure" ? "" : $("#rc").value;
        const r = await api.requestPerfume({ brand: $("#rb").value, name: $("#rn").value, concentration: conc, year: $("#ry").value });
        if (r.result === "exists") { toast("That one is already in the catalog."); go(`/perfume/${r.id}`); }
        else if (r.result === "already_requested") { toast("Someone already suggested it — it's waiting for approval."); }
        else { toast("Thanks! It will appear once an admin approves it."); go("/collection"); }
      });
    });
  }

  async function pageUser(id) {
    const p = await api.getProfile(id);
    if (!p) return setView(html`<div class="empty"><h3>Member not found</h3></div>`);
    const isMe = id === state.uid;
    const [items, wishes, reviews, stats, blocks] = await Promise.all([api.listItems({ ownerId: id }), api.listWishes({ userId: id }), api.listReviews({ revieweeId: id }), api.getStats([id]), isMe ? [] : api.listBlocks()]);
    const iBlocked = blocks.some((b) => b.blocked_id === id);
    const shown = isMe ? items : items.filter((i) => i.tradeable);
    setView(html`<div class="card"><div class="profile-head">${avatar(p, "lg")}<div><h1>${p.display_name}</h1><div class="muted">${place(p) || "Location not set"}</div><div style="margin-top:6px">${trust(stats[id])}</div></div></div>
        ${p.is_banned ? html`<div class="notice rose" style="margin-top:12px">This account has been suspended.</div>` : ""}
        ${p.bio ? html`<p style="margin-top:14px">${p.bio}</p>` : ""}
        ${iBlocked ? html`<div class="notice" style="margin-top:12px">You blocked ${p.display_name}. You don't see each other's listings or wishlists, and neither of you can propose a swap. They aren't told.</div>` : ""}
        <div class="row" style="margin-top:12px">${isMe ? html`<a class="btn secondary" href="#/me">Edit profile</a>` : html`${!p.is_banned && !iBlocked && items.some((i) => i.tradeable) ? html`<a class="btn" href="#/propose/${id}">Propose a swap</a>` : ""}<button class="btn ghost" id="repUser">Report</button>${iBlocked ? html`<button class="btn ghost" id="unblockUser">Unblock</button>` : html`<button class="btn ghost" id="blockUser">Block</button>`}`}</div></div>
      ${iBlocked ? "" : html`<h2>${isMe ? "Collection" : "Open to trade"}</h2>
      ${shown.length ? html`<div class="grid">${shown.map((i) => html`<div>${itemTile(i)}${isMe ? "" : html`<button class="btn small ghost" data-repitem="${i.id}" style="margin-top:4px">Report listing</button>`}</div>`)}</div>` : html`<p class="muted">Nothing listed for trade right now.</p>`}
      <h2>Wishlist</h2>
      ${wishes.length ? html`<div class="row">${wishes.map((w) => html`<a class="pill" href="#/perfume/${w.perfume.id}">${pTitle(w.perfume)}</a>`)}</div>` : html`<p class="muted">Empty.</p>`}`}
      <h2>Reviews</h2>
      ${reviews.length ? html`<ul class="list card">${reviews.map((r) => html`<li><div class="row between"><span class="stars" aria-label="${r.rating} out of 5 stars">${starsText(r.rating)}</span><span class="small muted">${r.reviewer?.display_name || "Former member"} · ${fmtDate(r.created_at)}</span></div>${r.comment ? html`<p style="margin:4px 0 0">${r.comment}</p>` : ""}</li>`)}</ul>` : html`<p class="muted">No reviews yet. Reviews can only be left by swap partners after a completed swap.</p>`}`);
    const ru = $("#repUser"); if (ru) ru.addEventListener("click", () => reportDialog({ targetUserId: id, what: p.display_name }));
    const bu = $("#blockUser");
    if (bu) bu.addEventListener("click", async () => {
      if (!(await confirmBox(`Block ${p.display_name}?`, "You won't see each other's listings or wishlists, and neither of you can propose a swap. Open proposals between you are withdrawn; swaps already accepted carry on so packages can arrive. They aren't told. You can unblock any time from Me.", "Block"))) return;
      run(null, async () => { await api.blockUser(id); toast(`${p.display_name} is blocked.`); route(); refreshSwapDot(); });
    });
    const ub = $("#unblockUser"); if (ub) ub.addEventListener("click", () => run(ub, async () => { await api.unblockUser(id); toast("Unblocked."); route(); }));
    $$("[data-repitem]").forEach((b) => b.addEventListener("click", () => reportDialog({ targetUserId: id, targetItemId: b.dataset.repitem, what: "this listing" })));
  }

  async function pagePropose(otherId) {
    if (otherId === state.uid) return go("/collection");
    const [other, theirs, mine, myW, theirW, address, stats] = await Promise.all([
      api.getProfile(otherId), api.listItems({ ownerId: otherId, tradeableOnly: true }), api.listItems({ ownerId: state.uid }),
      api.listWishes({ userId: state.uid }), api.listWishes({ userId: otherId }), api.getMyAddress(), api.getStats([otherId, state.uid])]);
    if (!other) return setView(html`<div class="empty"><h3>Member not found</h3></div>`);
    if ((await api.listBlocks()).some((b) => b.blocked_id === otherId)) return setView(html`<div class="empty"><h3>You blocked ${other.display_name}</h3><p>Unblock them from their profile to swap again.</p><a class="btn secondary" href="#/u/${otherId}">Their profile</a></div>`);
    const myT = mine.filter((i) => i.tradeable && !i.is_hidden);
    const wantSet = new Set(myW.map((w) => w.perfume_id)), theyWantSet = new Set(theirW.map((w) => w.perfume_id));
    const newbie = !stats[otherId]?.completed_swaps || !stats[state.uid]?.completed_swaps;
    setView(html`<div class="page-head"><div class="eyebrow">New proposal</div><h1>Swap with ${other.display_name}</h1><p>Pick what you'd like from them, and what you'll send. They can accept or decline.</p></div>
      ${!address ? html`<div class="notice rose">You need a shipping address before proposing. It stays private until both of you accept. <a href="#/me">Add it now</a></div>` : ""}
      ${newbie ? html`<div class="notice" style="margin-top:10px"><b>Tip for first swaps:</b> start with samples or decants before trading full bottles. It builds trust on both sides.</div>` : ""}
      <form id="pf">
        <h2>You'd receive</h2>
        ${theirs.length ? html`<div class="grid">${theirs.map((i) => itemTile(i, { select: "their", checked: wantSet.has(i.perfume_id) }))}</div>` : html`<p class="muted">They have nothing open to trade right now.</p>`}
        <h2>You'd send</h2>
        ${myT.length ? html`<div class="grid">${myT.map((i) => itemTile(i, { select: "mine", checked: theyWantSet.has(i.perfume_id) }))}</div>` : html`<div class="empty"><p>You have nothing marked “open to trade”.</p><a class="btn secondary" href="#/collection">Go to my collection</a></div>`}
        <div class="field" style="margin-top:20px"><label for="msg">A note for ${other.display_name} <span class="muted">(optional)</span></label><textarea id="msg" maxlength="600" placeholder="Hi! I'd love to try this. I always wrap decants in bubble wrap…"></textarea></div>
        <div class="field"><button class="btn" id="sendProp" ${!address || !theirs.length || !myT.length ? raw("disabled") : ""}>Send proposal</button></div>
      </form>`);
    bindSelectable(view);
    $("#pf").addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      run($("#sendProp"), async () => {
        const id = await api.proposeSwap({ recipientId: otherId, myItemIds: fd.getAll("mine"), theirItemIds: fd.getAll("their"), message: $("#msg").value });
        toast("Proposal sent."); go(`/swap/${id}`);
      });
    });
  }

  async function pageSwaps() {
    const [swaps, reviewed] = await Promise.all([api.listMySwaps(), myReviewedSet()]);
    const rows = swaps.map((s) => ({ s, info: swapInfo(s, reviewed.has(s.id)) }));
    const needs = rows.filter((r) => r.info.needsMe);
    const going = rows.filter((r) => !r.info.needsMe && ["proposed", "accepted"].includes(r.s.status));
    const past = rows.filter((r) => !r.info.needsMe && !["proposed", "accepted"].includes(r.s.status));
    const row = ({ s, info }) => html`<li><a class="swap-row" href="#/swap/${s.id}">${avatar(info.other)}<div class="grow">
        <div class="title">${info.name}</div>
        <div class="small muted ellipsis">Get ${info.get.map((x) => x.perfume?.name).join(", ")} · give ${info.give.map((x) => x.perfume?.name).join(", ")}</div></div>
        <span class="pill ${info.tone}">${info.label}</span></a></li>`;
    const section = (title, list) => list.length ? html`<h2>${title}</h2><ul class="list card">${list.map(row)}</ul>` : "";
    setView(html`<div class="page-head"><h1>My swaps</h1><p>Proposals, packages on the way, and swaps waiting for a review.</p></div>
      ${swaps.length ? html`${section("Needs you", needs)}${section("In progress", going)}${section("Past", past)}`
        : html`<div class="empty"><h3>No swaps yet</h3><p>Find someone in your matches and propose a swap.</p><a class="btn" href="#/">See my matches</a></div>`}`);
  }

  async function pageSwap(id) {
    let s;
    try { s = await api.getSwap(id); } catch (e) { return setView(html`<div class="empty"><h3>Swap not found</h3></div>`); }
    const [reviews, addr, stats] = await Promise.all([api.listReviews({ swapId: s.id }), api.getPartnerAddress(s.id), api.getStats([s.proposer_id, s.recipient_id])]);
    const myReview = reviews.find((r) => r.reviewer_id === state.uid), theirReview = reviews.find((r) => r.reviewer_id !== state.uid);
    const info = swapInfo(s, !!myReview);
    const o = info.other, on = info.name;
    const accepted = ["accepted", "completed"].includes(s.status);
    const st = (done, now, t, d) => html`<li class="${done ? "done" : now ? "now" : ""}"><span class="mark">${done ? raw("&#10003;") : ""}</span><div><div class="t">${t}</div>${d ? html`<div class="d">${d}</div>` : ""}</div></li>`;
    const bothShipped = info.my.shipped && info.their.shipped, bothReceived = info.my.received && info.their.received;
    const closed = ["declined", "cancelled"].includes(s.status);
    const itemsList = (list) => html`<ul class="list">${list.map((x) => html`<li class="row" style="gap:12px;flex-wrap:nowrap"><div style="width:34px;height:48px;flex:none">${bottleSvg(x.perfume, x.size)}</div><div><div class="brand">${x.perfume?.brand}</div><b class="pname" style="font-size:1.05rem">${x.perfume?.name}</b><div class="meta">${SIZE_LABEL[x.size]}${x.volume_ml ? " · " + +x.volume_ml + " ml" : ""}</div></div></li>`)}</ul>`;

    let action = "";
    if (s.status === "proposed" && !info.iAmP) action = html`<div class="row"><button class="btn" id="accept">Accept swap</button><button class="btn secondary" id="decline">Decline</button></div><p class="hint">When you accept, you'll both see each other's shipping address.</p>`;
    else if (s.status === "proposed") action = html`<button class="btn secondary" id="cancel">Withdraw proposal</button>`;
    else if (s.status === "accepted") {
      action = html`<div class="row">${!info.my.shipped ? html`<button class="btn" id="ship">I've shipped my package</button>` : ""}
        ${info.their.shipped && !info.my.received ? html`<button class="btn" id="recv">Their package arrived</button>` : ""}</div>
        ${!info.my.shipped ? html`<p class="hint">Perfume is flammable: ship by ground only, cushion glass well, and seal the atomizer.</p>` : ""}`;
    }
    setView(html`<a href="#/swaps" class="btn ghost small">&larr; All swaps</a>
      <div class="page-head" style="margin-top:8px"><div class="eyebrow">Swap started ${fmtDate(s.created_at)}</div><h1>With ${o ? html`<a href="#/u/${o.id}" style="color:inherit">${on}</a>` : on}</h1><div class="row">${trust(stats[o?.id])} <span class="pill ${info.tone}">${info.label}</span></div></div>
      <div class="stack">
        ${s.message ? html`<div class="card"><div class="small muted">${info.iAmP ? "Your note" : `${on}'s note`}</div><p style="margin:4px 0 0">“${s.message}”</p></div>` : ""}
        <div class="card"><div class="match-sides">
          <div><h3>You receive</h3>${itemsList(info.get)}</div><div><h3>You send</h3>${itemsList(info.give)}</div></div></div>
        ${closed ? html`<div class="notice">${s.status === "declined" ? "This proposal was declined." : "This proposal was withdrawn."}</div>` : html`
        <div class="card"><h3>Progress</h3><ol class="steps">
          ${st(true, false, "Proposed", `${info.iAmP ? "You" : on} proposed this swap`)}
          ${st(accepted, s.status === "proposed", "Accepted", accepted ? "Addresses are now visible to both of you" : `Waiting for ${info.iAmP ? on : "you"}`)}
          ${st(bothShipped, accepted && !bothShipped, "Both packages shipped", accepted ? `You: ${info.my.shipped ? "shipped " + fmtDate(info.my.shipped) : "not yet"} · ${on}: ${info.their.shipped ? "shipped " + fmtDate(info.their.shipped) : "not yet"}` : "")}
          ${st(bothReceived, bothShipped && !bothReceived, "Both packages arrived", accepted ? `You: ${info.my.received ? "received" : "not yet"} · ${on}: ${info.their.received ? "received" : "not yet"}` : "")}
          ${st(!!(myReview && theirReview), s.status === "completed", "Reviewed", s.status === "completed" ? `You: ${myReview ? "done" : "not yet"} · ${on}: ${theirReview ? "done" : "not yet"}` : "")}
        </ol>${action}</div>`}
        ${accepted && o ? html`<div class="card"><h3>Ship to</h3>${addr ? html`<div class="address">${addr.full_name}\n${addr.address}</div>` : html`<p class="muted">${on} hasn't added an address yet.</p>`}<p class="hint">Only the two of you can see each other's address, and only for accepted swaps.</p></div>` : ""}
        ${s.status === "completed" ? html`<div class="card"><h3>${myReview ? "Your review" : o ? `How was swapping with ${on}?` : "Review"}</h3>
          ${myReview ? html`<p><span class="stars">${starsText(myReview.rating)}</span> ${myReview.comment}</p>` : !o ? html`<p class="muted">${on} has left Swapfume, so this swap can't be reviewed.</p>` : html`<form id="revForm">
            <div class="star-input" role="radiogroup" aria-label="Rating">${[5, 4, 3, 2, 1].map((n) => html`<input type="radio" name="rating" id="r${n}" value="${n}" ${n === 5 ? raw("required") : ""}><label for="r${n}" title="${n} star${n > 1 ? "s" : ""}" aria-label="${n} star${n > 1 ? "s" : ""}">★</label>`)}</div>
            <div class="field"><label for="rc">Comment <span class="muted">(optional)</span></label><textarea id="rc" maxlength="600" placeholder="Packing, speed, generosity…"></textarea></div>
            <button class="btn" id="revBtn">Post review</button></form>`}
          ${theirReview ? html`<hr class="soft"><div class="small muted">${on}'s review of you</div><p><span class="stars">${starsText(theirReview.rating)}</span> ${theirReview.comment}</p>` : ""}
          <p class="hint">Tip: update your collection — mark what you gave away, add what you received.</p></div>` : ""}
        <div><button class="btn ghost small" id="repSwap">Report a problem with this swap</button></div>
      </div>`);
    const bind = (sel, fn) => { const b = $(sel); if (b) b.addEventListener("click", () => run(b, fn)); };
    bind("#accept", async () => { await api.respondSwap(s.id, true); toast("Accepted! You can now see their address."); route(); refreshSwapDot(); });
    bind("#decline", async () => { if (await confirmBox("Decline this swap?", `${on} will see that you declined.`, "Decline")) { await api.respondSwap(s.id, false); route(); refreshSwapDot(); } });
    bind("#cancel", async () => { if (await confirmBox("Withdraw your proposal?", "You can always propose again later.", "Withdraw")) { await api.cancelSwap(s.id); route(); } });
    bind("#ship", async () => { await api.markShipped(s.id); toast("Marked as shipped."); route(); refreshSwapDot(); });
    bind("#recv", async () => { await api.markReceived(s.id); toast("Lovely — enjoy!"); route(); refreshSwapDot(); });
    bind("#repSwap", async () => reportDialog({ targetUserId: o?.id, what: `your swap with ${on}` }));
    const rf = $("#revForm");
    if (rf) rf.addEventListener("submit", (e) => {
      e.preventDefault();
      const rating = new FormData(rf).get("rating");
      if (!rating) { toast("Pick a star rating.", "error"); return; }
      run($("#revBtn"), async () => { await api.leaveReview({ swapId: s.id, revieweeId: o.id, rating, comment: $("#rc").value }); toast("Thanks for your review!"); route(); refreshSwapDot(); });
    });
  }

  async function pageMe() {
    const p = state.profile, [addr, blocks] = await Promise.all([api.getMyAddress(), api.listBlocks()]);
    setView(html`<div class="page-head"><h1>My profile</h1><p>Your name, city and bio are visible to members. Your address is private.</p></div>
      <form class="card" id="profForm"><h3>Public profile</h3>
        <div class="field"><label for="pn">Display name</label><input id="pn" type="text" required maxlength="40" value="${p.display_name}"></div>
        <div class="two field"><div><label for="pc">City</label><input id="pc" type="text" maxlength="80" value="${p.city}"></div><div><label for="pk">Country</label><input id="pk" type="text" maxlength="80" value="${p.country || CFG.LAUNCH_COUNTRY}"></div></div>
        <div class="field"><label for="pb">Short bio</label><textarea id="pb" maxlength="500" placeholder="What you love to wear, how you pack…">${p.bio}</textarea></div>
        <div class="field row"><button class="btn" id="saveProf">Save profile</button><a class="btn ghost" href="#/u/${p.id}">View my public page</a></div></form>
      <form class="card" id="addrForm"><h3>Shipping address <span class="pill">Private</span></h3>
        <p class="muted small">Shown only to a swap partner after you've both accepted a swap. Needed before you can propose or accept.</p>
        <div class="field"><label for="an">Name on the package</label><input id="an" type="text" required maxlength="120" autocomplete="name" value="${addr?.full_name || ""}"></div>
        <div class="field"><label for="aa">Mailing address</label><textarea id="aa" required minlength="5" maxlength="500" autocomplete="street-address" placeholder="Street, city, state, ZIP">${addr?.address || ""}</textarea></div>
        <div class="field"><button class="btn" id="saveAddr">Save address</button></div></form>
      <div class="card"><div class="row">${p.is_admin ? html`<a class="btn secondary" href="#/admin">Admin tools</a>` : ""}<a class="btn secondary" href="#/request">Suggest a perfume</a><button class="btn ghost" id="signOut">Sign out</button></div></div>
      <div class="card"><h3>Blocked members</h3>
        ${blocks.length ? html`<ul class="list">${blocks.map((b) => html`<li class="row between"><span>${avatar(b.blocked)} <a href="#/u/${b.blocked_id}">${b.blocked?.display_name || "Former member"}</a></span><button class="btn small ghost" data-unblock="${b.blocked_id}">Unblock</button></li>`)}</ul>`
          : html`<p class="muted small">Nobody. To block someone, open their profile and tap Block — you'll stop seeing each other and can't swap.</p>`}</div>
      <div class="card"><h3>Help &amp; legal</h3><div class="row"><a class="btn small secondary" href="#/support">Support</a><a class="btn small ghost" href="#/terms">Terms of Use</a><a class="btn small ghost" href="#/privacy">Privacy Policy</a></div></div>
      <div class="card danger-zone"><h3>Delete account</h3><p class="muted small">Permanently remove your account and your data from Swapfume.</p><button class="btn small danger" id="delAcct">Delete my account…</button></div>
      ${api.mode === "demo" ? html`<div class="card"><h3>Demo tools</h3><p class="muted small">Only in demo mode. Step into another pretend member to answer your proposal, ship, and review.</p>
        <div class="row">${api.demoUsers().filter((u) => u.id !== state.uid).map((u) => html`<button class="btn small secondary" data-as="${u.id}">${u.display_name}</button>`)}</div>
        <p style="margin-top:12px"><button class="btn small danger" id="resetDemo">Reset demo data</button></p></div>` : ""}`);
    $("#profForm").addEventListener("submit", (e) => { e.preventDefault(); run($("#saveProf"), async () => {
      state.profile = await api.updateProfile({ display_name: $("#pn").value, city: $("#pc").value, country: $("#pk").value, bio: $("#pb").value }); toast("Profile saved."); }); });
    $("#addrForm").addEventListener("submit", (e) => { e.preventDefault(); run($("#saveAddr"), async () => { await api.saveMyAddress({ full_name: $("#an").value, address: $("#aa").value }); toast("Address saved."); }); });
    $("#signOut").addEventListener("click", () => api.signOut());
    $("#delAcct").addEventListener("click", deleteAccountDialog);
    $$("[data-unblock]").forEach((b) => b.addEventListener("click", () => run(b, async () => { await api.unblockUser(b.dataset.unblock); toast("Unblocked."); route(); })));
    $$("[data-as]").forEach((b) => b.addEventListener("click", () => { api.demoSwitchUser(b.dataset.as); }));
    const rd = $("#resetDemo"); if (rd) rd.addEventListener("click", async () => { if (await confirmBox("Reset the demo?", "This erases every demo account, listing and swap in this browser and starts fresh.", "Reset")) api.demoReset(); });
  }

  // ---------- Admin: bulk import from CSV ----------
  // Minimal CSV reader: commas, "quoted, fields", "" for a quote, newlines inside quotes.
  function parseCsv(text) {
    const rows = []; let row = [], cell = "", q = false;
    text = text.replace(/^\uFEFF/, "");
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
      else cell += c;
    }
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((x) => x.trim() !== ""));
  }
  const IMPORT_COLS = ["brand", "name", "concentration", "year", "family", "notes_top", "notes_heart", "notes_base", "perfumers"];
  function csvToPerfumes(text) {
    const rows = parseCsv(text);
    if (!rows.length) throw new Error("The file is empty.");
    const head = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
    if (!head.includes("brand") || !head.includes("name")) throw new Error("The first row must be a header with at least “brand” and “name”.");
    const split = (v) => String(v || "").split(/[;|,]/).map((x) => x.trim()).filter(Boolean);
    return rows.slice(1).map((r) => {
      const o = {}; head.forEach((h, k) => { o[h] = (r[k] ?? "").trim(); });
      return { brand: o.brand, name: o.name, concentration: o.concentration || "", year: o.year || "", family: o.family || "",
        notes_top: split(o.notes_top), notes_heart: split(o.notes_heart), notes_base: split(o.notes_base), perfumers: split(o.perfumers) };
    });
  }
  function adminImport(ab) {
    const LABEL = { new: ["New", "ok"], added: ["Added", "ok"], exists: ["Already in catalog", "grey"], duplicate_in_file: ["Duplicate in file", "grey"], pre2000: ["Pre-2000", "warn"], invalid: ["Problem", "rose"] };
    ab.innerHTML = val(html`<div class="card"><h3>Bulk import perfumes</h3>
      <p class="muted small">Upload a CSV with a header row. Columns: <code>${IMPORT_COLS.join(", ")}</code>. Only brand and name are required. Separate several notes or perfumers inside a cell with “;”. Every row goes through the same duplicate check as member suggestions (spelling variants like “EDP” or “Al-Haramain” are caught). Nothing is added until you confirm the preview. Only import data you have the right to use.</p>
      <div class="field"><input type="file" id="csvFile" accept=".csv,text/csv" aria-label="CSV file"></div>
      <div class="field"><label class="switch"><input type="checkbox" id="csvPre"> Also import pre-2000 rows (they're marked Classic — only for iconic perfumes still sold)</label></div>
      <div class="row"><button class="btn small" id="csvPreview">Preview</button><a class="btn small ghost" id="csvTemplate" download="swapfume-import-template.csv">Download a template</a></div></div>
      <div id="csvOut"></div>`);
    $("#csvTemplate", ab).href = "data:text/csv;charset=utf-8," + encodeURIComponent(IMPORT_COLS.join(",") + "\n" + 'Example House,Example Name,Eau de Parfum,2021,woody,"bergamot; pepper",iris,"sandalwood; musk",Jane Doe\n');
    let rows = [];
    const chunks = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, k) => a.slice(k * n, k * n + n));
    const runAll = async (commit) => {
      const out = [];
      for (const [k, part] of chunks(rows, 500).entries()) (await api.importPerfumes(part, commit, $("#csvPre", ab).checked)).forEach((r) => out.push({ ...r, row: r.row + k * 500 }));
      return out;
    };
    const show = (res, committed) => {
      const tally = {}; res.forEach((r) => { tally[r.status] = (tally[r.status] || 0) + 1; });
      const ready = tally.new || 0;
      $("#csvOut", ab).innerHTML = val(html`<div class="card"><h3>${committed ? "Import finished" : "Preview"}</h3>
        <div class="row" style="gap:6px">${Object.entries(tally).map(([k, n]) => html`<span class="pill ${LABEL[k][1]}">${LABEL[k][0]}: ${n}</span>`)}</div>
        <div style="overflow-x:auto;margin-top:10px;max-height:420px;overflow-y:auto"><table class="admin"><thead><tr><th>#</th><th>Brand</th><th>Name</th><th>Conc.</th><th>Year</th><th>Status</th></tr></thead><tbody>
          ${res.slice(0, 500).map((r) => { const x = rows[r.row - 1] || {}; return html`<tr><td>${r.row + 1}</td><td>${x.brand}</td><td>${r.id ? html`<a href="#/perfume/${r.id}">${x.name}</a>` : x.name}</td><td>${x.concentration}</td><td>${x.year}</td><td><span class="pill ${LABEL[r.status][1]}">${LABEL[r.status][0]}</span> <span class="small muted">${r.message || ""}</span></td></tr>`; })}
        </tbody></table>${res.length > 500 ? html`<p class="small muted">Showing the first 500 rows.</p>` : ""}</div>
        ${!committed ? html`<div class="row" style="margin-top:10px"><button class="btn" id="csvGo" ${ready ? "" : raw("disabled")}>Add ${ready} new perfume${ready === 1 ? "" : "s"}</button></div>` : ""}</div>`);
      const goBtn = $("#csvGo", ab);
      if (goBtn) goBtn.addEventListener("click", async () => {
        if (!(await confirmBox(`Add ${ready} perfumes?`, "They go straight into the approved catalog. Rows marked “already in catalog”, “duplicate” or “problem” are skipped.", "Add them"))) return;
        run(goBtn, async () => { const r = await runAll(true); show(r, true); toast(`${r.filter((x) => x.status === "added").length} perfumes added.`); });
      });
    };
    $("#csvPreview", ab).addEventListener("click", (e) => run(e.target, async () => {
      const file = $("#csvFile", ab).files[0];
      if (!file) throw new Error("Choose a CSV file first.");
      rows = csvToPerfumes(await file.text());
      if (!rows.length) throw new Error("No rows found under the header.");
      if (rows.length > 20000) throw new Error("That's a lot — split the file into parts of 20,000 rows or fewer.");
      show(await runAll(false), false);
    }));
  }

  async function pageAdmin(params) {
    if (!state.profile.is_admin) return setView(html`<div class="empty"><h3>Admins only</h3></div>`);
    const tab = params.get("tab") || "catalog";
    setView(html`<div class="page-head"><div class="eyebrow">Admin</div><h1>Moderation</h1></div>
      <div class="tabs" role="tablist">${[["catalog", "Catalog requests"], ["notes", "Notes corrections"], ["import", "Import CSV"], ["reports", "Reports"], ["members", "Members"]].map(([k, l]) => html`<button role="tab" data-t="${k}" aria-selected="${tab === k}">${l}</button>`)}</div><div id="ab"><div class="spinner"></div></div>`);
    $$("[data-t]").forEach((b) => b.addEventListener("click", () => go(`/admin?tab=${b.dataset.t}`)));
    const ab = $("#ab");
    if (tab === "catalog") {
      const rows = await api.listPendingPerfumes();
      ab.innerHTML = val(rows.length ? html`<ul class="list card">${rows.map((p) => html`<li><div class="row between"><div><div class="brand">${p.brand}</div><b class="pname">${p.name}</b> <span class="muted small">${p.concentration || "concentration unknown"}${p.year ? " · " + p.year : ""}</span>
          <div class="small muted">Suggested by ${p.requester?.display_name || "unknown"} · ${fmtDate(p.created_at)}</div>
          ${p.year == null ? html`<div class="notice" style="margin-top:6px">Year unknown. Check it before approving.</div>`
            : p.year < 2000 ? html`<div class="notice rose" style="margin-top:6px"><b>Pre-2000</b>. Approve only if it's a classic: iconic and still sold today. Approving marks it “Classic”.</div>` : ""}
          ${p.similar?.length ? html`<div class="notice" style="margin-top:6px">Possible duplicate of: ${p.similar.map((x) => `${x.name} (${x.concentration})`).join(", ")}</div>` : ""}</div>
          <div class="row"><button class="btn small" data-ok="${p.id}">Approve</button><button class="btn small secondary" data-no="${p.id}">Reject</button></div></div></li>`)}</ul>` : html`<div class="empty"><p>No pending requests.</p></div>`);
      $$("[data-ok]", ab).forEach((b) => b.addEventListener("click", () => run(b, async () => { await api.reviewPerfume(b.dataset.ok, true); toast("Approved."); route(); })));
      $$("[data-no]", ab).forEach((b) => b.addEventListener("click", () => run(b, async () => { await api.reviewPerfume(b.dataset.no, false); toast("Rejected."); route(); })));
    } else if (tab === "notes") {
      const rows = await api.listNoteSuggestions();
      const diff = (label, now, next) => html`<tr><th>${label}</th><td class="muted">${(now || []).join(", ") || "—"}</td><td><b>${(next || []).join(", ") || "—"}</b></td></tr>`;
      ab.innerHTML = val(rows.length ? html`<ul class="list card">${rows.map((s) => html`<li>
          <div class="row between"><div><div class="brand">${s.perfume?.brand}</div><a class="pname" href="#/perfume/${s.perfume_id}">${s.perfume?.name}</a> <span class="muted small">${s.perfume?.concentration}</span></div>
            <span class="small muted">from ${s.suggester?.display_name || "a member"} · ${fmtDate(s.created_at)}</span></div>
          ${s.comment ? html`<p class="small" style="margin:6px 0">“${s.comment}”</p>` : ""}
          <div style="overflow-x:auto"><table class="admin"><thead><tr><th></th><th>Now</th><th>Suggested</th></tr></thead><tbody>
            <tr><th>Family</th><td class="muted">${s.perfume?.family || "—"}</td><td><b>${s.family || "(keep)"}</b></td></tr>
            ${s.notes_top.length + s.notes_heart.length + s.notes_base.length ? html`${diff("Top", s.perfume?.notes_top, s.notes_top)}${diff("Heart", s.perfume?.notes_heart, s.notes_heart)}${diff("Base", s.perfume?.notes_base, s.notes_base)}` : html`<tr><th>Notes</th><td colspan="2" class="muted">(keep)</td></tr>`}
            ${(s.perfumers || []).length ? diff("Perfumer", s.perfume?.perfumers, s.perfumers) : ""}</tbody></table></div>
          <div class="row" style="margin-top:8px"><button class="btn small" data-nok="${s.id}">Approve</button><button class="btn small secondary" data-nno="${s.id}">Reject</button></div></li>`)}</ul>`
        : html`<div class="empty"><p>No note corrections waiting.</p></div>`);
      $$("[data-nok]", ab).forEach((b) => b.addEventListener("click", () => run(b, async () => { await api.reviewNoteSuggestion(b.dataset.nok, true); toast("Notes updated."); route(); })));
      $$("[data-nno]", ab).forEach((b) => b.addEventListener("click", () => run(b, async () => { await api.reviewNoteSuggestion(b.dataset.nno, false); toast("Rejected."); route(); })));
    } else if (tab === "reports") {
      const rows = await api.listReports();
      ab.innerHTML = val(rows.length ? html`<ul class="list card">${rows.map((r) => html`<li><div class="row between"><span class="pill ${r.status === "open" ? "rose" : "grey"}">${r.status === "open" ? "Open" : "Resolved"}</span><span class="small muted">${fmtDate(r.created_at)} · from ${r.reporter?.display_name}</span></div>
          <p style="margin:8px 0">${r.reason}</p>
          <div class="small">About: ${r.target_user ? html`<a href="#/u/${r.target_user.id}">${r.target_user.display_name}</a>${r.target_user.is_banned ? " (banned)" : ""}` : "—"}${r.target_item ? html` · listing: ${pTitle(r.target_item.perfume)}${r.target_item.is_hidden ? " (hidden)" : ""}` : ""}</div>
          ${r.target_perfume_review ? html`<div class="notice" style="margin-top:6px"><div class="small">Review of <a href="#/perfume/${r.target_perfume_review.perfume_id}">${pTitle(r.target_perfume_review.perfume)}</a> by ${r.target_perfume_review.author?.display_name || "Former member"}${r.target_perfume_review.is_hidden ? " (hidden)" : ""}</div><div><span class="stars">${starsText(r.target_perfume_review.rating)}</span> ${r.target_perfume_review.body}</div></div>` : ""}
          <div class="row" style="margin-top:8px">${r.status === "open" ? html`<button class="btn small secondary" data-res="${r.id}">Mark resolved</button>` : ""}
            ${r.target_perfume_review ? html`<button class="btn small secondary" data-hider="${r.target_perfume_review.id}" data-h="${!r.target_perfume_review.is_hidden}">${r.target_perfume_review.is_hidden ? "Unhide review" : "Hide review"}</button>` : ""}
            ${r.target_item ? html`<button class="btn small secondary" data-hide="${r.target_item.id}" data-h="${!r.target_item.is_hidden}">${r.target_item.is_hidden ? "Unhide listing" : "Hide listing"}</button>` : ""}
            ${r.target_user && r.target_user.id !== state.uid ? html`<button class="btn small danger" data-ban="${r.target_user.id}" data-b="${!r.target_user.is_banned}">${r.target_user.is_banned ? "Unban" : "Ban"} ${r.target_user.display_name}</button>` : ""}</div></li>`)}</ul>` : html`<div class="empty"><p>No reports. Lovely.</p></div>`);
      $$("[data-res]", ab).forEach((b) => b.addEventListener("click", () => run(b, async () => { await api.resolveReport(b.dataset.res); route(); })));
      $$("[data-hide]", ab).forEach((b) => b.addEventListener("click", () => run(b, async () => { await api.setItemHidden(b.dataset.hide, b.dataset.h === "true"); route(); })));
      $$("[data-hider]", ab).forEach((b) => b.addEventListener("click", () => run(b, async () => { await api.setPerfumeReviewHidden(b.dataset.hider, b.dataset.h === "true"); route(); })));
    } else if (tab === "import") {
      adminImport(ab);
    } else {
      const rows = await api.listMembers();
      ab.innerHTML = val(html`<div class="card" style="overflow-x:auto"><table class="admin"><thead><tr><th>Member</th><th>Place</th><th>Joined</th><th></th></tr></thead><tbody>${rows.map((m) => html`<tr><td><a href="#/u/${m.id}">${m.display_name}</a>${m.is_admin ? html` <span class="pill gold">admin</span>` : ""}${m.is_banned ? html` <span class="pill rose">banned</span>` : ""}</td><td>${place(m)}</td><td>${fmtDate(m.created_at)}</td>
        <td>${m.id !== state.uid ? html`<button class="btn small ${m.is_banned ? "secondary" : "danger"}" data-ban="${m.id}" data-b="${!m.is_banned}">${m.is_banned ? "Unban" : "Ban"}</button>` : ""}</td></tr>`)}</tbody></table></div>`);
    }
    $$("[data-ban]", ab).forEach((b) => b.addEventListener("click", () => run(b, async () => {
      const ban = b.dataset.b === "true";
      if (ban && !(await confirmBox("Ban this member?", "They won't be able to list, propose or review. Their listings are taken off trade and open proposals are cancelled.", "Ban"))) return;
      await api.setBan(b.dataset.ban, ban); toast(ban ? "Member banned." : "Member unbanned."); route();
    })));
  }

  // ---------- Router ----------
  const routes = [
    [/^\/$/, pageHome, "home"],
    [/^\/browse$/, pageBrowse, "browse"],
    [/^\/catalog$/, pageCatalog, "browse"],
    [/^\/collection$/, pageCollection, "collection"],
    [/^\/perfume\/(\d+)$/, pagePerfume, "browse"],
    [/^\/request$/, pageRequest, "collection"],
    [/^\/u\/([\w-]+)$/, pageUser, ""],
    [/^\/propose\/([\w-]+)$/, pagePropose, "home"],
    [/^\/swaps$/, pageSwaps, "swaps"],
    [/^\/swap\/(\d+)$/, pageSwap, "swaps"],
    [/^\/me$/, pageMe, "me"],
    [/^\/admin$/, pageAdmin, "me"]
  ];
  // Pages anyone can open, signed in or not.
  const publicRoutes = [
    [/^\/privacy$/, () => pageLegal("privacy")],
    [/^\/terms$/, () => pageLegal("terms")],
    [/^\/support$/, () => pageLegal("support")],
    [/^\/forgot$/, pageForgot],
    [/^\/reset-password$/, pageResetPassword]
  ];
  let routeToken = 0;
  async function route() {
    const token = ++routeToken;
    const [path, qs] = (location.hash.slice(1) || "/").split("?");
    const params = new URLSearchParams(qs || "");
    if (modal.open) modal.close();
    const signedIn = !!state.uid;
    $("#topbar").hidden = !signedIn; $("#tabbar").hidden = !signedIn;
    $("#demoBanner").hidden = api.mode !== "demo" || !signedIn;
    const pub = publicRoutes.find(([re]) => re.test(path));
    if (pub) {
      document.body.classList.toggle("signed-out", !signedIn);
      $$("[data-nav]").forEach((a) => a.classList.toggle("active", path !== "/reset-password" && a.dataset.nav === "me"));
      await pub[1](); view.focus({ preventScroll: true }); window.scrollTo(0, 0); return;
    }
    if (!signedIn) { await pageWelcome(); return; }
    document.body.classList.remove("signed-out");
    if (!state.profile) { setView(html`<div class="empty"><h3>We couldn't load your profile</h3><p>Please sign out and in again. If it keeps happening, contact ${CFG.SUPPORT_EMAIL}.</p><button class="btn secondary" id="so">Sign out</button></div>`); $("#so").onclick = () => api.signOut(); return; }
    if (state.profile?.is_banned) { setView(html`<div class="empty"><h3>Your account is suspended</h3><p>An admin has suspended this account. If you think this is a mistake, email ${CFG.SUPPORT_EMAIL}.</p><button class="btn secondary" id="so">Sign out</button></div>`); $("#so").onclick = () => api.signOut(); return; }
    if (!state.profile.adult_confirmed_at) { pageAgeGate(); return; }
    const hit = routes.find(([re]) => re.test(path)) || routes[0];
    const m = path.match(hit[0]) || [];
    $$("[data-nav]").forEach((a) => a.classList.toggle("active", a.dataset.nav === hit[2]));
    loading();
    try {
      if (m[1]) await hit[1](decodeURIComponent(m[1]), params); else await hit[1](params);
    } catch (e) {
      console.error(e);
      if (token === routeToken) setView(html`<div class="empty"><h3>Something went wrong</h3><p>${e.message}</p><a class="btn secondary" href="#/">Back home</a></div>`);
    }
    if (token === routeToken) { view.focus({ preventScroll: true }); window.scrollTo(0, 0); }
    refreshSwapDot();
  }

  async function onAuth(noRoute) {
    state.uid = api.currentUserId();
    state.profile = state.uid ? await api.getProfile(state.uid) : null;
    if (state.uid && api.mode === "demo") {
      $("#demoBanner").innerHTML = val(html`Demo mode — signed in as <b>${state.profile?.display_name}</b>. Data stays in this browser. <button id="switchUser">Switch member</button>`);
      $("#switchUser").addEventListener("click", () => go("/me"));
    }
    if (api.mode === "demo" && api.demoWasRefreshed()) toast("Demo data was refreshed for the bigger catalog.");
    if (state.uid && sessionStorage.getItem("swapfume_new")) { sessionStorage.removeItem("swapfume_new"); location.hash = "/"; }
    if (noRoute !== true) route();
  }

  window.addEventListener("hashchange", route);
  await api.init();
  // Coming back from an email link: open the right page and tidy the address bar.
  const setHash = (h) => history.replaceState(null, "", location.pathname + location.search + h);
  if (/type=recovery/.test(bootHash) || api.isRecovering?.()) setHash("#/reset-password");
  else if (/error_description=/.test(bootHash)) {
    const why = new URLSearchParams(bootHash.slice(1)).get("error_description") || "That link didn't work.";
    setHash("#/"); setTimeout(() => toast(/expired|invalid/i.test(why) ? "That email link has expired. Please ask for a new one." : why, "error"), 400);
  } else if (/access_token=/.test(bootHash)) setHash("#/");
  api.onAuthChange(onAuth);
  onAuth();
})();
