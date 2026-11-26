/*
  DEMO data layer: everything lives in this browser's localStorage.
  It follows the same rules as the real database (supabase/migrations), so the
  app behaves the same once connected. api-supabase.js has the same functions.
*/
(function () {
  const KEY = "swapfume_demo_db_v1";
  // Demo members' pretend ZIP codes (centre points from js/data/zips.csv).
  const DEMO_LOCATIONS = [
    { user_id: "m-margaux", zip: "11201", lat: 40.69, lon: -73.99 },
    { user_id: "m-noor", zip: "07030", lat: 40.75, lon: -74.03 },
    { user_id: "m-theo", zip: "97205", lat: 45.52, lon: -122.70 },
    { user_id: "m-june", zip: "78701", lat: 30.27, lon: -97.74 },
    { user_id: "m-ravi", zip: "60611", lat: 41.89, lon: -87.62 },
    { user_id: "m-elodie", zip: "H2X", lat: 45.51, lon: -73.57 }
  ];
  const SESSION = "swapfume_demo_session_v1";
  const now = () => new Date().toISOString();
  const daysAgo = (d) => new Date(Date.now() - d * 864e5).toISOString();
  const fail = (m) => { throw new Error(m); };
  const clone = (x) => JSON.parse(JSON.stringify(x));

  function freshDb() {
    const db = { version: 4, seq: 10000, locations: [], users: [], profiles: [], blocks: [], perfumeReviews: [], reviewVotes: [], addresses: [], perfumes: [], items: [], wishes: [], swaps: [], swapItems: [], reviews: [], reports: [], noteSuggestions: [], photoSuggestions: [] };
    const seenKeys = new Set();
    window.CATALOG_SEED.forEach((row, i) => {
      const k = Util.perfumeKey(row[0], row[1], row[2]);
      if (seenKeys.has(k)) return; // same perfume listed twice in the catalog files
      seenKeys.add(k);
      db.perfumes.push({ id: i + 1, brand: row[0], name: row[1], concentration: row[2], year: row[3], status: "approved", is_classic: row[3] != null && row[3] < 2000, requested_by: null, created_at: daysAgo(90), ...notesFrom(row), perfumers: perfumersFor(row[0], row[1]), rating_avg: null, rating_count: 0, image_url: null, image_credit: null });
    });
    const P = (brand, name, conc) => {
      const p = db.perfumes.find((x) => x.brand === brand && x.name === name && (!conc || x.concentration === conc));
      if (!p) throw new Error("demo seed missing " + name);
      return p.id;
    };
    const members = [
      ["m-margaux", "margaux@demo.test", "Margaux", "Brooklyn", "United States", "Collector of old-school florals and anything with iris. Admin of this little circle.", true, "1 Orchard Lane, Brooklyn, NY 11201"],
      ["m-theo", "theo@demo.test", "Theo", "Portland", "United States", "Woods, smoke, rain. I decant carefully and pack with bubble wrap.", false, "22 Fir St, Portland, OR 97205"],
      ["m-june", "june@demo.test", "June", "Austin", "United States", "Gourmand girl trying to branch out into greens.", false, "8 Pecan Ave, Austin, TX 78701"],
      ["m-ravi", "ravi@demo.test", "Ravi", "Chicago", "United States", "Fresh and fruity for work, oud for weekends.", false, "415 Lake Shore Dr, Chicago, IL 60611"],
      ["m-noor", "noor@demo.test", "Noor", "Hoboken", "United States", "Skin scents and musks. Happy to send samples to new members.", false, "77 River St, Hoboken, NJ 07030"],
      ["m-elodie", "elodie@demo.test", "Élodie", "Montréal", "Canada", "Swapping in Canada! Florals and tea notes.", false, "12 Rue Saint-Denis, Montréal, QC H2X 3K8"]
    ];
    // Pretend ZIP codes (centre points from js/data/zips.csv). Noor in Hoboken is ~5 miles from Margaux in Brooklyn.
    db.locations = DEMO_LOCATIONS.map((l) => ({ ...l }));
    members.forEach(([id, email, display_name, city, country, bio, is_admin, address], i) => {
      db.users.push({ id, email, password: "demo1234" });
      db.profiles.push({ id, display_name, city, country, country_code: country === "Canada" ? "CA" : "US", bio, is_admin, is_banned: false, adult_confirmed_at: daysAgo(80 - i * 5), created_at: daysAgo(80 - i * 5) });
      db.addresses.push({ user_id: id, full_name: display_name + " Demo", address });
    });
    const item = (owner_id, perfume_id, size, volume_ml, fill_pct, tradeable, note = "", quantity = 1) =>
      db.items.push({ id: ++db.seq, owner_id, perfume_id, size, volume_ml, fill_pct, quantity, tradeable, photo_url: null, note, is_hidden: false, created_at: daysAgo(30) });
    const wish = (user_id, perfume_id) => db.wishes.push({ id: ++db.seq, user_id, perfume_id, created_at: daysAgo(20) });

    item("m-margaux", P("Maison Francis Kurkdjian", "Baccarat Rouge 540", "Eau de Parfum"), "decant", 10, 90, true, "Decanted from my bottle, glass atomizer.");
    item("m-margaux", P("Guerlain", "Shalimar"), "full", 50, 70, false);
    item("m-margaux", P("Prada", "Infusion d'Iris"), "sample", 2, 100, true);
    wish("m-margaux", P("Le Labo", "Santal 33")); wish("m-margaux", P("Byredo", "Gypsy Water"));

    item("m-theo", P("Le Labo", "Santal 33"), "full", 50, 60, true, "Box included.");
    item("m-theo", P("Tom Ford", "Tobacco Vanille"), "sample", 2, 100, true);
    item("m-theo", P("Maison Margiela", "Replica By the Fireplace"), "decant", 5, 100, true);
    wish("m-theo", P("Maison Francis Kurkdjian", "Baccarat Rouge 540", "Eau de Parfum")); wish("m-theo", P("Diptyque", "Philosykos"));

    item("m-june", P("Byredo", "Gypsy Water"), "sample", 2, 100, true);
    item("m-june", P("Yves Saint Laurent", "Black Opium"), "full", 90, 80, true);
    item("m-june", P("Diptyque", "Philosykos"), "decant", 8, 100, true);
    wish("m-june", P("Le Labo", "Another 13")); wish("m-june", P("Tom Ford", "Lost Cherry")); wish("m-june", P("Le Labo", "Santal 33"));

    item("m-ravi", P("Creed", "Aventus"), "decant", 10, 100, true);
    item("m-ravi", P("Parfums de Marly", "Layton"), "full", 125, 85, false);
    item("m-ravi", P("Tom Ford", "Lost Cherry"), "sample", 1.5, 100, true);
    wish("m-ravi", P("Byredo", "Gypsy Water")); wish("m-ravi", P("Diptyque", "Do Son")); wish("m-ravi", P("Guerlain", "Shalimar"));

    item("m-noor", P("Parfums de Marly", "Delina"), "full", 75, 65, true);
    item("m-noor", P("Byredo", "Mojave Ghost"), "decant", 10, 100, true);
    item("m-noor", P("Diptyque", "Do Son"), "sample", 2, 100, true);
    item("m-noor", P("Le Labo", "Another 13"), "sample", 2, 100, true, "", 4);

    item("m-elodie", P("Byredo", "Gypsy Water"), "sample", 2, 50, true, "", 3);
    item("m-elodie", P("Tom Ford", "Lost Cherry"), "decant", 5, 50, true);
    wish("m-elodie", P("Le Labo", "Santal 33"));
    wish("m-noor", P("Tom Ford", "Black Orchid")); wish("m-noor", P("Maison Francis Kurkdjian", "Baccarat Rouge 540", "Eau de Parfum")); wish("m-noor", P("Guerlain", "Mon Guerlain"));

    // A little history so trust badges are not all empty.
    const past = (a, b, pa, pb, ra, rb, ca, cb, d) => {
      const id = ++db.seq;
      db.swaps.push({ id, proposer_id: a, recipient_id: b, status: "completed", message: "", proposer_shipped_at: daysAgo(d), recipient_shipped_at: daysAgo(d), proposer_received_at: daysAgo(d - 3), recipient_received_at: daysAgo(d - 3), created_at: daysAgo(d + 2), updated_at: daysAgo(d - 3) });
      db.swapItems.push({ id: ++db.seq, swap_id: id, item_id: null, from_user_id: a, perfume_id: pa, size: "sample", volume_ml: 2 });
      db.swapItems.push({ id: ++db.seq, swap_id: id, item_id: null, from_user_id: b, perfume_id: pb, size: "sample", volume_ml: 2 });
      db.reviews.push({ id: ++db.seq, swap_id: id, reviewer_id: a, reviewee_id: b, rating: ra, comment: ca, created_at: daysAgo(d - 4) });
      db.reviews.push({ id: ++db.seq, swap_id: id, reviewer_id: b, reviewee_id: a, rating: rb, comment: cb, created_at: daysAgo(d - 4) });
    };
    past("m-noor", "m-theo", P("Byredo", "Blanche"), P("Comme des Garçons", "Hinoki"), 5, 5, "Beautifully packed, arrived fast.", "Generous sample and a sweet note.", 40);
    past("m-june", "m-noor", P("Kayali", "Vanilla 28"), P("Glossier", "You"), 5, 4, "Exactly as described!", "Lovely, a bit slow to ship.", 25);
    past("m-ravi", "m-margaux", P("Creed", "Silver Mountain Water"), P("Guerlain", "Vetiver"), 5, 5, "A true gentleman of the swap.", "Perfect swap.", 15);

    seedPerfumeReviews(db, P);
    seedEvents(db);
    seedCommunity(db);
    db.perfumePhotos = [];
    db.threads = []; db.messages = []; db.threadReads = [];

    // Something for the admin page to show.
    db.perfumes.push({ id: ++db.seq, brand: "Tiny Indie Atelier", name: "Moss Letter", concentration: "Extrait de Parfum", year: 2025, status: "pending", requested_by: "m-june", created_at: daysAgo(2) });
    db.reports.push({ id: ++db.seq, reporter_id: "m-noor", target_user_id: "m-ravi", target_item_id: null, reason: "(Demo report) Asked me to pay for shipping off-platform.", status: "open", created_at: daysAgo(1) });
    const s33 = P("Le Labo", "Santal 33");
    db.noteSuggestions.push({ id: ++db.seq, perfume_id: s33, suggested_by: "m-noor", family: "woody", notes_top: ["cardamom", "violet"], notes_heart: ["iris", "papyrus", "ambrox"], notes_base: ["sandalwood", "cedar", "leather"], comment: "(Demo) I think ambrox belongs in the heart too.", status: "pending", created_at: daysAgo(1) });
    return db;
  }

  // Two pretend community meetups (same rules as migration 017).
  function seedEvents(db) {
    db.events = []; db.eventAttendees = []; db.eventComments = []; db.countryRequests = db.countryRequests || [];
    const inDays = (d, h) => { const t = new Date(Date.now() + d * 864e5); t.setHours(h, 0, 0, 0); return t.toISOString(); };
    const ev = (organizer_id, country_code, title, description, city, place, starts_at, max_people, going) => {
      const id = ++db.seq;
      db.events.push({ id, organizer_id, country_code, title, description, city, place, starts_at, max_people, status: "active", is_hidden: false, created_at: daysAgo(3) });
      [organizer_id, ...going].forEach((u) => db.eventAttendees.push({ event_id: id, user_id: u, created_at: daysAgo(2) }));
      return id;
    };
    const e1 = ev("m-margaux", "US", "Sunday sniff & swap picnic", "Bring a few samples to share and some empty vials. I'll bring a funnel kit and blotter strips. Everyone welcome, beginners too!",
      "Brooklyn, NY", "Prospect Park, by the Boathouse", inDays(9, 14), 15, ["m-noor"]);
    db.eventComments.push({ id: ++db.seq, event_id: e1, user_id: "m-noor", body: "I'll bring Another 13 and some musks to try!", created_at: daysAgo(1) });
    ev("m-elodie", "CA", "Café decant meetup", "Cozy afternoon: share decants, talk perfume.", "Montréal, QC", "Café Olimpico, Rue Saint-Viateur", inDays(12, 15), 8, []);
  }

  // Pretend friends and posts (same rules as migration 023).
  function seedCommunity(db) {
    db.friendships = []; db.posts = []; db.postLikes = []; db.postComments = [];
    const pair = (x, y) => (x < y ? [x, y] : [y, x]);
    const friend = (x, y, status, by, d) => { const [a, b] = pair(x, y); db.friendships.push({ user_a: a, user_b: b, requested_by: by || x, status, created_at: daysAgo(d + 1), accepted_at: status === "accepted" ? daysAgo(d) : null }); };
    friend("m-margaux", "m-theo", "accepted", "m-margaux", 20);
    friend("m-margaux", "m-noor", "accepted", "m-noor", 12);
    friend("m-theo", "m-ravi", "accepted", "m-theo", 8);
    friend("m-june", "m-margaux", "pending", "m-june", 1);
    const P = (b, n) => db.perfumes.find((p) => p.brand === b && p.name === n)?.id || null;
    const hoursAgo = (h) => new Date(Date.now() - h * 3600e3).toISOString();
    const post = (author_id, kind, body, perfume_id, h, likes = [], comments = []) => {
      const id = ++db.seq;
      db.posts.push({ id, author_id, country_code: db.profiles.find((p) => p.id === author_id)?.country_code || "US", kind, body, perfume_id, photo_url: null, is_hidden: false, created_at: hoursAgo(h) });
      likes.forEach((u) => db.postLikes.push({ post_id: id, user_id: u, created_at: hoursAgo(h - 0.5) }));
      comments.forEach(([u, text], k) => db.postComments.push({ id: ++db.seq, post_id: id, user_id: u, body: text, created_at: hoursAgo(h - 1 - k) }));
    };
    post("m-theo", "sotd", "Rainy Monday, so obviously Santal 33. Smells like a cozy cabin and an old leather jacket.", P("Le Labo", "Santal 33"), 3, ["m-margaux", "m-noor"], [["m-margaux", "The perfect rain scent. Enjoy!"]]);
    post("m-noor", "discovery", "Just tried a sample of Blanche from a swap and I'm obsessed. Clean laundry in the best way. Who else loves it?", P("Byredo", "Blanche"), 9, ["m-margaux", "m-june", "m-ravi"], [["m-june", "On my wishlist now 😍"], ["m-margaux", "A classic for a reason."]]);
    post("m-june", "question", "Trying to branch out from gourmands into greens. What's a good first green perfume to sample?", null, 20, ["m-noor"], [["m-theo", "Try something with fig leaf: still a little sweet, but green."]]);
    post("m-ravi", "haul", "Three new decants arrived today from a swap. Packed so well! Office scents sorted for the month.", P("Creed", "Silver Mountain Water"), 30, ["m-theo"]);
    post("m-margaux", "thoughts", "Reminder: you never need a full bottle to fall in love. A 2 ml sample tells you everything. Swap small, smell more! 💐", null, 50, ["m-noor", "m-theo", "m-june"]);
    post("m-elodie", "sotd", "Tea notes on a cold Montréal morning ☕", null, 6, []);
  }

  // Perfumer ("nose") names from js/catalog/perfumers.js, keyed "Brand|Name".
  function perfumersFor(brand, name) { return [...((window.CATALOG_PERFUMERS || {})[brand + "|" + name] || [])]; }

  // DEMO-ONLY sample perfume reviews by the pretend members (never added to a real database).
  function seedPerfumeReviews(db, P) {
    const add = (user_id, perfume_id, rating, body, longevity, sillage, seasons, daytimes, d) =>
      db.perfumeReviews.push({ id: ++db.seq, perfume_id, user_id, rating, body, longevity, sillage, seasons, daytimes, helpful_count: 0, is_hidden: false, demo: true, created_at: daysAgo(d), updated_at: daysAgo(d) });
    const s33 = P("Le Labo", "Santal 33"), br = P("Maison Francis Kurkdjian", "Baccarat Rouge 540", "Eau de Parfum"), tv = P("Tom Ford", "Tobacco Vanille");
    add("m-theo", s33, 5, "My signature. Creamy sandalwood with a dry, papery edge. Gets compliments every time.", "long-lasting", "moderate", ["fall", "winter", "spring"], ["day", "night"], 12);
    add("m-june", s33, 3, "Lovely for an hour, then it smells like everyone else on the subway.", "moderate", "moderate", ["fall"], ["day"], 9);
    add("m-margaux", s33, 4, "", "long-lasting", "moderate", ["fall", "winter"], ["day"], 6);
    add("m-noor", br, 5, "Airy, sweet and warm at the same time. Two sprays is plenty.", "beast", "strong", ["fall", "winter"], ["night"], 15);
    add("m-ravi", br, 4, "Gorgeous but very recognisable. Great for evenings out.", "beast", "strong", ["winter"], ["night"], 4);
    add("m-ravi", tv, 5, "Pipe tobacco, vanilla and dried fruit. Pure winter comfort.", "long-lasting", "strong", ["winter"], ["night"], 20);
    db.reviewVotes.push({ review_id: db.perfumeReviews[0].id, user_id: "m-noor" }, { review_id: db.perfumeReviews[0].id, user_id: "m-ravi" }, { review_id: db.perfumeReviews[3].id, user_id: "m-june" });
    db.perfumeReviews.forEach((r) => { r.helpful_count = db.reviewVotes.filter((v) => v.review_id === r.id).length; });
    [s33, br, tv].forEach((id) => recalcRating(db, id));
  }
  function recalcRating(db, perfumeId) {
    const p = db.perfumes.find((x) => x.id === perfumeId); if (!p) return;
    const banned = new Set(db.profiles.filter((u) => u.is_banned).map((u) => u.id));
    const rs = db.perfumeReviews.filter((r) => r.perfume_id === perfumeId && !r.is_hidden && !banned.has(r.user_id));
    p.rating_count = rs.length;
    p.rating_avg = rs.length ? Math.round((rs.reduce((a, r) => a + r.rating, 0) / rs.length) * 100) / 100 : null;
  }

  // [.., family, "a, b", "c", "d"] -> { family, notes_top: [...], ... }
  function notesFrom(row) {
    const list = (s) => String(s || "").split(",").map((x) => x.trim()).filter(Boolean);
    return { family: row[4] || null, notes_top: list(row[5]), notes_heart: list(row[6]), notes_base: list(row[7]) };
  }

  let db, api_refreshed = false;
  let needNotifSeed = false;
  function load() {
    try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) { db = null; }
    // Version 4 = the current catalog. Older demo data can't be mapped onto it, so start fresh.
    if (!db || !db.perfumes || (db.version || 0) < 4) {
      api_refreshed = !!(db && db.perfumes);
      db = freshDb(); save(); return;
    }
    // Demo data saved by an older version: fill in notes/pictures for catalog perfumes
    // that have none yet, keep everything else (accounts, swaps, edits).
    const byKey = new Map(window.CATALOG_SEED.map((r) => [Util.perfumeKey(r[0], r[1], r[2]), r]));
    let changed = !db.noteSuggestions;
    db.perfumes.forEach((p) => {
      if (p.family) return;
      const r = byKey.get(Util.perfumeKey(p.brand, p.name, p.concentration));
      if (r) { Object.assign(p, notesFrom(r)); changed = true; }
      else if (!p.notes_top) { Object.assign(p, { family: null, notes_top: [], notes_heart: [], notes_base: [] }); changed = true; }
      if (p.image_url === undefined) { p.image_url = null; p.image_credit = null; }
    });
    db.noteSuggestions = db.noteSuggestions || [];
    if (!db.photoSuggestions) { db.photoSuggestions = []; changed = true; }
    if (!db.locations) { db.locations = DEMO_LOCATIONS.filter((l) => db.profiles.some((p) => p.id === l.user_id)).map((l) => ({ ...l })); changed = true; }
    // Launch update: blocks list, 18+ confirmation (demo members count as confirmed),
    // and any catalog perfumes added since this demo data was made.
    if (!db.blocks) { db.blocks = []; changed = true; }
    if (!db.notifications) { needNotifSeed = true; changed = true; }
    db.perfumes.forEach((p) => {
      if (!p.perfumers || (!p.perfumers.length && perfumersFor(p.brand, p.name).length)) { p.perfumers = perfumersFor(p.brand, p.name); changed = true; }
      if (p.rating_count === undefined) { p.rating_avg = null; p.rating_count = 0; changed = true; }
    });
    if (!db.perfumeReviews) {
      db.perfumeReviews = []; db.reviewVotes = []; changed = true;
      try { seedPerfumeReviews(db, (b, n, c) => { const p = db.perfumes.find((x) => x.brand === b && x.name === n && (!c || x.concentration === c)); if (!p) throw new Error("missing"); return p.id; }); } catch (e) { /* demo members changed; skip samples */ }
    }
    db.profiles.forEach((p) => { if (p.adult_confirmed_at === undefined) { p.adult_confirmed_at = p.created_at; changed = true; } });
    // Countries, quantities and meetups (migrations 016–017).
    db.profiles.forEach((p) => { if (!p.country_code) { p.country_code = "US"; changed = true; } });
    db.items.forEach((i) => { if (i.quantity === undefined) { i.quantity = 1; changed = true; } });
    db.swapItems.forEach((x) => { if (x.quantity === undefined) { x.quantity = 1; changed = true; } });
    if (!db.events) { seedEvents(db); changed = true; }
    if (!db.countryRequests) { db.countryRequests = []; changed = true; }
    if (!db.threads) { db.threads = []; db.messages = []; db.threadReads = []; changed = true; }
    if (!db.posts) { seedCommunity(db); changed = true; }
    if (!db.perfumePhotos) {
      // Migration 024: bring in photos already on listings and tagged posts.
      db.perfumePhotos = [];
      const add = (perfume_id, user_id, image_url, source, created_at) => { if (image_url && perfume_id && !db.perfumePhotos.some((x) => x.perfume_id === perfume_id && x.image_url === image_url)) db.perfumePhotos.push({ id: ++db.seq, perfume_id, user_id, image_url, source, is_hidden: false, created_at }); };
      db.items.forEach((i) => add(i.perfume_id, i.owner_id, i.photo_url, "listing", i.created_at));
      db.posts.forEach((p) => add(p.perfume_id, p.author_id, p.photo_url, "post", p.created_at));
      new Set(db.perfumePhotos.map((x) => x.perfume_id)).forEach((pid) => {
        const p = db.perfumes.find((x) => x.id === pid), ph = db.perfumePhotos.filter((x) => x.perfume_id === pid).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
        if (p) p.member_photo_url = ph.image_url;
      });
      changed = true;
    }
    const have = new Set(db.perfumes.map((p) => Util.perfumeKey(p.brand, p.name, p.concentration)));
    window.CATALOG_SEED.forEach((row) => {
      if (have.has(Util.perfumeKey(row[0], row[1], row[2]))) return;
      db.perfumes.push({ id: ++db.seq, brand: row[0], name: row[1], concentration: row[2], year: row[3], status: "approved", is_classic: row[3] != null && row[3] < 2000, requested_by: null, created_at: now(), ...notesFrom(row), perfumers: perfumersFor(row[0], row[1]), rating_avg: null, rating_count: 0, image_url: null, image_credit: null });
      changed = true;
    });
    if (changed) save();
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch (e) { fail("This browser's demo storage is full. Try a smaller photo, or reset the demo."); }
  }
  load();
  if (!db.notifications) needNotifSeed = true;

  let uid = null;
  try { uid = localStorage.getItem(SESSION) || null; } catch (e) {}
  if (uid && !db.users.find((u) => u.id === uid)) uid = null;
  const listeners = [];
  const setUid = (v) => { uid = v; try { v ? localStorage.setItem(SESSION, v) : localStorage.removeItem(SESSION); } catch (e) {} listeners.forEach((f) => f()); };

  const me = () => uid || fail("Please sign in first.");
  const prof = (id) => db.profiles.find((p) => p.id === id) || null;
  const lite = (id) => { const p = prof(id); return p && { id: p.id, display_name: p.display_name, city: p.city, country: p.country, country_code: p.country_code || "US", is_banned: p.is_banned, avatar_url: p.avatar_url || null }; };

  // Notifications (same rules as notify() in migration 027): never yourself, never between people
  // who blocked each other, one like per person per post, one unread message notice per conversation.
  function notify(user, actor, kind, refs = {}, detail = "") {
    if (!db.notifications) db.notifications = [];
    if (!user || user === actor) return;
    if (actor && db.blocks.some((b) => (b.blocker_id === user && b.blocked_id === actor) || (b.blocker_id === actor && b.blocked_id === user))) return;
    if (kind === "like" && db.notifications.some((n) => n.user_id === user && n.actor_id === actor && n.kind === "like" && n.post_id === refs.post_id)) return;
    if (kind === "mention" && db.notifications.some((n) => n.user_id === user && n.actor_id === actor && n.post_id === refs.post_id && Date.now() - new Date(n.created_at) < 6e4)) return;
    if (kind === "message") db.notifications = db.notifications.filter((n) => !(n.user_id === user && n.kind === "message" && n.thread_id === refs.thread_id && !n.read_at));
    db.notifications.push({ id: ++db.seq, user_id: user, actor_id: actor || null, kind, post_id: refs.post_id || null, swap_id: refs.swap_id || null,
      thread_id: refs.thread_id || null, event_id: refs.event_id || null, circle_id: refs.circle_id || null, perfume_id: refs.perfume_id || null, item_id: refs.item_id || null, detail: String(detail || "").slice(0, 160), read_at: null, created_at: now() });
  }
  // Groups (migration 030): the eight starter groups, with a few members and a post each in two of them.
  function groupsReady() {
    if (db.groups) return;
    db.groups = []; db.groupMembers = [];
    [["niche", "Niche houses", "Le Labo, Byredo, MFK, Diptyque, Frédéric Malle and the small independent houses.", "🕯️"],
     ["oud", "Ouds & ambers", "Middle Eastern perfumery, attars, ouds, ambers and resins.", "🪔"],
     ["vintage", "Vintage & classics", "Old formulations, discontinued treasures and the great classics.", "🎞️"],
     ["designer", "Designer favourites", "Dior, Chanel, YSL, Armani and every department-store love.", "💄"],
     ["fresh", "Fresh & green", "Citrus, colognes, aquatics, greens and tea.", "🍋"],
     ["gourmand", "Gourmands", "Vanilla, tonka, caramel, coffee: perfumes good enough to eat.", "🍮"],
     ["decanting", "Decanters' corner", "Tips on decanting, vials, labels and packing that arrives safely.", "🧪"],
     ["beginners", "Beginners welcome", "New to perfume? Ask anything. No question is silly here.", "🌱"]].forEach(([slug, name, description, emoji]) =>
      db.groups.push({ id: ++db.seq, slug, name, description, emoji, created_by: null, is_official: true, is_hidden: false, created_at: daysAgo(60) }));
    const G = (slug) => db.groups.find((g) => g.slug === slug).id;
    const join = (slug, users) => users.forEach((u) => prof(u) && db.groupMembers.push({ group_id: G(slug), user_id: u, role: "member", joined_at: daysAgo(20) }));
    join("vintage", ["m-margaux", "m-noor"]); join("oud", ["m-ravi", "m-theo"]); join("beginners", ["m-june", "m-noor", "m-elodie"]); join("decanting", ["m-theo", "m-margaux"]);
    const post = (slug, author, kind, body, d) => prof(author) && db.posts.push({ id: ++db.seq, author_id: author, country_code: ccOf(author), kind, body, perfume_id: null, photo_url: null, is_hidden: false, group_id: G(slug), created_at: daysAgo(d) });
    post("beginners", "m-june", "question", "What's the difference between EDT and EDP, really? Is it just strength?", 2);
    post("decanting", "m-theo", "thoughts", "Tip: label your vials BEFORE you fill them. Ink doesn't stick to a wet atomizer. Ask me how I know 🙃", 4);
    post("oud", "m-ravi", "sotd", "Weekend oud day. Something smoky and resinous for a cold evening.", 1);
    save();
  }
  // Pass-arounds and giveaways: created on first use, with two examples so the demo has something to show.
  function circlesReady() {
    if (db.circles) return;
    db.circles = []; db.circleMembers = [];
    const find = (b, n) => db.perfumes.find((p) => p.brand === b && p.name === n)?.id || db.perfumes[0].id;
    const later = (d) => new Date(Date.now() + d * 864e5).toISOString();
    if (prof("m-noor")) {
      db.circles.push({ id: ++db.seq, host_id: "m-noor", kind: "giveaway", country_code: "US", title: "Musk samples for new members", description: "I have more musk than one person needs! Five 2 ml samples, free, for anyone new to Swapfume. Just enter and I'll draw on Sunday.",
        perfume_id: find("Narciso Rodriguez", "For Her"), size: "sample", amount: "2 ml sample", spots: 5, ends_at: later(3), status: "open", current_pos: null, is_hidden: false, created_at: daysAgo(1) });
      ["m-june", "m-ravi"].forEach((u) => prof(u) && db.circleMembers.push({ circle_id: db.seq, user_id: u, joined_at: daysAgo(0.5), position: null, received_at: null, sent_at: null, won: false }));
    }
    if (prof("m-theo")) {
      db.circles.push({ id: ++db.seq, host_id: "m-theo", kind: "passaround", country_code: "US", title: "Smoky woods pass-around", description: "My bottle of Tam Dao goes on a trip. Take up to 2 ml into your own vial, wrap it well and send it on within 5 days. It comes home to me at the end.",
        perfume_id: find("Diptyque", "Tam Dao"), size: "full", amount: "take up to 2 ml", spots: 6, ends_at: null, status: "open", current_pos: null, is_hidden: false, created_at: daysAgo(2) });
      ["m-june"].forEach((u) => prof(u) && db.circleMembers.push({ circle_id: db.seq, user_id: u, joined_at: daysAgo(1), position: null, received_at: null, sent_at: null, won: false }));
    }
    save();
  }
  const canSeeCircle = (c) => !!uid && (c.host_id === uid || isAdmin() || db.circleMembers.some((m) => m.circle_id === c.id && m.user_id === uid)
    || (!prof(uid)?.is_banned && !c.is_hidden && !blockedWith(c.host_id) && c.country_code === ccOf(uid)));
  const circleNext = (c, pos) => { const ps = db.circleMembers.filter((m) => m.circle_id === c.id && m.position != null && m.position > pos).map((m) => m.position); return ps.length ? Math.min(...ps) : 0; };
  // Wishlist alerts (same rules as migration 034): when a listing becomes available to swap, tell the
  // members who want it: same country or friends, at most once per perfume per 7 days, unless switched off.
  const isOpen = (i) => !!i.tradeable && !i.is_hidden && (i.quantity ?? 1) > 0;
  function wishAlert(i, wasOpen) {
    if (!isOpen(i) || wasOpen) return;
    const owner = prof(i.owner_id); if (!owner || owner.is_banned) return;
    const detail = ({ full: "Full bottle", decant: "Decant", sample: "Sample" })[i.size] + (i.volume_ml ? ` · ${+i.volume_ml} ml` : "");
    const week = Date.now() - 7 * 864e5;
    db.wishes.filter((w) => w.perfume_id === i.perfume_id && w.user_id !== i.owner_id).forEach((w) => {
      const p = prof(w.user_id);
      if (!p || p.is_banned || !p.adult_confirmed_at || p.wish_alerts === false) return;
      const friends = db.friendships.some((f) => f.status === "accepted" && [f.user_a, f.user_b].includes(w.user_id) && [f.user_a, f.user_b].includes(i.owner_id));
      if ((p.country_code || "US") !== (owner.country_code || "US") && !friends) return;
      if ((db.notifications || []).some((n) => n.user_id === w.user_id && n.kind === "wish_listed" && n.perfume_id === i.perfume_id && new Date(n.created_at) > week)) return;
      notify(w.user_id, i.owner_id, "wish_listed", { perfume_id: i.perfume_id, item_id: i.id }, detail);
    });
  }
  // Older demo data: build a starting set of notifications from what's already there.
  function seedNotifications() {
    db.notifications = [];
    const ago = (h) => new Date(Date.now() - h * 36e5).toISOString();
    (db.friendships || []).filter((f) => f.status === "pending").forEach((f) => notify(f.requested_by === f.user_a ? f.user_b : f.user_a, f.requested_by, "friend_request"));
    (db.postComments || []).forEach((c) => { const p = (db.posts || []).find((x) => x.id === c.post_id); if (p) notify(p.author_id, c.user_id, "comment", { post_id: p.id }, c.body); });
    (db.postLikes || []).forEach((l) => { const p = (db.posts || []).find((x) => x.id === l.post_id); if (p) notify(p.author_id, l.user_id, "like", { post_id: p.id }); });
    db.swaps.filter((s) => s.status === "proposed").forEach((s) => notify(s.recipient_id, s.proposer_id, s.is_gift ? "gift" : "swap_proposal", { swap_id: s.id }));
    db.reviews.forEach((r) => notify(r.reviewee_id, r.reviewer_id, "review", { swap_id: r.swap_id }, `${r.rating}★ ${r.comment}`));
    // spread them over the last few days, oldest read, newest unread
    db.notifications.sort(() => Math.random() - 0.5).forEach((n, k, all) => { n.created_at = ago(2 + k * 7); if (k > 5) n.read_at = n.created_at; });
  }
  const ccOf = (id) => prof(id)?.country_code || "US";
  const perf = (id) => db.perfumes.find((p) => p.id === id) || null;
  // Duplicate catching — mirrors migration 015 (the live site does this in the database).
  const approvedBrands = () => [...new Set(db.perfumes.filter((p) => p.status === "approved").map((p) => p.brand))].sort((a, b) => a.localeCompare(b));
  const canonicalBrand = (t) => Util.canonicalBrand(t, approvedBrands());
  function similarTo(brand, name, excludeId = null) {
    const b = canonicalBrand(brand), n = Util.tidyPerfumeName(b, name).name;
    if (!Util.normText(n)) return [];
    const bk = Util.brandKey(b), w = Util.normWords(n), all = Util.normWords(b + " " + n);
    return db.perfumes.filter((p) => p.status !== "rejected" && p.id !== excludeId).map((p) => {
      let s = 0;
      if (Util.brandKey(p.brand) === bk) s = Util.normText(p.name) === Util.normText(n) ? 1 : Math.max(Util.similarity(Util.normWords(p.name), w), Util.wordSimilarity(w, Util.normWords(p.name)) * 0.9);
      s = Math.max(s, Util.similarity(Util.normWords(p.brand + " " + p.name), all) * 0.9);
      return { id: p.id, brand: p.brand, name: p.name, concentration: p.concentration, year: p.year, status: p.status, image_url: p.image_url, score: Math.round(s * 100) / 100 };
    }).filter((p) => p.score >= 0.45).sort((x, y) => y.score - x.score || x.brand.localeCompare(y.brand) || x.name.localeCompare(y.name)).slice(0, 8);
  }
  const active = () => { const p = prof(me()); if (!p || p.is_banned || !p.adult_confirmed_at) fail("Your account cannot do this right now."); };
  // Same rules as migration 008: either side blocking hides listings/wishlists and stops swaps.
  // Unrounded distance in miles between me and another member, or null if either has no ZIP.
  const rawDistance = (other) => {
    if (ccOf(uid) !== ccOf(other)) return null; // distances only inside one country (migration 016)
    const a = db.locations.find((x) => x.user_id === uid), b = db.locations.find((x) => x.user_id === other);
    return a && b ? Util.milesBetween(a, b) : null;
  };
  const blockedWith = (other) => !!uid && other !== uid && db.blocks.some((b) => (b.blocker_id === uid && b.blocked_id === other) || (b.blocker_id === other && b.blocked_id === uid));
  const isAdultBirthdate = (s) => {
    const d = new Date(String(s || "") + "T00:00:00");
    if (isNaN(d) || d.getFullYear() < 1900) return false;
    const cut = new Date(); cut.setFullYear(cut.getFullYear() - 18);
    return d <= cut;
  };
  let resetFor = null; // demo stand-in for the emailed reset link
  const isAdmin = () => !!(uid && prof(uid) && prof(uid).is_admin);
  const adminOnly = () => isAdmin() || fail("Admins only.");
  // Migration 017 rules: quantities 0–99; meetups. Since 025, swaps and gifts may cross borders.
  const qtyOk = (n) => { n = Math.round(Number(n)); if (!(n >= 0 && n <= 99)) fail("Choose an amount between 0 and 99."); return n; };
  const checkQty = (ids, qty) => ids.forEach((id) => {
    const q = Number(qty[id] || 1), i = db.items.find((x) => x.id === Number(id));
    if (!(q >= 1 && q <= 99)) fail("Choose an amount between 1 and 99.");
    if (!i || q > (i.quantity ?? 1)) fail("There aren't that many available of one of the perfumes.");
  });
  const myThread = (id) => db.threads.find((x) => x.id === Number(id) && [x.user_a, x.user_b].includes(uid)) || fail("Conversation not found.");
  const setRead = (threadId) => { const r = db.threadReads.find((x) => x.thread_id === threadId && x.user_id === uid); if (r) r.last_read_at = now(); else db.threadReads.push({ thread_id: threadId, user_id: uid, last_read_at: now() }); };
  const canSeeEvent = (e) => !!uid && (e.organizer_id === uid || isAdmin() || (!prof(uid)?.is_banned && !e.is_hidden && !blockedWith(e.organizer_id)));
  // Member photos kept under each perfume (same rules as migration 024).
  function refreshMemberPhoto(pid) {
    const p = perf(pid); if (!p) return;
    const ph = db.perfumePhotos.filter((x) => x.perfume_id === pid && !x.is_hidden && !prof(x.user_id)?.is_banned).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    p.member_photo_url = ph ? ph.image_url : null;
  }
  function keepPhoto(perfume_id, user_id, image_url, source) {
    if (!image_url || db.perfumePhotos.some((x) => x.perfume_id === perfume_id && x.image_url === image_url)) return;
    db.perfumePhotos.push({ id: ++db.seq, perfume_id, user_id, image_url, source, is_hidden: false, created_at: now() });
    refreshMemberPhoto(perfume_id);
  }
  const friendRow = (other) => db.friendships.find((f) => (f.user_a === uid && f.user_b === other) || (f.user_b === uid && f.user_a === other));
  const isFriend = (other) => friendRow(other)?.status === "accepted";
  const canSeePost = (p) => !!uid && (p.author_id === uid || isAdmin() || (!prof(uid)?.is_banned && !p.is_hidden && !blockedWith(p.author_id) && (p.group_id ? !!(db.groups || []).find((g) => g.id === p.group_id && !g.is_hidden) : (p.country_code === ccOf(uid) || isFriend(p.author_id)))));
  // Mentions (same rule as notify_mentions in migration 032): "@Name" = first word of a display name,
  // among your friends and the people already in this post's conversation.
  function demoMentions(post, text) {
    const names = new Set([...String(text || "").matchAll(/@([A-Za-zÀ-ÿ][\w'-]{1,39})/g)].map((m) => m[1].toLowerCase()));
    if (!names.size) return;
    const inConvo = new Set([post.author_id, ...db.postComments.filter((c) => c.post_id === post.id).map((c) => c.user_id)]);
    db.profiles.filter((p) => p.id !== uid && !p.is_banned && names.has(String(p.display_name || "").trim().split(/\s+/)[0].toLowerCase()) && (isFriend(p.id) || inConvo.has(p.id)))
      .slice(0, 10).forEach((p) => notify(p.id, uid, "mention", { post_id: post.id }, text));
  }
  const withPost = (p) => {
    const likes = db.postLikes.filter((x) => x.post_id === p.id);
    const votes = (db.pollVotes || []).filter((v) => v.post_id === p.id);
    const extra = { photos: p.photos || [], saved: (db.savedPosts || []).some((s) => s.user_id === uid && s.post_id === p.id),
      poll_votes: p.poll ? p.poll.map((_, i) => votes.filter((v) => v.choice === i).length) : undefined,
      my_vote: p.poll ? (votes.find((v) => v.user_id === uid)?.choice ?? null) : undefined };
    const pf = perf(p.perfume_id);
    return { ...clone(p), author: lite(p.author_id), perfume: pf ? { id: pf.id, brand: pf.brand, name: pf.name, concentration: pf.concentration, family: pf.family } : null,
      like_count: likes.length, liked: likes.some((x) => x.user_id === uid), comment_count: db.postComments.filter((c) => c.post_id === p.id && !blockedWith(c.user_id)).length,
      group: p.group_id ? (({ id, name, emoji }) => ({ id, name, emoji }))((db.groups || []).find((g) => g.id === p.group_id) || {}) : null, ...extra };
  };
  const canSeeItem = (i) => i.owner_id === uid || ((!i.is_hidden || isAdmin()) && !blockedWith(i.owner_id));
  const withItem = (i) => ({ ...clone(i), perfume: clone(perf(i.perfume_id)), owner: lite(i.owner_id) });
  const withWish = (w) => ({ ...clone(w), perfume: clone(perf(w.perfume_id)), user: lite(w.user_id) });
  const swapFull = (s) => ({
    ...clone(s), proposer: clone(prof(s.proposer_id)), recipient: clone(prof(s.recipient_id)),
    items: db.swapItems.filter((x) => x.swap_id === s.id).map((x) => ({ ...clone(x), perfume: clone(perf(x.perfume_id)) }))
  });
  const mySwap = (id) => {
    const s = db.swaps.find((x) => x.id === Number(id));
    if (!s || (![s.proposer_id, s.recipient_id].includes(uid) && !isAdmin())) fail("Swap not found.");
    return s;
  };
  const tick = () => new Promise((r) => setTimeout(r, 60)); // feel a bit like a network

  const api = {
    mode: "demo",
    async init() { return uid; },
    onAuthChange(f) { listeners.push(f); },
    currentUserId: () => uid,

    async signUp({ email, password, display_name, birthdate, country_code = "US" }) {
      await tick();
      if (!birthdate) fail("Please enter your date of birth.");
      if (!isAdultBirthdate(birthdate)) fail("Sorry — you must be 18 or older to join Swapfume.");
      email = String(email || "").trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail("Please enter a valid email address.");
      if (String(password || "").length < 8) fail("Use at least 8 characters for your password.");
      if (db.users.find((u) => u.email === email)) fail("That email already has an account. Try signing in.");
      const id = "u-" + Math.random().toString(36).slice(2, 10);
      db.users.push({ id, email, password });
      const cc = Util.COUNTRIES.some((c) => c.code === country_code) ? country_code : "US";
      db.profiles.push({ id, display_name: (String(display_name || "").trim() || email.split("@")[0]).slice(0, 40), city: "", country: Util.country(cc).name, country_code: cc, bio: "", is_admin: false, is_banned: false, adult_confirmed_at: now(), created_at: now() });
      save(); setUid(id);
      return { needsConfirmation: false };
    },
    async signIn({ email, password }) {
      await tick();
      const u = db.users.find((x) => x.email === String(email || "").trim().toLowerCase());
      if (!u || u.password !== password) fail("Email or password is not right.");
      setUid(u.id);
    },
    async signOut() { setUid(null); },
    // Password reset. Demo: no email is sent; the app opens the reset page directly.
    async resendConfirmation(email) {
      await tick();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email || "").trim())) fail("Please enter a valid email address.");
    },
    async requestPasswordReset(email) {
      await tick();
      email = String(email || "").trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail("Please enter a valid email address.");
      const u = db.users.find((x) => x.email === email);
      resetFor = u ? u.id : null;
      return { demoLink: !!u };
    },
    canResetPassword: () => !!(resetFor || uid),
    async updatePassword(password) {
      await tick();
      if (String(password || "").length < 8) fail("Use at least 8 characters for your password.");
      const u = db.users.find((x) => x.id === (resetFor || uid)) || fail("This reset link has expired. Ask for a new one.");
      u.password = password; save(); resetFor = null;
      if (uid !== u.id) setUid(u.id);
    },
    async confirmAdult(birthdate) {
      const p = prof(me());
      if (!isAdultBirthdate(birthdate)) fail("Swapfume is only for people 18 or older.");
      p.adult_confirmed_at = p.adult_confirmed_at || now(); save();
    },

    // Blocking
    async listBlocks() {
      me();
      return db.blocks.filter((b) => b.blocker_id === uid).map((b) => ({ ...clone(b), blocked: lite(b.blocked_id) }));
    },
    async blockUser(userId) {
      me();
      if (userId === uid) fail("You cannot block yourself.");
      if (!prof(userId)) fail("Member not found.");
      if (!db.blocks.some((b) => b.blocker_id === uid && b.blocked_id === userId)) db.blocks.push({ blocker_id: uid, blocked_id: userId, created_at: now() });
      db.swaps.forEach((s) => { if (s.status === "proposed" && ((s.proposer_id === uid && s.recipient_id === userId) || (s.proposer_id === userId && s.recipient_id === uid))) { s.status = "cancelled"; s.updated_at = now(); } });
      db.friendships = db.friendships.filter((f) => !([f.user_a, f.user_b].includes(uid) && [f.user_a, f.user_b].includes(userId)));
      save();
    },
    async unblockUser(userId) { me(); db.blocks = db.blocks.filter((b) => !(b.blocker_id === uid && b.blocked_id === userId)); save(); },

    // Delete my account (same steps as delete_my_account() + the Edge Function).
    async deleteAccount() {
      const v = me(); await tick();
      if (db.swaps.some((s) => s.status === "accepted" && [s.proposer_id, s.recipient_id].includes(v)))
        fail("You have a swap in progress. Finish it (both packages received) before deleting your account, or contact support for help.");
      db.swaps.forEach((s) => {
        if (![s.proposer_id, s.recipient_id].includes(v)) return;
        if (s.status === "proposed") { s.status = "cancelled"; s.updated_at = now(); }
        if (s.proposer_id === v) s.proposer_id = null;
        if (s.recipient_id === v) s.recipient_id = null;
      });
      db.swapItems.forEach((x) => { if (x.from_user_id === v) x.from_user_id = null; });
      db.reviews = db.reviews.filter((r) => r.reviewee_id !== v);
      db.reviews.forEach((r) => { if (r.reviewer_id === v) r.reviewer_id = null; });
      db.perfumeReviews.forEach((r) => { if (r.user_id === v) r.user_id = null; });
      const votedOn = new Set(db.reviewVotes.filter((x) => x.user_id === v).map((x) => x.review_id));
      db.reviewVotes = db.reviewVotes.filter((x) => x.user_id !== v);
      db.perfumeReviews.forEach((r) => { if (votedOn.has(r.id)) r.helpful_count = db.reviewVotes.filter((x) => x.review_id === r.id).length; });
      const myItems = new Set(db.items.filter((i) => i.owner_id === v).map((i) => i.id));
      db.swapItems.forEach((x) => { if (myItems.has(x.item_id)) x.item_id = null; });
      db.items = db.items.filter((i) => i.owner_id !== v);
      db.wishes = db.wishes.filter((w) => w.user_id !== v);
      db.addresses = db.addresses.filter((a) => a.user_id !== v);
      db.blocks = db.blocks.filter((b) => b.blocker_id !== v && b.blocked_id !== v);
      db.locations = db.locations.filter((x) => x.user_id !== v);
      const theirEvents = new Set(db.events.filter((e) => e.organizer_id === v).map((e) => e.id));
      db.events = db.events.filter((e) => !theirEvents.has(e.id));
      db.eventAttendees = db.eventAttendees.filter((x) => x.user_id !== v && !theirEvents.has(x.event_id));
      db.eventComments = db.eventComments.filter((x) => x.user_id !== v && !theirEvents.has(x.event_id));
      db.friendships = db.friendships.filter((f) => f.user_a !== v && f.user_b !== v);
      const theirPosts = new Set(db.posts.filter((p) => p.author_id === v).map((p) => p.id));
      db.posts = db.posts.filter((p) => !theirPosts.has(p.id));
      db.postLikes = db.postLikes.filter((x) => x.user_id !== v && !theirPosts.has(x.post_id));
      db.postComments = db.postComments.filter((x) => x.user_id !== v && !theirPosts.has(x.post_id));
      db.noteSuggestions = db.noteSuggestions.filter((n) => n.suggested_by !== v);
      db.photoSuggestions = db.photoSuggestions.filter((n) => n.suggested_by !== v || n.status === "approved");
      const theirPhotoPerfumes = new Set(db.perfumePhotos.filter((x) => x.user_id === v).map((x) => x.perfume_id));
      db.perfumePhotos = db.perfumePhotos.filter((x) => x.user_id !== v);
      theirPhotoPerfumes.forEach(refreshMemberPhoto);
      db.reports = db.reports.filter((r) => r.reporter_id !== v && r.target_user_id !== v);
      db.perfumes.forEach((p) => { if (p.requested_by === v) p.requested_by = null; });
      db.profiles = db.profiles.filter((p) => p.id !== v);
      db.users = db.users.filter((u) => u.id !== v);
      save(); setUid(null);
    },

    async getProfile(id) { return clone(prof(id)); },
    async findMembers(name) {
      me(); name = String(name || "").trim();
      if (name.length < 2) fail("Type their full display name.");
      const k = Util.normText(name);
      return clone(db.profiles.filter((p) => Util.normText(p.display_name) === k && !p.is_banned && !blockedWith(p.id))
        .map((p) => ({ id: p.id, display_name: p.display_name, city: p.city, country: p.country, country_code: p.country_code, avatar_url: p.avatar_url || null })));
    },
    async updateProfile(patch) {
      const p = prof(me());
      const name = String(patch.display_name ?? p.display_name).trim();
      if (!name || name.length > 40) fail("Display name must be 1–40 characters.");
      if (String(patch.bio || "").length > 500) fail("Bio can be at most 500 characters.");
      Object.assign(p, { display_name: name, city: String(patch.city ?? p.city).trim(), country: String(patch.country ?? p.country).trim(), bio: String(patch.bio ?? p.bio).trim() });
      save(); return clone(p);
    },
    async getMyAddress() { return clone(db.addresses.find((a) => a.user_id === me()) || null); },
    async saveMyAddress({ full_name, address }) {
      if (!String(full_name || "").trim()) fail("Please add the name for the package.");
      if (String(address || "").trim().length < 5) fail("Please add a full mailing address.");
      const a = db.addresses.find((x) => x.user_id === me());
      if (a) Object.assign(a, { full_name: full_name.trim(), address: address.trim() });
      else db.addresses.push({ user_id: uid, full_name: full_name.trim(), address: address.trim() });
      save();
    },
    async getPartnerAddress(swapId) {
      const s = mySwap(swapId);
      if (!["accepted", "completed"].includes(s.status) || s.method === "meetup") return null;
      if (s.is_gift && s.proposer_id !== uid) return null; // the receiver never sees the giver's address
      const other = s.proposer_id === uid ? s.recipient_id : s.proposer_id;
      if (!other) return null; // partner deleted their account
      return clone(db.addresses.find((a) => a.user_id === other) || null);
    },

    async searchCatalog(q, { limit = 30, sort = "name", perfumer = "" } = {}) {
      const terms = String(q || "").toLowerCase().split(/\s+/).filter(Boolean).map(Util.normText);
      const byName = (a, b) => (a.brand + a.name).localeCompare(b.brand + b.name);
      const byRating = (a, b) => (b.rating_avg ?? -1) - (a.rating_avg ?? -1) || b.rating_count - a.rating_count || byName(a, b);
      return clone(db.perfumes.filter((p) => p.status === "approved" && (!perfumer || (p.perfumers || []).includes(perfumer))
        && terms.every((t) => Util.normText(p.brand + " " + p.name + " " + (p.perfumers || []).join(" ")).includes(t)))
        .sort(sort === "rating" ? byRating : byName).slice(0, limit));
    },
    async notifySwap() { /* the demo doesn't send emails */ },
    async setEmailNotifications(on) { const p = prof(me()); p.email_notifications = !!on; save(); return clone(p); },
    // ---- Groups (same rules as migration 030) ----
    async listGroups() {
      me(); groupsReady();
      return db.groups.filter((g) => !g.is_hidden || isAdmin() || g.created_by === uid).map((g) => {
        const ms = db.groupMembers.filter((m) => m.group_id === g.id);
        return { ...clone(g), member_count: ms.length, joined: ms.some((m) => m.user_id === uid), role: ms.find((m) => m.user_id === uid)?.role || null };
      }).sort((a, b) => (b.is_official - a.is_official) || a.name.localeCompare(b.name));
    },
    async getGroup(id) { return (await this.listGroups()).find((g) => g.id === Number(id)) || null; },
    async joinGroup(id, join) {
      me(); groupsReady(); const g = db.groups.find((x) => x.id === Number(id));
      const mine = (m) => m.group_id === Number(id) && m.user_id === uid;
      if (!join) { db.groupMembers = db.groupMembers.filter((m) => !mine(m)); save(); return; }
      active(); if (!g || g.is_hidden) fail("Group not found.");
      if (db.groupMembers.filter((m) => m.user_id === uid).length >= 30) fail("You can be in up to 30 groups.");
      if (!db.groupMembers.some(mine)) db.groupMembers.push({ group_id: g.id, user_id: uid, role: "member", joined_at: now() }); save();
    },
    async createGroup({ name, description, emoji }) {
      active(); groupsReady(); name = String(name || "").trim();
      if (name.length < 3) fail("Give the group a name.");
      if (db.groups.some((g) => g.name.toLowerCase() === name.toLowerCase())) fail("There's already a group with that name. Join it instead!");
      if (db.groups.filter((g) => g.created_by === uid).length >= 2) fail("You can start up to 2 groups.");
      const g = { id: ++db.seq, slug: null, name: name.slice(0, 60), description: String(description || "").trim().slice(0, 500), emoji: String(emoji || "").trim().slice(0, 8) || "🫧", created_by: uid, is_official: false, is_hidden: false, created_at: now() };
      db.groups.push(g); db.groupMembers.push({ group_id: g.id, user_id: uid, role: "admin", joined_at: now() }); save(); return g.id;
    },
    async setGroupHidden(id, hidden) { adminOnly(); const g = db.groups.find((x) => x.id === Number(id)); if (g) { g.is_hidden = !!hidden; save(); } },
    // ---- Pass-arounds and giveaways (same rules as migration 029) ----
    async listCircles({ mine = false } = {}) {
      me(); circlesReady();
      return db.circles.filter((c) => canSeeCircle(c) && (!mine || c.host_id === uid)).sort((a, b) => b.created_at.localeCompare(a.created_at)).map((c) => {
        const ms = db.circleMembers.filter((m) => m.circle_id === c.id);
        const p = perf(c.perfume_id);
        return { ...clone(c), host: lite(c.host_id), perfume: p ? { id: p.id, brand: p.brand, name: p.name, concentration: p.concentration, image_url: p.image_url, member_photo_url: p.member_photo_url } : null,
          count: ms.filter((m) => m.user_id !== c.host_id).length, joined: ms.some((m) => m.user_id === uid), won: ms.some((m) => m.user_id === uid && m.won) };
      });
    },
    async getCircle(id) {
      me(); circlesReady();
      const c = db.circles.find((x) => x.id === Number(id));
      if (!c || !canSeeCircle(c)) return null;
      const members = db.circleMembers.filter((m) => m.circle_id === c.id).sort((a, b) => a.joined_at.localeCompare(b.joined_at)).map((m) => ({ ...clone(m), user: lite(m.user_id) }));
      return { ...clone(c), host: lite(c.host_id), perfume: clone(perf(c.perfume_id)), members, me: members.find((m) => m.user_id === uid) || null };
    },
    async createCircle({ kind, title, description, perfumeId, size, amount, spots, endsAt }) {
      active(); circlesReady();
      if (!["passaround", "giveaway"].includes(kind)) fail("Choose a pass-around or a giveaway.");
      title = String(title || "").trim(); if (title.length < 3) fail("Give it a short title.");
      if (!perf(Number(perfumeId))) fail("Pick a perfume from the catalog.");
      spots = Number(spots);
      if (kind === "passaround" && !(spots >= 2 && spots <= 20)) fail("A pass-around is for 2 to 20 people.");
      if (kind === "giveaway" && !(spots >= 1 && spots <= 50)) fail("Give away 1 to 50 samples.");
      const ends = endsAt ? new Date(endsAt) : null;
      if (kind === "giveaway" && (!ends || ends < Date.now() + 36e5 || ends > Date.now() + 30 * 864e5)) fail("Entries should close between 1 hour and 30 days from now.");
      if (db.circles.filter((c) => c.host_id === uid && ["open", "running"].includes(c.status)).length >= 3) fail("You already host 3 pass-arounds or giveaways. Finish one first.");
      const c = { id: ++db.seq, host_id: uid, kind, country_code: ccOf(uid), title: title.slice(0, 100), description: String(description || "").trim().slice(0, 1500), perfume_id: Number(perfumeId),
        size: size || "sample", amount: String(amount || "").trim().slice(0, 60), spots, ends_at: kind === "giveaway" ? ends.toISOString() : null, status: "open", current_pos: null, is_hidden: false, created_at: now() };
      db.circles.push(c); save(); return c.id;
    },
    async joinCircle(id, going) {
      me(); circlesReady();
      const c = db.circles.find((x) => x.id === Number(id)); if (!c || !canSeeCircle(c)) fail("Not found.");
      const mine = (m) => m.circle_id === c.id && m.user_id === uid;
      if (!going) { if (c.status !== "open") fail("It has already started, so you can't leave now. Message the host."); db.circleMembers = db.circleMembers.filter((m) => !mine(m)); save(); return; }
      active();
      if (c.host_id === uid) fail("You are the host.");
      if (c.status !== "open" || (c.ends_at && c.ends_at < now())) fail("This is closed now.");
      if (c.country_code !== ccOf(uid)) fail("This is in another country.");
      if (db.circleMembers.some(mine)) return;
      const n = db.circleMembers.filter((m) => m.circle_id === c.id).length;
      if (c.kind === "passaround" && n >= c.spots) fail("This pass-around is full.");
      if (c.kind === "passaround" && !db.addresses.find((a) => a.user_id === uid)) fail("Add your shipping address under Me first, so the bottle can reach you.");
      db.circleMembers.push({ circle_id: c.id, user_id: uid, joined_at: now(), position: null, received_at: null, sent_at: null, won: false });
      notify(c.host_id, uid, "circle_join", { circle_id: c.id }, c.title); save();
    },
    async startPassaround(id) {
      me(); const c = db.circles.find((x) => x.id === Number(id));
      if (!c || c.host_id !== uid) fail("Only the host can start it.");
      if (c.kind !== "passaround" || c.status !== "open") fail("This can't be started now.");
      const ms = db.circleMembers.filter((m) => m.circle_id === c.id && m.user_id !== uid).sort((a, b) => a.joined_at.localeCompare(b.joined_at));
      if (!ms.length) fail("Wait until someone joins.");
      db.circleMembers.push({ circle_id: c.id, user_id: uid, joined_at: now(), position: 0, received_at: null, sent_at: null, won: false });
      ms.forEach((m, i) => { m.position = i + 1; notify(m.user_id, uid, "circle_started", { circle_id: c.id }, c.title); });
      c.status = "running"; c.current_pos = 0; save();
    },
    async circleNextAddress(id) {
      me(); const c = db.circles.find((x) => x.id === Number(id));
      if (!c || c.status !== "running" || !db.circleMembers.some((m) => m.circle_id === c.id && m.user_id === uid && m.position === c.current_pos)) return null;
      const next = db.circleMembers.find((m) => m.circle_id === c.id && m.position === circleNext(c, c.current_pos));
      const a = db.addresses.find((x) => x.user_id === next?.user_id);
      return next ? { display_name: prof(next.user_id)?.display_name, full_name: a?.full_name || null, address: a?.address || null } : null;
    },
    async circleSent(id) {
      me(); const c = db.circles.find((x) => x.id === Number(id));
      if (!c || c.status !== "running") fail("This isn't running.");
      const m = db.circleMembers.find((x) => x.circle_id === c.id && x.user_id === uid && x.position === c.current_pos);
      if (!m) fail("It isn't your turn to send it.");
      m.sent_at = now();
      const next = db.circleMembers.find((x) => x.circle_id === c.id && x.position === circleNext(c, c.current_pos));
      notify(next?.user_id, uid, "circle_turn", { circle_id: c.id }, c.title); save();
    },
    async circleReceived(id) {
      me(); const c = db.circles.find((x) => x.id === Number(id));
      if (!c || c.status !== "running") fail("This isn't running.");
      const m = db.circleMembers.find((x) => x.circle_id === c.id && x.user_id === uid);
      if (!m || m.position == null || m.position !== circleNext(c, c.current_pos)) fail("It isn't coming to you yet.");
      const from = db.circleMembers.find((x) => x.circle_id === c.id && x.position === c.current_pos);
      if (!from?.sent_at) fail("It hasn't been sent to you yet.");
      m.received_at = now(); c.current_pos = m.position;
      if (m.position === 0) c.status = "done"; else notify(c.host_id, uid, "circle_moved", { circle_id: c.id }, c.title);
      save();
    },
    async drawGiveaway(id) {
      me(); const c = db.circles.find((x) => x.id === Number(id));
      if (!c || c.host_id !== uid) fail("Only the host can draw.");
      if (c.kind !== "giveaway" || c.status !== "open") fail("This can't be drawn now.");
      const pool = db.circleMembers.filter((m) => m.circle_id === c.id && !prof(m.user_id)?.is_banned && !blockedWith(m.user_id)).sort(() => Math.random() - 0.5).slice(0, c.spots);
      if (!pool.length) fail("Nobody has entered yet.");
      pool.forEach((m) => { m.won = true; notify(m.user_id, uid, "circle_won", { circle_id: c.id }, c.title); });
      c.status = "done"; save(); return pool.length;
    },
    async cancelCircle(id) {
      me(); const c = db.circles.find((x) => x.id === Number(id));
      if (!c || c.host_id !== uid) fail("Only the host can cancel it.");
      if (!["open", "running"].includes(c.status)) return;
      c.status = "cancelled";
      db.circleMembers.filter((m) => m.circle_id === c.id && m.user_id !== uid).forEach((m) => notify(m.user_id, uid, "circle_cancelled", { circle_id: c.id }, c.title)); save();
    },
    async setCircleHidden(id, hidden) { adminOnly(); const c = db.circles.find((x) => x.id === Number(id)); if (c) { c.is_hidden = !!hidden; save(); } },
    // ---- Notifications (migration 027) ----
    async listNotifications({ limit = 60 } = {}) {
      me(); if (needNotifSeed) { needNotifSeed = false; seedNotifications(); save(); }
      return (db.notifications || []).filter((n) => n.user_id === uid).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit).map((n) => {
        const post = n.post_id && db.posts.find((x) => x.id === n.post_id), ev = n.event_id && (db.events || []).find((x) => x.id === n.event_id), sw = n.swap_id && db.swaps.find((x) => x.id === n.swap_id);
        return { ...clone(n), actor: n.actor_id ? lite(n.actor_id) : null, post: post ? { id: post.id, body: post.body, kind: post.kind } : null,
          event: ev ? { id: ev.id, title: ev.title } : null, swap: sw ? { id: sw.id, is_gift: !!sw.is_gift } : null,
          circle: n.circle_id ? (({ id, title, kind }) => ({ id, title, kind }))((db.circles || []).find((x) => x.id === n.circle_id) || {}) : null,
          perfume: n.perfume_id ? (({ id, brand, name }) => ({ id, brand, name }))(perf(n.perfume_id) || {}) : null };
      });
    },
    async unreadNotifications() {
      if (!uid) return 0; if (needNotifSeed) { needNotifSeed = false; seedNotifications(); save(); }
      return (db.notifications || []).filter((n) => n.user_id === uid && !n.read_at).length;
    },
    async markNotificationsRead(id = null) { me(); (db.notifications || []).forEach((n) => { if (n.user_id === uid && !n.read_at && (id == null || n.id === Number(id))) n.read_at = now(); }); save(); },
    async deleteNotification(id) { me(); db.notifications = (db.notifications || []).filter((n) => !(n.user_id === uid && n.id === Number(id))); save(); },
    async signInWithProvider() { fail("Google and Apple sign-in work on the real site, not in demo mode."); },
    // ---- Invite links (same rules as migration 031) ----
    async myInviteCode() {
      me(); db.inviteCodes = db.inviteCodes || {};
      if (!db.inviteCodes[uid]) { db.inviteCodes[uid] = Math.random().toString(36).slice(2, 12); save(); }
      return db.inviteCodes[uid];
    },
    async invitePreview(code) {
      const owner = Object.entries(db.inviteCodes || {}).find(([, c]) => c === String(code || "").trim().toLowerCase())?.[0];
      return owner && !prof(owner)?.is_banned ? prof(owner).display_name : null;
    },
    async claimInvite(code) {
      const meP = prof(me());
      if (meP.invited_by || new Date(meP.created_at) < Date.now() - 7 * 864e5) return null;
      const from = Object.entries(db.inviteCodes || {}).find(([, c]) => c === String(code || "").trim().toLowerCase())?.[0];
      if (!from || from === uid || blockedWith(from) || prof(from)?.is_banned) return null;
      meP.invited_by = from;
      const [a, b] = uid < from ? [uid, from] : [from, uid];
      const f = db.friendships.find((x) => x.user_a === a && x.user_b === b);
      if (f) { f.status = "accepted"; f.accepted_at = f.accepted_at || now(); }
      else db.friendships.push({ user_a: a, user_b: b, requested_by: from, status: "accepted", created_at: now(), accepted_at: now() });
      notify(from, uid, "invite_joined"); save();
      return prof(from).display_name;
    },
    async setWishAlerts(on) { const p = prof(me()); p.wish_alerts = !!on; save(); return clone(p); },
    async setEmailActivity(on) { const p = prof(me()); p.email_activity = !!on; save(); return clone(p); },
    onNotification() { return () => {}; },
    // Demo stand-in for the AI: pretends it saw three bottles (the real one reads your photo).
    async identifyPerfumes(file) {
      me(); await Util.resizeImage(file, 400, 0.6); await new Promise((r) => setTimeout(r, 900));
      return [{ brand: "Maison Francis Kurkdjian", name: "Baccarat Rouge 540", concentration: "Eau de Parfum", size: "full", confidence: "high" },
        { brand: "Le Labo", name: "Santal 33", concentration: "", size: "decant", confidence: "medium" },
        { brand: "Byredo", name: "Gypsy Water", concentration: "Eau de Parfum", size: "sample", confidence: "low" }];
    },
    async catalogIndex() { me(); return db.perfumes.filter((p) => p.status === "approved").map(({ id, brand, name, concentration }) => ({ id, brand, name, concentration })); },
    async getPerfume(id) {
      const p = perf(Number(id));
      return p && (p.status === "approved" || p.requested_by === uid || isAdmin()) ? clone(p) : null;
    },
    async requestPerfume({ brand, name, concentration, year }) {
      active(); await tick();
      if (!Util.normText(brand) || !Util.normText(name)) fail("Please fill in both the brand and the perfume name.");
      // Same tidying as request_perfume() in migration 015.
      const b = canonicalBrand(brand).slice(0, 80), t = Util.tidyPerfumeName(b, name);
      let n = t.name, conc = String(concentration || "").trim();
      if (t.concentration && (!conc || Util.normText(conc) === Util.normText(t.concentration))) conc = t.concentration;
      else if (t.concentration) n = String(name).trim().replace(/\s+/g, " ");
      n = n.slice(0, 120);
      const key = Util.perfumeKey(b, n, conc);
      let hit = db.perfumes.find((p) => p.status !== "rejected" && Util.perfumeKey(p.brand, p.name, p.concentration) === key);
      if (!hit && !conc) hit = db.perfumes.filter((p) => p.status !== "rejected" && Util.brandNameKey(p.brand, p.name) === Util.brandNameKey(b, n))
        .sort((x, y) => (y.status === "approved") - (x.status === "approved") || x.id - y.id)[0];
      if (hit) return { result: hit.status === "approved" ? "exists" : "already_requested", id: hit.id };
      const y = year ? Number(year) : null;
      if (y !== null && !(y >= 1700 && y <= 2100)) fail("Year looks off.");
      const p = { id: ++db.seq, brand: b, name: n, concentration: conc, year: y, status: "pending", is_classic: false, requested_by: uid, created_at: now(), family: null, notes_top: [], notes_heart: [], notes_base: [], perfumers: [], rating_avg: null, rating_count: 0, image_url: null, image_credit: null };
      db.perfumes.push(p); save();
      return { result: "requested", id: p.id };
    },
    async similarPerfumes(brand, name, excludeId = null) { me(); return similarTo(brand, name, excludeId); },
    async perfumeLookup(brand, name) {
      me();
      const b = canonicalBrand(brand), t = Util.tidyPerfumeName(b, name);
      return { brand: b, name: t.name, concentration: t.concentration, similar: similarTo(brand, name) };
    },
    async catalogBrands() { me(); return approvedBrands(); },

    async listItems({ ownerId, tradeableOnly, perfumeIds, excludeOwnerId, country, limit = 200 } = {}) {
      me();
      return db.items.filter((i) => canSeeItem(i) && (!country || ccOf(i.owner_id) === country)
        && (!ownerId || i.owner_id === ownerId) && (!tradeableOnly || i.tradeable)
        && (!perfumeIds || perfumeIds.includes(i.perfume_id)) && (!excludeOwnerId || i.owner_id !== excludeOwnerId)
        && !(tradeableOnly && prof(i.owner_id)?.is_banned))
        .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit).map(withItem);
    },
    async getItem(id) { const i = db.items.find((x) => x.id === Number(id)); return i && canSeeItem(i) ? withItem(i) : null; },
    async addItem(data, photoFile) {
      active();
      if (!perf(Number(data.perfume_id))) fail("Pick a perfume from the catalog.");
      if (!["sample", "decant", "full"].includes(data.size)) fail("Pick a size.");
      const photo_url = photoFile ? (await Util.resizeImage(photoFile, 700, 0.78)).dataUrl : null;
      const i = { id: ++db.seq, owner_id: uid, perfume_id: Number(data.perfume_id), size: data.size, volume_ml: data.volume_ml ? Number(data.volume_ml) : null, fill_pct: Math.max(0, Math.min(100, Number(data.fill_pct ?? 100))), quantity: qtyOk(data.quantity ?? 1), tradeable: !!data.tradeable && qtyOk(data.quantity ?? 1) > 0, photo_url, note: String(data.note || "").slice(0, 300), is_hidden: false, created_at: now() };
      db.items.push(i); if (photo_url) keepPhoto(i.perfume_id, uid, photo_url, "listing"); wishAlert(i, false); save(); return withItem(i);
    },
    async updateItem(id, patch, photoFile) {
      const i = db.items.find((x) => x.id === Number(id) && x.owner_id === me()) || fail("Item not found.");
      const wasOpen = isOpen(i);
      ["size", "note"].forEach((k) => { if (patch[k] !== undefined) i[k] = patch[k]; });
      if (patch.volume_ml !== undefined) i.volume_ml = patch.volume_ml ? Number(patch.volume_ml) : null;
      if (patch.fill_pct !== undefined) i.fill_pct = Math.max(0, Math.min(100, Number(patch.fill_pct)));
      if (patch.tradeable !== undefined) i.tradeable = !!patch.tradeable;
      if (patch.quantity !== undefined) i.quantity = qtyOk(patch.quantity);
      if (i.quantity === 0) i.tradeable = false; // none left = not open to trade (migration 017)
      if (photoFile) { i.photo_url = (await Util.resizeImage(photoFile, 700, 0.78)).dataUrl; keepPhoto(i.perfume_id, uid, i.photo_url, "listing"); }
      wishAlert(i, wasOpen); save(); return withItem(i);
    },
    async deleteItem(id) { db.items = db.items.filter((x) => !(x.id === Number(id) && x.owner_id === me())); save(); },

    async listWishes({ userId, perfumeIds, excludeUserId, country } = {}) {
      me();
      return db.wishes.filter((w) => (w.user_id === uid || !blockedWith(w.user_id)) && (!country || ccOf(w.user_id) === country) && (!userId || w.user_id === userId) && (!perfumeIds || perfumeIds.includes(w.perfume_id))
        && (!excludeUserId || w.user_id !== excludeUserId) && !(excludeUserId && prof(w.user_id)?.is_banned)).map(withWish);
    },
    async addWish(perfumeId) {
      active();
      if (!perf(Number(perfumeId))) fail("Pick a perfume from the catalog.");
      if (db.wishes.find((w) => w.user_id === uid && w.perfume_id === Number(perfumeId))) fail("Already on your wishlist.");
      db.wishes.push({ id: ++db.seq, user_id: uid, perfume_id: Number(perfumeId), created_at: now() }); save();
    },
    async removeWish(id) { db.wishes = db.wishes.filter((w) => !(w.id === Number(id) && w.user_id === me())); save(); },

    async proposeSwap({ recipientId, myItemIds, theirItemIds, message, method = "mail", qty = {} }) {
      active(); await tick();
      if (!["mail", "meetup"].includes(method)) fail("Choose mail or meeting in person.");
      if (recipientId === uid) fail("You cannot swap with yourself.");
      if (!prof(recipientId) || prof(recipientId).is_banned || blockedWith(recipientId)) fail("This member is not available for swaps.");
      if (!myItemIds?.length || !theirItemIds?.length) fail("Pick at least one item from each side.");
      if (method === "mail" && !db.addresses.find((a) => a.user_id === uid)) fail("Add your shipping address in your profile first (it stays private until a swap is accepted).");
      if (method === "meetup") {
        const d = rawDistance(recipientId);
        if (d == null) fail("Meeting in person needs both of you to add a ZIP code under Me.");
        if (d > 20) fail("Meeting in person is for members 20 miles or less apart.");
      }
      const ok = (ids, owner) => ids.every((id) => db.items.find((i) => i.id === Number(id) && i.owner_id === owner && i.tradeable && !i.is_hidden));
      if (!ok(myItemIds, uid)) fail("Some of your items are not available for trade.");
      if (!ok(theirItemIds, recipientId)) fail("Some of their items are no longer available.");
      const s = { id: ++db.seq, proposer_id: uid, recipient_id: recipientId, status: "proposed", method, is_gift: false, meet_plan: "", meet_plan_by: null, meet_plan_at: null, message: String(message || "").slice(0, 600), proposer_shipped_at: null, recipient_shipped_at: null, proposer_received_at: null, recipient_received_at: null, created_at: now(), updated_at: now() };
      checkQty([...myItemIds, ...theirItemIds], qty);
      db.swaps.push(s); notify(recipientId, uid, s.is_gift ? "gift" : "swap_proposal", { swap_id: s.id });
      [...myItemIds, ...theirItemIds].forEach((id) => {
        const i = db.items.find((x) => x.id === Number(id));
        db.swapItems.push({ id: ++db.seq, swap_id: s.id, item_id: i.id, from_user_id: i.owner_id, perfume_id: i.perfume_id, size: i.size, volume_ml: i.volume_ml, quantity: Number(qty[id] || 1) });
      });
      save(); return s.id;
    },
    // Gifts: same rules as offer_gift() in migration 013.
    async offerGift({ recipientId, myItemIds, message, method = "mail", qty = {} }) {
      active(); await tick();
      if (!["mail", "meetup"].includes(method)) fail("Choose mail or meeting in person.");
      if (recipientId === uid) fail("You cannot give a gift to yourself.");
      if (!prof(recipientId) || prof(recipientId).is_banned || blockedWith(recipientId)) fail("This member is not available.");
      if (!myItemIds?.length) fail("Pick at least one perfume to give.");
      if (method === "meetup") {
        const d = rawDistance(recipientId);
        if (d == null) fail("Meeting in person needs both of you to add a ZIP code under Me.");
        if (d > 20) fail("Meeting in person is for members 20 miles or less apart.");
      }
      if (db.swaps.filter((s) => s.proposer_id === uid && s.is_gift && s.status === "proposed").length >= 5) fail("You have 5 gift offers waiting for an answer. Wait for those first.");
      if (!myItemIds.every((id) => db.items.find((i) => i.id === Number(id) && i.owner_id === uid && i.tradeable && !i.is_hidden))) fail("Some of your items are not available.");
      const s = { id: ++db.seq, proposer_id: uid, recipient_id: recipientId, status: "proposed", method, is_gift: true, meet_plan: "", meet_plan_by: null, meet_plan_at: null, message: String(message || "").slice(0, 600), proposer_shipped_at: null, recipient_shipped_at: null, proposer_received_at: null, recipient_received_at: null, created_at: now(), updated_at: now() };
      checkQty(myItemIds, qty);
      db.swaps.push(s); notify(recipientId, uid, s.is_gift ? "gift" : "swap_proposal", { swap_id: s.id });
      myItemIds.forEach((id) => {
        const i = db.items.find((x) => x.id === Number(id));
        db.swapItems.push({ id: ++db.seq, swap_id: s.id, item_id: i.id, from_user_id: i.owner_id, perfume_id: i.perfume_id, size: i.size, volume_ml: i.volume_ml, quantity: Number(qty[id] || 1) });
      });
      save(); return s.id;
    },
    // Prepaid shipping label for a gift (same rules as migration 019). The demo keeps the file in the browser.
    async addGiftLabel(swapId, file) {
      const s = mySwap(swapId);
      if (!(s.is_gift && s.method === "mail" && s.status === "accepted" && s.recipient_id === uid && !s.proposer_shipped_at)) fail("You can add a shipping label only to a gift you accepted, before it ships.");
      if (!file || !["application/pdf", "image/jpeg", "image/png"].includes(file.type)) fail("Choose a PDF, JPG or PNG of your shipping label.");
      if (file.size > 5 * 1024 * 1024) fail("That file is bigger than 5 MB.");
      s.label_path = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error("Couldn't read that file.")); r.readAsDataURL(file); });
      s.updated_at = now(); save();
    },
    async removeGiftLabel(swapId) {
      const s = mySwap(swapId);
      if (!(s.recipient_id === uid && !s.proposer_shipped_at)) fail("You can add a shipping label only to a gift you accepted, before it ships.");
      s.label_path = null; save();
    },
    async giftLabelUrl(path) { return path; },
    // ---- Messages (same rules as migration 020) ----
    async swapThread(swapId) {
      const s = mySwap(swapId);
      if (![s.proposer_id, s.recipient_id].includes(uid)) fail("Not your swap.");
      let t = db.threads.find((x) => x.swap_id === s.id);
      if (!t) { t = { id: ++db.seq, kind: "swap", swap_id: s.id, item_id: null, perfume_id: null, user_a: s.proposer_id, user_b: s.recipient_id, created_at: now(), last_message_at: null }; db.threads.push(t); save(); }
      return t.id;
    },
    async itemThread(itemId) {
      active(); const i = db.items.find((x) => x.id === Number(itemId));
      if (!i || !i.tradeable || i.is_hidden) fail("This listing is not available.");
      if (i.owner_id === uid) fail("This is your own listing.");
      if (blockedWith(i.owner_id)) fail("This member is not available.");
      let t = db.threads.find((x) => x.kind === "item" && x.item_id === i.id && x.user_a === uid);
      if (!t) { t = { id: ++db.seq, kind: "item", swap_id: null, item_id: i.id, perfume_id: i.perfume_id, user_a: uid, user_b: i.owner_id, created_at: now(), last_message_at: null }; db.threads.push(t); save(); }
      return t.id;
    },
    async sendMessage(threadId, body, photoFile = null) {
      active(); const t = myThread(threadId);
      const other = t.user_a === uid ? t.user_b : t.user_a;
      if (blockedWith(other)) fail("You can't message this member.");
      body = String(body || "").trim();
      const photo_url = photoFile ? (await Util.resizeImage(photoFile, 700, 0.78)).dataUrl : null;
      if (!body && !photo_url) fail("Write a message first.");
      if (body.length > 1000) fail("Messages can be up to 1,000 characters.");
      const m = { id: ++db.seq, thread_id: t.id, sender_id: uid, body, photo_url, created_at: now() };
      db.messages.push(m); t.last_message_at = m.created_at; setRead(t.id);
      notify(other, uid, "message", { thread_id: t.id, swap_id: t.swap_id }, body || "📷 Photo"); save(); return m.id;
    },
    async markThreadRead(threadId) { myThread(threadId); setRead(Number(threadId)); save(); },
    // Demo: no server to push from, so a light check every few seconds stands in for Realtime.
    watchThread(threadId, { onMessage } = {}) {
      const id = Number(threadId); let seen = db.messages.filter((m) => m.thread_id === id).length;
      const timer = setInterval(() => { const n = db.messages.filter((m) => m.thread_id === id).length; if (n !== seen) { seen = n; onMessage?.({}); } }, 3000);
      return { stop() { clearInterval(timer); }, typing() {} };
    },
    async unreadThreads() { if (!uid) return 0; return (await this.listThreads()).filter((t) => t.unread).length; },
    async getThread(id) {
      me(); const t = db.threads.find((x) => x.id === Number(id) && [x.user_a, x.user_b].includes(uid));
      if (!t) return null;
      return { ...clone(t), a: lite(t.user_a), b: lite(t.user_b), perfume: t.perfume_id ? clone(perf(t.perfume_id)) : null,
        swap: t.swap_id ? (({ id, is_gift, status }) => ({ id, is_gift, status }))(db.swaps.find((s) => s.id === t.swap_id) || {}) : null,
        messages: clone(db.messages.filter((m) => m.thread_id === t.id).sort((a, b) => a.created_at.localeCompare(b.created_at))),
        other_read_at: db.threadReads.find((r) => r.thread_id === t.id && r.user_id !== uid)?.last_read_at || null };
    },
    async listThreads() {
      me();
      return db.threads.filter((t) => [t.user_a, t.user_b].includes(uid) && t.last_message_at).sort((a, b) => b.last_message_at.localeCompare(a.last_message_at)).map((t) => {
        const ms = db.messages.filter((m) => m.thread_id === t.id).sort((a, b) => b.created_at.localeCompare(a.created_at)), l = ms[0] || null;
        const r = db.threadReads.find((x) => x.thread_id === t.id && x.user_id === uid);
        return { ...clone(t), a: lite(t.user_a), b: lite(t.user_b), perfume: t.perfume_id ? clone(perf(t.perfume_id)) : null,
          swap: t.swap_id ? (({ id, is_gift, status }) => ({ id, is_gift, status }))(db.swaps.find((s) => s.id === t.swap_id) || {}) : null,
          last: l && clone(l), unread: !!(l && l.sender_id !== uid && (!r || l.created_at > r.last_read_at)) };
      });
    },
    async setMeetPlan(id, plan) {
      const s = mySwap(id);
      if (![s.proposer_id, s.recipient_id].includes(uid)) fail("Not your swap.");
      if (s.method !== "meetup") fail("This swap is by mail.");
      if (s.status !== "accepted") fail("You can plan the meet-up once the swap is accepted.");
      s.meet_plan = String(plan || "").trim().slice(0, 300); s.meet_plan_by = uid; s.meet_plan_at = now(); s.updated_at = now(); save();
    },
    async markMet(id) {
      const s = mySwap(id);
      if (![s.proposer_id, s.recipient_id].includes(uid)) fail("Not your swap.");
      if (s.method !== "meetup") fail("This swap is by mail.");
      if (s.status !== "accepted") fail("This swap is not in progress.");
      const side = s.proposer_id === uid ? "proposer" : "recipient";
      s[side + "_shipped_at"] = s[side + "_shipped_at"] || now(); s[side + "_received_at"] = s[side + "_received_at"] || now();
      if (s.proposer_received_at && s.recipient_received_at) s.status = "completed";
      s.updated_at = now(); save();
    },

    // Location: ZIP code is private; others only get rounded distances (same rules as migration 011).
    async getMyLocation() { if (!uid) return null; const l = db.locations.find((x) => x.user_id === uid); return l ? { zip: l.zip } : null; },
    async setMyLocation(zip, cc) {
      me(); const z = await Util.postalLookup(zip, cc || ccOf(uid));
      db.locations = db.locations.filter((x) => x.user_id !== uid);
      db.locations.push({ user_id: uid, zip: z.zip, lat: Math.round(z.lat * 100) / 100, lon: Math.round(z.lon * 100) / 100 }); save();
    },
    async clearMyLocation() { db.locations = db.locations.filter((x) => x.user_id !== me()); save(); },
    // Blurred point (rounded to 0.1°) for the general-area map, same rules as member_area() in migration 012.
    async memberArea(userId) {
      if (!uid || !userId || (userId !== uid && blockedWith(userId))) return null;
      const l = db.locations.find((x) => x.user_id === userId);
      return l ? { lat: Math.round(l.lat * 10) / 10, lon: Math.round(l.lon * 10) / 10 } : null;
    },
    async memberDistances(userIds) {
      const out = {};
      [...new Set(userIds)].filter((id) => id && id !== uid && !blockedWith(id)).forEach((id) => {
        const d = rawDistance(id); const m = d == null ? null : Util.roundMiles(d);
        if (m != null) out[id] = m;
      });
      return out;
    },

    async listMySwaps() {
      me();
      return db.swaps.filter((s) => s.proposer_id === uid || s.recipient_id === uid)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at)).map(swapFull);
    },
    async getSwap(id) { return swapFull(mySwap(id)); },
    async respondSwap(id, accept) {
      const s = mySwap(id);
      if (s.recipient_id !== uid) fail("Only the person who received this proposal can answer it.");
      if (s.status !== "proposed") fail("This proposal has already been answered.");
      if (accept) { active(); if (!s.proposer_id || blockedWith(s.proposer_id)) fail("This member is not available for swaps."); if (s.method !== "meetup" && !db.addresses.find((a) => a.user_id === uid)) fail("Add your shipping address in your profile before accepting."); }
      if (accept) {
        const parts = db.swapItems.filter((x) => x.swap_id === s.id && x.item_id);
        parts.forEach((x) => { const i = db.items.find((y) => y.id === x.item_id); if (!i || i.quantity < (x.quantity || 1)) { const p = perf(x.perfume_id); fail(`Not enough left of ${p?.brand} ${p?.name}: it may have been swapped already.`); } });
        parts.forEach((x) => { const i = db.items.find((y) => y.id === x.item_id); i.quantity -= x.quantity || 1; if (i.quantity <= 0) { i.quantity = 0; i.tradeable = false; } });
      }
      s.status = accept ? "accepted" : "declined"; s.updated_at = now(); notify(s.proposer_id, uid, "swap_" + s.status, { swap_id: s.id }); save();
    },
    async cancelSwap(id) {
      const s = mySwap(id);
      if (s.proposer_id !== uid || s.status !== "proposed") fail("This proposal cannot be withdrawn.");
      s.status = "cancelled"; s.updated_at = now(); notify(s.recipient_id, uid, "swap_cancelled", { swap_id: s.id }); save();
    },
    async markShipped(id) {
      const s = mySwap(id);
      if (![s.proposer_id, s.recipient_id].includes(uid)) fail("Not your swap.");
      if (s.method === "meetup") fail("This swap is a meet-up — confirm when you have met.");
      if (s.status !== "accepted") fail("You can mark shipping only on an accepted swap.");
      if (s.is_gift && s.proposer_id !== uid) fail("This is a gift to you — there is nothing for you to ship.");
      const k = s.proposer_id === uid ? "proposer_shipped_at" : "recipient_shipped_at";
      const first = !s[k]; s[k] = s[k] || now(); s.updated_at = now();
      if (first) notify(s.proposer_id === uid ? s.recipient_id : s.proposer_id, uid, "swap_shipped", { swap_id: s.id }); save();
    },
    async markReceived(id) {
      const s = mySwap(id);
      if (![s.proposer_id, s.recipient_id].includes(uid)) fail("Not your swap.");
      if (s.status !== "accepted") fail("This swap is not in progress.");
      const mine = s.proposer_id === uid;
      if (s.is_gift && mine) fail("You are the giver — the receiver confirms when it arrives.");
      if (!(mine ? s.recipient_shipped_at : s.proposer_shipped_at)) fail("They have not marked their package as shipped yet.");
      const k = mine ? "proposer_received_at" : "recipient_received_at";
      s[k] = s[k] || now();
      const other = mine ? s.recipient_id : s.proposer_id;
      if (s.recipient_received_at && (s.is_gift || s.proposer_received_at)) { s.status = "completed"; notify(other, uid, "swap_completed", { swap_id: s.id }); }
      else notify(other, uid, "swap_received", { swap_id: s.id });
      s.updated_at = now(); save();
    },

    // ---- Tracking numbers and claims (same rules as migration 033) ----
    async setTracking(id, tracking) {
      const s = mySwap(id); if (![s.proposer_id, s.recipient_id].includes(uid)) fail("Not your swap.");
      if (s.method === "meetup") fail("This swap is a meet-up.");
      const v = String(tracking || "").trim() || null;
      if (v && (v.length > 60 || !/^[A-Za-z0-9 .:#/-]+$/.test(v))) fail("That doesn't look like a tracking number.");
      const mine = s.proposer_id === uid;
      if (!(mine ? s.proposer_shipped_at : s.recipient_shipped_at)) fail("Mark your package as shipped first.");
      s[mine ? "proposer_tracking" : "recipient_tracking"] = v; s.updated_at = now(); save();
    },
    async listClaims({ swapId = null, open = false } = {}) {
      me();
      return (db.claims || []).filter((c) => (!swapId || c.swap_id === Number(swapId)) && (!open || c.status === "open")).filter((c) => {
        const s = db.swaps.find((x) => x.id === c.swap_id); return isAdmin() || (s && [s.proposer_id, s.recipient_id].includes(uid));
      }).sort((a, b) => b.created_at.localeCompare(a.created_at)).map((c) => {
        const s = db.swaps.find((x) => x.id === c.swap_id);
        return { ...clone(c), opener: lite(c.opened_by), swap: s ? { ...clone(s), proposer: lite(s.proposer_id), recipient: lite(s.recipient_id) } : null };
      });
    },
    async openClaim(id, kind, details) {
      active(); const s = mySwap(id);
      if (!["not_arrived", "damaged", "not_as_described"].includes(kind)) fail("Choose what went wrong.");
      if (s.method === "meetup" || !["accepted", "completed"].includes(s.status)) fail("Claims are for mailed swaps that were accepted.");
      const mine = s.proposer_id === uid;
      if (s.is_gift && mine) fail("You are the giver. Message the receiver instead.");
      const theirShip = mine ? s.recipient_shipped_at : s.proposer_shipped_at, myRecv = mine ? s.proposer_received_at : s.recipient_received_at;
      if (kind === "not_arrived") {
        if (myRecv) fail("You marked it as received.");
        if (!theirShip || new Date(theirShip) > Date.now() - 7 * 864e5) fail("Give it 7 days after it was shipped. Most packages arrive within a week.");
      } else if (!myRecv && !theirShip) fail("Nothing has been shipped to you yet.");
      db.claims = db.claims || [];
      if (db.claims.some((c) => c.swap_id === s.id && c.opened_by === uid && c.status === "open")) fail("You already have an open claim on this swap.");
      const c = { id: ++db.seq, swap_id: s.id, opened_by: uid, kind, details: String(details || "").trim().slice(0, 1000), status: "open", resolution: "", resolved_by: null, created_at: now(), resolved_at: null };
      db.claims.push(c);
      notify(mine ? s.recipient_id : s.proposer_id, uid, "claim_opened", { swap_id: s.id });
      db.profiles.filter((p) => p.is_admin && p.id !== uid && p.id !== (mine ? s.recipient_id : s.proposer_id)).forEach((p) => notify(p.id, uid, "claim_opened", { swap_id: s.id }));
      save(); return c.id;
    },
    async resolveClaim(id, resolution) {
      me(); const c = (db.claims || []).find((x) => x.id === Number(id)) || fail("Claim not found.");
      if (!isAdmin() && c.opened_by !== uid) fail("Only an admin (or the person who opened it) can close a claim.");
      if (c.status === "resolved") return;
      Object.assign(c, { status: "resolved", resolution: String(resolution || "").trim().slice(0, 1000), resolved_by: uid, resolved_at: now() });
      const s = db.swaps.find((x) => x.id === c.swap_id);
      if (s) { notify(s.proposer_id, uid, "claim_resolved", { swap_id: s.id }, resolution); notify(s.recipient_id, uid, "claim_resolved", { swap_id: s.id }, resolution); }
      save();
    },
    // Demo-only: pretend a shipment happened 8 days ago, to try "didn't arrive".
    demoAgeShipment(id) { const s = db.swaps.find((x) => x.id === Number(id)); if (!s) return; ["proposer_shipped_at", "recipient_shipped_at"].forEach((k) => { if (s[k]) s[k] = daysAgo(8); }); save(); },
    async listReviews({ revieweeId, reviewerId, swapId } = {}) {
      return db.reviews.filter((r) => (!revieweeId || r.reviewee_id === revieweeId) && (!reviewerId || r.reviewer_id === reviewerId) && (!swapId || r.swap_id === Number(swapId)))
        .sort((a, b) => b.created_at.localeCompare(a.created_at)).map((r) => ({ ...clone(r), reviewer: lite(r.reviewer_id) }));
    },
    async leaveReview({ swapId, revieweeId, rating, comment }) {
      active();
      const s = mySwap(swapId);
      const okPair = (s.proposer_id === uid && s.recipient_id === revieweeId) || (s.recipient_id === uid && s.proposer_id === revieweeId);
      if (s.status !== "completed" || !okPair) fail("You can review only your partner, after the swap is completed.");
      if (db.reviews.find((r) => r.swap_id === s.id && r.reviewer_id === uid)) fail("You already reviewed this swap.");
      const n = Number(rating);
      if (!(n >= 1 && n <= 5)) fail("Pick 1 to 5 stars.");
      db.reviews.push({ id: ++db.seq, swap_id: s.id, reviewer_id: uid, reviewee_id: revieweeId, rating: n, comment: String(comment || "").slice(0, 600), created_at: now() });
      notify(revieweeId, uid, "review", { swap_id: s.id }, `${n}★ ${String(comment || "")}`); save();
    },
    async getStats(userIds) {
      const out = {};
      [...new Set(userIds)].forEach((id) => {
        const rs = db.reviews.filter((r) => r.reviewee_id === id);
        out[id] = {
          completed_swaps: db.swaps.filter((s) => s.status === "completed" && (s.proposer_id === id || s.recipient_id === id)).length,
          review_count: rs.length,
          avg_rating: rs.length ? Math.round((rs.reduce((a, r) => a + r.rating, 0) / rs.length) * 10) / 10 : null
        };
      });
      return out;
    },

    async report({ targetUserId, targetItemId, targetPerfumeReviewId, targetPostId, targetPostCommentId, targetPerfumePhotoId, reason }) {
      me();
      if (String(reason || "").trim().length < 3) fail("Please say briefly what is wrong.");
      db.reports.push({ id: ++db.seq, reporter_id: uid, target_user_id: targetUserId || null, target_item_id: targetItemId ? Number(targetItemId) : null, target_perfume_review_id: targetPerfumeReviewId ? Number(targetPerfumeReviewId) : null,
        target_post_id: targetPostId ? Number(targetPostId) : null, target_post_comment_id: targetPostCommentId ? Number(targetPostCommentId) : null,
        target_perfume_photo_id: targetPerfumePhotoId ? Number(targetPerfumePhotoId) : null, reason: reason.trim().slice(0, 1000), status: "open", created_at: now() });
      save();
    },

    // ---- Member photos kept under each perfume (migration 024) ----
    async listPerfumePhotos(perfumeId) {
      me();
      return db.perfumePhotos.filter((x) => x.perfume_id === Number(perfumeId) && (isAdmin() || x.user_id === uid || (!x.is_hidden && !blockedWith(x.user_id))))
        .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 24).map((x) => ({ ...clone(x), user: lite(x.user_id) }));
    },
    async listRecentPerfumePhotos() {
      adminOnly();
      return db.perfumePhotos.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 60)
        .map((x) => { const p = perf(x.perfume_id); return { ...clone(x), user: lite(x.user_id), perfume: p && { id: p.id, brand: p.brand, name: p.name, concentration: p.concentration } }; });
    },
    async deletePerfumePhoto(id) {
      const x = db.perfumePhotos.find((y) => y.id === Number(id)); if (!x) return;
      if (x.user_id !== me() && !isAdmin()) fail("You can only remove your own photos.");
      db.perfumePhotos = db.perfumePhotos.filter((y) => y !== x); refreshMemberPhoto(x.perfume_id); save();
    },
    async setPerfumePhotoHidden(id, hidden) {
      adminOnly(); const x = db.perfumePhotos.find((y) => y.id === Number(id));
      if (x) { x.is_hidden = !!hidden; refreshMemberPhoto(x.perfume_id); save(); }
    },

    // Notes corrections & pictures
    async suggestNotes({ perfumeId, family, top, heart, base, perfumers, comment }) {
      active();
      const p = perf(Number(perfumeId)) || fail("Perfume not found.");
      if (family && !window.SCENT_FAMILIES.includes(family)) fail("Pick a scent family from the list.");
      const clean = (a) => (a || []).map((x) => String(x).trim()).filter(Boolean).slice(0, 15);
      if (![top, heart, base, perfumers].some((a) => clean(a).length)) fail("Add at least one note or a perfumer.");
      db.noteSuggestions.push({ id: ++db.seq, perfume_id: p.id, suggested_by: uid, family: family || null, notes_top: clean(top), notes_heart: clean(heart), notes_base: clean(base), perfumers: clean(perfumers).slice(0, 8), comment: String(comment || "").slice(0, 500), status: "pending", created_at: now() });
      save();
    },
    async latestMemberPhoto(perfumeId) {
      const i = db.items.filter((x) => x.perfume_id === Number(perfumeId) && x.photo_url && canSeeItem(x)).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      return i ? { photo_url: i.photo_url, created_at: i.created_at, owner: lite(i.owner_id) } : null;
    },
    async listNoteSuggestions() {
      adminOnly();
      return db.noteSuggestions.filter((s) => s.status === "pending").map((s) => ({ ...clone(s), perfume: clone(perf(s.perfume_id)), suggester: lite(s.suggested_by) }));
    },
    async reviewNoteSuggestion(id, approve) {
      adminOnly();
      const s = db.noteSuggestions.find((x) => x.id === Number(id) && x.status === "pending");
      if (!s) return;
      if (approve) {
        const p = perf(s.perfume_id);
        if (s.family) p.family = s.family;
        if (s.notes_top.length + s.notes_heart.length + s.notes_base.length) Object.assign(p, { notes_top: s.notes_top, notes_heart: s.notes_heart, notes_base: s.notes_base });
        if ((s.perfumers || []).length) p.perfumers = s.perfumers;
      }
      s.status = approve ? "approved" : "rejected"; save();
    },
    async setPerfumeYear(perfumeId, year) {
      adminOnly();
      const p = perf(Number(perfumeId)) || fail("Perfume not found.");
      const y = year === "" || year == null ? null : Number(year);
      if (y !== null && !(y >= 1700 && y <= 2100)) fail("That year looks off.");
      p.year = y; p.is_classic = y !== null && y < 2000; save();
    },
    async setPerfumeImage(perfumeId, file, credit) {
      adminOnly();
      const p = perf(Number(perfumeId)) || fail("Perfume not found.");
      if (file) { p.image_url = (await Util.resizeImage(file, 800, 0.8)).dataUrl; p.image_credit = String(credit || "").slice(0, 200); }
      else { p.image_url = null; p.image_credit = null; }
      save();
    },
    // Profile photo (avatar). file = null removes it.
    async setMyAvatar(file) {
      const p = prof(me());
      p.avatar_url = file ? (await Util.resizeImage(file, 300, 0.8)).dataUrl : null;
      save(); return clone(p);
    },
    async adminClearAvatar(userId) { adminOnly(); const p = prof(userId); if (p) { p.avatar_url = null; save(); } },
    // Members suggest a photo of their own bottle as the catalog picture; an admin approves it.
    async suggestPhoto(perfumeId, file) {
      active();
      const p = perf(Number(perfumeId)); if (!p || p.status !== "approved") fail("Perfume not found.");
      if (!file) fail("Choose a photo first.");
      const image_url = (await Util.resizeImage(file, 800, 0.8)).dataUrl;
      db.photoSuggestions.push({ id: ++db.seq, perfume_id: p.id, suggested_by: uid, image_url, status: "pending", created_at: now() });
      save();
    },
    async myPendingPhoto(perfumeId) {
      if (!uid) return null;
      return clone(db.photoSuggestions.find((s) => s.perfume_id === Number(perfumeId) && s.suggested_by === uid && s.status === "pending") || null);
    },
    async listPhotoSuggestions() {
      adminOnly();
      return db.photoSuggestions.filter((s) => s.status === "pending").map((s) => ({ ...clone(s), perfume: clone(perf(s.perfume_id)), suggester: lite(s.suggested_by) }));
    },
    async reviewPhotoSuggestion(id, approve) {
      adminOnly();
      const s = db.photoSuggestions.find((x) => x.id === Number(id) && x.status === "pending");
      if (!s) return;
      if (approve) { const p = perf(s.perfume_id); p.image_url = s.image_url; p.image_credit = "Photo by " + (prof(s.suggested_by)?.display_name || "a member"); }
      s.status = approve ? "approved" : "rejected"; save();
    },

    // Perfume reviews (stars + tags), separate from member-to-member swap reviews.
    async listPerfumeReviews(perfumeId) {
      me();
      const banned = (id) => !!prof(id)?.is_banned;
      return db.perfumeReviews.filter((r) => r.perfume_id === Number(perfumeId)
          && (r.user_id === uid || isAdmin() || (!r.is_hidden && (r.user_id == null || (!banned(r.user_id) && !blockedWith(r.user_id))))))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((r) => ({ ...clone(r), author: lite(r.user_id), voted: db.reviewVotes.some((x) => x.review_id === r.id && x.user_id === uid) }));
    },
    async savePerfumeReview({ perfumeId, rating, body, longevity, sillage, seasons, daytimes }) {
      active(); await tick();
      const p = perf(Number(perfumeId)); if (!p || p.status !== "approved") fail("Perfume not found.");
      const n = Number(rating); if (!(n >= 1 && n <= 5)) fail("Pick 1 to 5 stars.");
      const pick = (v, ok) => (ok.includes(v) ? v : null);
      const row = { rating: n, body: String(body || "").trim().slice(0, 1000),
        longevity: pick(longevity, ["weak", "moderate", "long-lasting", "beast"]), sillage: pick(sillage, ["intimate", "moderate", "strong"]),
        seasons: (seasons || []).filter((x) => ["spring", "summer", "fall", "winter"].includes(x)), daytimes: (daytimes || []).filter((x) => ["day", "night"].includes(x)), updated_at: now() };
      const mine = db.perfumeReviews.find((r) => r.perfume_id === p.id && r.user_id === uid);
      if (mine) Object.assign(mine, row);
      else db.perfumeReviews.push({ id: ++db.seq, perfume_id: p.id, user_id: uid, helpful_count: 0, is_hidden: false, created_at: now(), ...row });
      recalcRating(db, p.id); save();
    },
    async deletePerfumeReview(id) {
      const r = db.perfumeReviews.find((x) => x.id === Number(id) && x.user_id === me()); if (!r) return;
      db.perfumeReviews = db.perfumeReviews.filter((x) => x !== r);
      db.reviewVotes = db.reviewVotes.filter((x) => x.review_id !== r.id);
      recalcRating(db, r.perfume_id); save();
    },
    async voteHelpful(reviewId, on) {
      active();
      const r = db.perfumeReviews.find((x) => x.id === Number(reviewId)) || fail("Review not found.");
      if (r.user_id === uid) fail("You can't vote on your own review.");
      db.reviewVotes = db.reviewVotes.filter((x) => !(x.review_id === r.id && x.user_id === uid));
      if (on) db.reviewVotes.push({ review_id: r.id, user_id: uid });
      r.helpful_count = db.reviewVotes.filter((x) => x.review_id === r.id).length; save();
    },
    async setPerfumeReviewHidden(id, hidden) {
      adminOnly();
      const r = db.perfumeReviews.find((x) => x.id === Number(id)); if (!r) return;
      r.is_hidden = !!hidden; recalcRating(db, r.perfume_id); save();
    },

    // CSV import (admin). Same checks as admin_import_perfumes() in migration 009.
    async importPerfumes(rows, commit, allowPre2000 = false) {
      adminOnly(); await tick();
      if (rows.length > 1000) fail("Import at most 1,000 rows at a time.");
      const ABBR = { edp: "Eau de Parfum", edt: "Eau de Toilette", edc: "Eau de Cologne", extrait: "Extrait de Parfum" };
      const seen = new Set(), out = [];
      const arr = (a, n, len) => (a || []).map((x) => String(x).trim().slice(0, len)).filter(Boolean).slice(0, n);
      rows.forEach((r, k) => {
        const row = k + 1;
        const brand = canonicalBrand(r.brand).slice(0, 80);
        let name = String(r.name || "").trim().slice(0, 120);
        let conc = String(r.concentration || "").trim().slice(0, 60);
        conc = ABBR[conc.toLowerCase().replace(/[^a-z]/g, "")] || conc;
        const t = Util.tidyPerfumeName(brand, name);
        if (!t.concentration || !conc || Util.normText(conc) === Util.normText(t.concentration)) { name = t.name.slice(0, 120); conc = conc || t.concentration; }
        if (!Util.normText(brand) || !Util.normText(name)) return out.push({ row, status: "invalid", message: "Brand and name are required." });
        const ys = String(r.year ?? "").trim(), year = ys ? Number(ys) : null;
        if (year !== null && !(Number.isInteger(year) && year >= 1700 && year <= 2100)) return out.push({ row, status: "invalid", message: "Year looks off." });
        let family = String(r.family || "").trim().toLowerCase(), message = "";
        if (family === "fougere") family = "fougère";
        if (!family) family = null; else if (!window.SCENT_FAMILIES.includes(family)) { message = `Unknown family "${family}" left empty.`; family = null; }
        const key = Util.perfumeKey(brand, name, conc);
        if (seen.has(key)) return out.push({ row, status: "duplicate_in_file", message: "Same perfume appears earlier in this file." });
        seen.add(key);
        const hit = db.perfumes.find((p) => p.status !== "rejected" && Util.perfumeKey(p.brand, p.name, p.concentration) === key);
        if (hit) return out.push({ row, status: "exists", id: hit.id, message: "Already in the catalog." });
        if (year !== null && year < 2000 && !allowPre2000) return out.push({ row, status: "pre2000", message: "Released before 2000 — skipped unless you allow classics." });
        if (!commit) return out.push({ row, status: "new", message });
        const p = { id: ++db.seq, brand, name, concentration: conc, year, status: "approved", is_classic: year !== null && year < 2000, requested_by: null, created_at: now(), family,
          notes_top: arr(r.notes_top, 15, 60), notes_heart: arr(r.notes_heart, 15, 60), notes_base: arr(r.notes_base, 15, 60), perfumers: arr(r.perfumers, 8, 80), rating_avg: null, rating_count: 0, image_url: null, image_credit: null };
        db.perfumes.push(p); out.push({ row, status: "added", id: p.id, message });
      });
      if (commit) save();
      return out;
    },

    // Admin
    isAdmin: async () => isAdmin(),
    async listPendingPerfumes() {
      adminOnly();
      return db.perfumes.filter((p) => p.status === "pending").map((p) => ({
        ...clone(p), requester: lite(p.requested_by),
        similar: similarTo(p.brand, p.name, p.id)
      }));
    },
    async findDuplicatePerfumes() {
      adminOnly(); await tick();
      db.notDuplicates = db.notDuplicates || [];
      const uses = (id) => db.items.filter((i) => i.perfume_id === id).length + db.wishes.filter((w) => w.perfume_id === id).length;
      const ps = db.perfumes.filter((p) => p.status === "approved").map((p) => {
        const cb = Util.canonicalBrand(p.brand); return { p, bk: Util.brandKey(cb), w: Util.normWords(p.name), c: Util.normText(p.concentration) };
      });
      const groups = new Map(); ps.forEach((x) => { if (!groups.has(x.bk)) groups.set(x.bk, []); groups.get(x.bk).push(x); });
      const out = [];
      groups.forEach((g) => { for (let i = 0; i < g.length; i++) for (let j = 0; j < g.length; j++) {
        let [x, y] = [g[i], g[j]]; if (x.p.id >= y.p.id) continue;
        if (!(x.c === y.c || !x.c || !y.c)) continue;
        if (!(x.w === y.w || Util.normText(x.p.name) === Util.normText(y.p.name) || Util.oneWordTypo(x.w, y.w))) continue;
        if (db.notDuplicates.some((n) => n.a === x.p.id && n.b === y.p.id)) continue;
        const side = (q) => ({ id: q.id, brand: q.brand, name: q.name, concentration: q.concentration, year: q.year, uses: uses(q.id) });
        out.push({ score: Util.normText(x.p.name) === Util.normText(y.p.name) ? 1 : Math.round(Util.similarity(x.w, y.w) * 100) / 100, a: side(x.p), b: side(y.p) });
      } });
      return out.sort((x, y) => y.score - x.score).slice(0, 200);
    },
    async markNotDuplicate(a, b) {
      adminOnly(); db.notDuplicates = db.notDuplicates || [];
      const [x, y] = [Number(a), Number(b)].sort((m, n) => m - n);
      if (!db.notDuplicates.some((n) => n.a === x && n.b === y)) db.notDuplicates.push({ a: x, b: y });
      save();
    },
    // Same as admin_merge_perfumes() in migration 015.
    async mergePerfumes(dupId, keepId, useDupName = false) {
      adminOnly(); await tick();
      const dup = Number(dupId), keep = Number(keepId);
      if (dup === keep) fail("Pick two different perfumes.");
      const d = perf(dup) || fail("The duplicate was not found (maybe it was already merged).");
      const k = perf(keep) || fail("The perfume to keep was not found.");
      if (k.status === "rejected") fail("Keep an approved perfume, not a rejected one.");
      if (useDupName && db.perfumes.some((p) => p.id !== keep && p.id !== dup && p.status !== "rejected" && Util.perfumeKey(p.brand, p.name, p.concentration) === Util.perfumeKey(k.brand, d.name, k.concentration)))
        fail("Another perfume already uses that name. Merge that one first.");
      const r = { items: 0, wishlists: 0, wishlists_already_there: 0, swaps: 0, reviews: 0, reviews_already_there: 0 };
      db.items.forEach((i) => { if (i.perfume_id === dup) { i.perfume_id = keep; r.items++; } });
      db.swapItems.forEach((i) => { if (i.perfume_id === dup) { i.perfume_id = keep; r.swaps++; } });
      db.wishes = db.wishes.filter((w) => { const drop = w.perfume_id === dup && db.wishes.some((x) => x.user_id === w.user_id && x.perfume_id === keep); if (drop) r.wishlists_already_there++; return !drop; });
      db.wishes.forEach((w) => { if (w.perfume_id === dup) { w.perfume_id = keep; r.wishlists++; } });
      db.perfumeReviews = db.perfumeReviews.filter((v) => { const drop = v.perfume_id === dup && db.perfumeReviews.some((x) => x.user_id === v.user_id && x.perfume_id === keep); if (drop) r.reviews_already_there++; return !drop; });
      db.perfumeReviews.forEach((v) => { if (v.perfume_id === dup) { v.perfume_id = keep; r.reviews++; } });
      db.noteSuggestions.forEach((x) => { if (x.perfume_id === dup) x.perfume_id = keep; });
      db.photoSuggestions.forEach((x) => { if (x.perfume_id === dup) x.perfume_id = keep; });
      db.posts.forEach((x) => { if (x.perfume_id === dup) x.perfume_id = keep; });
      db.perfumePhotos = db.perfumePhotos.filter((x) => !(x.perfume_id === dup && db.perfumePhotos.some((y) => y.perfume_id === keep && y.image_url === x.image_url)));
      db.perfumePhotos.forEach((x) => { if (x.perfume_id === dup) x.perfume_id = keep; });
      refreshMemberPhoto(keep);
      k.year = k.year ?? d.year; k.family = k.family || d.family;
      ["notes_top", "notes_heart", "notes_base", "perfumers"].forEach((f) => { if (!(k[f] || []).length) k[f] = d[f] || []; });
      if (!k.image_url) { k.image_url = d.image_url; k.image_credit = d.image_credit; }
      k.is_classic = !!(k.is_classic || d.is_classic);
      db.perfumes = db.perfumes.filter((p) => p.id !== dup);
      if (useDupName) k.name = d.name;
      recalcRating(db, keep); save();
      return r;
    },
    async reviewPerfume(id, approve) {
      adminOnly();
      const p = db.perfumes.find((x) => x.id === Number(id) && x.status === "pending");
      if (p) { p.status = approve ? "approved" : "rejected"; if (approve) p.is_classic = p.year != null && p.year < 2000; save(); }
    },
    async listReports() {
      adminOnly();
      return db.reports.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).map((r) => {
        const it = r.target_item_id && db.items.find((i) => i.id === r.target_item_id);
        const pr = r.target_perfume_review_id && db.perfumeReviews.find((x) => x.id === r.target_perfume_review_id);
        const ph = r.target_perfume_photo_id && db.perfumePhotos.find((x) => x.id === r.target_perfume_photo_id);
        const po = r.target_post_id && db.posts.find((x) => x.id === r.target_post_id);
        const pc = r.target_post_comment_id && db.postComments.find((x) => x.id === r.target_post_comment_id);
        return { ...clone(r), reporter: lite(r.reporter_id), target_user: lite(r.target_user_id), target_item: it ? withItem(it) : null,
          target_post: po ? clone(po) : null, target_post_comment: pc ? clone(pc) : null, target_perfume_photo: ph ? clone(ph) : null,
          target_perfume_review: pr ? { ...clone(pr), perfume: clone(perf(pr.perfume_id)), author: lite(pr.user_id) } : null };
      });
    },
    async resolveReport(id) { adminOnly(); const r = db.reports.find((x) => x.id === Number(id)); if (r) { r.status = "resolved"; save(); } },
    async setBan(userId, banned) {
      adminOnly();
      if (userId === uid) fail("You cannot ban yourself.");
      const p = prof(userId); if (!p) return;
      p.is_banned = !!banned;
      db.perfumeReviews.filter((r) => r.user_id === userId).forEach((r) => recalcRating(db, r.perfume_id));
      new Set(db.perfumePhotos.filter((x) => x.user_id === userId).map((x) => x.perfume_id)).forEach(refreshMemberPhoto);
      if (banned) {
        db.items.forEach((i) => { if (i.owner_id === userId) i.tradeable = false; });
        db.swaps.forEach((s) => { if (s.status === "proposed" && (s.proposer_id === userId || s.recipient_id === userId)) { s.status = "cancelled"; s.updated_at = now(); } });
      }
      save();
    },
    async setItemHidden(id, hidden) { adminOnly(); const i = db.items.find((x) => x.id === Number(id)); if (i) { i.is_hidden = !!hidden; save(); } },
    async listMembers() { adminOnly(); return clone(db.profiles); },

    // ---- Countries (migration 016) ----
    async setMyCountry(code) {
      me();
      if (!Util.COUNTRIES.some((c) => c.code === code)) fail("Swapfume is open in " + Util.openCountriesText() + ".");
      const p = prof(uid); if (p.country_code === code) return;
      if (db.swaps.some((s) => [s.proposer_id, s.recipient_id].includes(uid) && ["proposed", "accepted"].includes(s.status))) fail("Finish or cancel your open swaps before changing country.");
      p.country_code = code; p.country = Util.country(code).name;
      db.locations = db.locations.filter((x) => x.user_id !== uid); save();
    },
    async requestCountry(email, country) {
      await tick();
      email = String(email || "").trim().toLowerCase(); country = String(country || "").trim().replace(/\s+/g, " ");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail("Please enter a valid email address.");
      if (country.length < 2 || country.length > 60) fail("Please choose your country.");
      if (!db.countryRequests.some((r) => r.email === email && r.country.toLowerCase() === country.toLowerCase()))
        db.countryRequests.push({ id: ++db.seq, email, country, created_at: now() });
      save();
    },
    async listCountryRequests() { adminOnly(); return clone(db.countryRequests).sort((a, b) => b.created_at.localeCompare(a.created_at)); },
    async deleteCountryRequest(id) { adminOnly(); db.countryRequests = db.countryRequests.filter((r) => r.id !== Number(id)); save(); },

    // ---- Community meetups (migration 017) ----
    async listEvents({ country, past = false } = {}) {
      me();
      const cut = new Date(Date.now() - 6 * 3600e3).toISOString();
      return db.events.filter((e) => canSeeEvent(e) && (!country || e.country_code === country) && (past ? e.starts_at < cut : e.starts_at >= cut))
        .sort((a, b) => (past ? -1 : 1) * a.starts_at.localeCompare(b.starts_at))
        .map((e) => ({ ...clone(e), organizer: lite(e.organizer_id), attendees: db.eventAttendees.filter((x) => x.event_id === e.id).map((x) => ({ user_id: x.user_id })) }));
    },
    async getEvent(id) {
      me(); const e = db.events.find((x) => x.id === Number(id));
      if (!e || !canSeeEvent(e)) return null;
      return { ...clone(e), organizer: lite(e.organizer_id),
        attendees: db.eventAttendees.filter((x) => x.event_id === e.id).map((x) => ({ ...clone(x), user: lite(x.user_id) })),
        comments: db.eventComments.filter((c) => c.event_id === e.id && !blockedWith(c.user_id)).map((c) => ({ ...clone(c), user: lite(c.user_id) })) };
    },
    async saveEvent(id, d) {
      active(); await tick();
      const t = new Date(d.starts_at);
      if (isNaN(t) || t < new Date()) fail("Pick a date and time in the future.");
      if (t > new Date(Date.now() + 366 * 864e5)) fail("Pick a date within the next year.");
      const title = String(d.title || "").trim(), city = String(d.city || "").trim(), place = String(d.place || "").trim();
      if (title.length < 3) fail("Give your meetup a title."); if (city.length < 2) fail("Add the city."); if (place.length < 3) fail("Add the public place where you'll meet.");
      const max = d.max_people ? Number(d.max_people) : null;
      if (max != null && (max < 2 || max > 500)) fail("Maximum people must be between 2 and 500.");
      const row = { title: title.slice(0, 100), description: String(d.description || "").trim().slice(0, 2000), city: city.slice(0, 80), place: place.slice(0, 200), starts_at: t.toISOString(), max_people: max };
      if (id) {
        const e = db.events.find((x) => x.id === Number(id) && x.organizer_id === uid && x.status === "active") || fail("Only the organizer can edit this event.");
        Object.assign(e, row); save(); return e.id;
      }
      if (db.events.filter((e) => e.organizer_id === uid && e.status === "active" && e.starts_at > now()).length >= 5) fail("You already have 5 upcoming events.");
      const e = { id: ++db.seq, organizer_id: uid, country_code: ccOf(uid), status: "active", is_hidden: false, created_at: now(), ...row };
      db.events.push(e); db.eventAttendees.push({ event_id: e.id, user_id: uid, created_at: now() }); save(); return e.id;
    },
    async cancelEvent(id) {
      const e = db.events.find((x) => x.id === Number(id) && x.organizer_id === me() && x.status === "active") || fail("Only the organizer can cancel this event.");
      e.status = "cancelled"; db.eventAttendees.filter((x) => x.event_id === e.id).forEach((x) => notify(x.user_id, uid, "meetup_cancelled", { event_id: e.id }, e.title)); save();
    },
    async joinEvent(id, going) {
      active(); const e = db.events.find((x) => x.id === Number(id));
      if (!e || !canSeeEvent(e)) fail("Event not found.");
      const mine = (x) => x.event_id === e.id && x.user_id === uid;
      if (!going) { if (e.organizer_id === uid) fail("You are the organizer. Cancel the event instead."); db.eventAttendees = db.eventAttendees.filter((x) => !mine(x)); save(); return; }
      if (e.status !== "active" || e.starts_at < now()) fail("This event is no longer open.");
      if (e.country_code !== ccOf(uid)) fail("This event is in another country.");
      const n = db.eventAttendees.filter((x) => x.event_id === e.id).length;
      if (db.eventAttendees.some(mine)) return;
      if (e.max_people && n >= e.max_people) fail("This event is full.");
      db.eventAttendees.push({ event_id: e.id, user_id: uid, created_at: now() }); notify(e.organizer_id, uid, "meetup_join", { event_id: e.id }); save();
    },
    async commentEvent(id, body) {
      active(); const e = db.events.find((x) => x.id === Number(id));
      if (!e || !canSeeEvent(e)) fail("Event not found.");
      body = String(body || "").trim(); if (!body) fail("Write something first.");
      db.eventComments.push({ id: ++db.seq, event_id: e.id, user_id: uid, body: body.slice(0, 600), created_at: now() });
      new Set([e.organizer_id, ...db.eventAttendees.filter((x) => x.event_id === e.id).map((x) => x.user_id)]).forEach((u) => notify(u, uid, "meetup_comment", { event_id: e.id }, body)); save();
    },
    async deleteEventComment(id) {
      const c = db.eventComments.find((x) => x.id === Number(id)); if (!c) return;
      const e = db.events.find((x) => x.id === c.event_id);
      if (c.user_id !== me() && e?.organizer_id !== uid && !isAdmin()) fail("You can only remove your own comments.");
      db.eventComments = db.eventComments.filter((x) => x !== c); save();
    },
    async setEventHidden(id, hidden) { adminOnly(); const e = db.events.find((x) => x.id === Number(id)); if (e) { e.is_hidden = !!hidden; save(); } },

    // ---- Community: friends (migration 023) ----
    async listFriendships() {
      me();
      return db.friendships.filter((f) => [f.user_a, f.user_b].includes(uid)).map((f) => {
        const o = f.user_a === uid ? f.user_b : f.user_a;
        return { other: lite(o), other_id: o, status: f.status === "accepted" ? "friends" : f.requested_by === uid ? "sent" : "received", since: f.accepted_at || f.created_at };
      }).filter((r) => r.other);
    },
    async friendStatus(userId) {
      me(); if (userId === uid) return "me";
      const f = friendRow(userId);
      return !f ? "none" : f.status === "accepted" ? "friends" : f.requested_by === uid ? "sent" : "received";
    },
    async sendFriendRequest(userId) {
      active(); await tick();
      if (userId === uid) fail("You cannot add yourself.");
      const o = prof(userId); if (!o || o.is_banned) fail("Member not found.");
      if (blockedWith(userId)) fail("You cannot add this member.");
      const f = friendRow(userId);
      if (f) {
        if (f.status === "accepted") return "friends";
        if (f.requested_by === uid) return "sent";
        f.status = "accepted"; f.accepted_at = now(); notify(userId, uid, "friend_accept"); save(); return "friends";
      }
      if (db.friendships.filter((x) => x.requested_by === uid && x.created_at > new Date(Date.now() - 864e5).toISOString()).length >= 40) fail("That's a lot of friend requests today. Please try again tomorrow.");
      const [a, b] = uid < userId ? [uid, userId] : [userId, uid];
      db.friendships.push({ user_a: a, user_b: b, requested_by: uid, status: "pending", created_at: now(), accepted_at: null }); notify(userId, uid, "friend_request"); save(); return "sent";
    },
    async respondFriendRequest(userId, accept) {
      me(); const f = friendRow(userId);
      if (!f || f.status !== "pending" || f.requested_by !== userId) { if (accept) fail("That request is no longer open."); return; }
      if (accept) { active(); f.status = "accepted"; f.accepted_at = now(); notify(userId, uid, "friend_accept"); } else db.friendships = db.friendships.filter((x) => x !== f);
      save();
    },
    async removeFriend(userId) { me(); const f = friendRow(userId); if (f) { db.friendships = db.friendships.filter((x) => x !== f); save(); } },

    // ---- Community: posts ----
    async listPosts({ scope = "discover", authorId, groupId, limit = 40 } = {}) {
      me(); await tick(); groupsReady();
      if (groupId) return db.posts.filter((p) => p.group_id === Number(groupId) && canSeePost(p) && !prof(p.author_id)?.is_banned)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit).map(withPost);
      const fr = new Set(db.friendships.filter((f) => f.status === "accepted" && [f.user_a, f.user_b].includes(uid)).map((f) => (f.user_a === uid ? f.user_b : f.user_a)));
      return db.posts.filter((p) => canSeePost(p) && !prof(p.author_id)?.is_banned
          && (authorId ? p.author_id === authorId : !p.group_id && (scope === "feed" ? (p.author_id === uid || fr.has(p.author_id)) : p.country_code === ccOf(uid))))
        .sort((a, b) => (!authorId && scope !== "feed" ? (!!b.is_pinned - !!a.is_pinned) : 0) || b.created_at.localeCompare(a.created_at)).slice(0, limit).map(withPost);
    },
    async getPost(id) {
      me(); const p = db.posts.find((x) => x.id === Number(id));
      if (!p || !canSeePost(p)) return null;
      const comments = db.postComments.filter((c) => c.post_id === p.id && !blockedWith(c.user_id)).sort((a, b) => a.created_at.localeCompare(b.created_at)).map((c) => ({ ...clone(c), user: lite(c.user_id) }));
      return { ...withPost(p), comments, comment_count: comments.length };
    },
    async createPost({ kind, body, perfumeId, photoFile, photoFiles = [], groupId = null, poll = null }) {
      active(); await tick(); groupsReady();
      if (groupId && !db.groupMembers.some((m) => m.group_id === Number(groupId) && m.user_id === uid)) fail("Join the group to post in it.");
      body = String(body || "").trim(); if (!body) fail("Write something first.");
      if (!["sotd", "discovery", "haul", "question", "thoughts"].includes(kind)) fail("Pick what kind of post this is.");
      if (perfumeId && !perf(Number(perfumeId))) fail("Pick a perfume from the catalog.");
      if (db.posts.filter((p) => p.author_id === uid && p.created_at > new Date(Date.now() - 864e5).toISOString()).length >= 20) fail("You've posted a lot today. Please come back tomorrow.");
      const files = [photoFile, ...photoFiles].filter(Boolean).slice(0, 4), urls = [];
      for (const f of files) urls.push((await Util.resizeImage(f, 700, 0.78)).dataUrl);
      const photo_url = urls[0] || null;
      const opts = poll ? poll.map((o) => String(o || "").trim().slice(0, 80)).filter(Boolean) : null;
      if (poll && (opts.length < 2 || opts.length > 4)) fail("A poll needs 2 to 4 options.");
      const p = { id: ++db.seq, author_id: uid, country_code: ccOf(uid), kind, body: body.slice(0, 1000), perfume_id: perfumeId ? Number(perfumeId) : null, photo_url, photos: urls.slice(1), poll: opts && opts.length ? opts : null,
        is_hidden: false, is_pinned: false, edited_at: null, group_id: groupId ? Number(groupId) : null, created_at: now() };
      db.posts.push(p); if (photo_url && p.perfume_id) keepPhoto(p.perfume_id, uid, photo_url, "post"); demoMentions(p, body); save(); return p.id;
    },
    async editPost(id, body) {
      const p = db.posts.find((x) => x.id === Number(id) && x.author_id === me()) || fail("You can only edit your own posts.");
      body = String(body || "").trim(); if (!body) fail("Write something first.");
      p.body = body.slice(0, 1000); p.edited_at = now(); save();
    },
    async pinPost(id, on) { adminOnly(); const p = db.posts.find((x) => x.id === Number(id)); if (p) { p.is_pinned = !!on; save(); } },
    async votePoll(id, choice) {
      active(); const p = db.posts.find((x) => x.id === Number(id));
      if (!p || !canSeePost(p)) fail("Post not found.");
      if (!p.poll || !(choice >= 0 && choice < p.poll.length)) fail("That isn't an option.");
      db.pollVotes = (db.pollVotes || []).filter((v) => !(v.post_id === p.id && v.user_id === uid));
      db.pollVotes.push({ post_id: p.id, user_id: uid, choice: Number(choice), created_at: now() }); save();
    },
    async savePost(id, on) {
      me(); db.savedPosts = (db.savedPosts || []).filter((s) => !(s.user_id === uid && s.post_id === Number(id)));
      if (on) db.savedPosts.push({ user_id: uid, post_id: Number(id), created_at: now() }); save();
    },
    async listSavedPosts() {
      me(); return (db.savedPosts || []).filter((s) => s.user_id === uid).sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((s) => db.posts.find((p) => p.id === s.post_id)).filter((p) => p && canSeePost(p)).map(withPost);
    },
    async searchPeople(q) {
      me(); const t = String(q || "").trim().toLowerCase(); if (t.length < 2) return [];
      return db.profiles.filter((p) => p.id !== uid && !p.is_banned && p.adult_confirmed_at && !blockedWith(p.id) && String(p.display_name || "").toLowerCase().includes(t)).slice(0, 20).map((p) => lite(p.id));
    },
    async searchPosts(q) {
      me(); const t = String(q || "").trim().toLowerCase(); if (t.length < 2) return [];
      return db.posts.filter((p) => canSeePost(p) && !prof(p.author_id)?.is_banned && p.body.toLowerCase().includes(t)).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 30).map(withPost);
    },
    async deletePost(id) {
      const p = db.posts.find((x) => x.id === Number(id)); if (!p) return;
      if (p.author_id !== me() && !isAdmin()) fail("You can only delete your own posts.");
      db.posts = db.posts.filter((x) => x !== p);
      db.postLikes = db.postLikes.filter((x) => x.post_id !== p.id); db.postComments = db.postComments.filter((x) => x.post_id !== p.id); save();
    },
    async likePost(id, on) {
      active(); const p = db.posts.find((x) => x.id === Number(id));
      if (!p || !canSeePost(p)) fail("Post not found.");
      const mine = (x) => x.post_id === p.id && x.user_id === uid;
      if (on) { if (!db.postLikes.some(mine)) { db.postLikes.push({ post_id: p.id, user_id: uid, created_at: now() }); notify(p.author_id, uid, "like", { post_id: p.id }); } }
      else db.postLikes = db.postLikes.filter((x) => !mine(x));
      save();
    },
    async commentPost(id, body, parentId = null) {
      active(); const p = db.posts.find((x) => x.id === Number(id));
      if (!p || !canSeePost(p)) fail("Post not found.");
      body = String(body || "").trim(); if (!body) fail("Write something first.");
      let parent = parentId ? db.postComments.find((c) => c.id === Number(parentId) && c.post_id === p.id) : null;
      if (parentId && !parent) fail("That comment is gone.");
      if (parent?.parent_id) parent = db.postComments.find((c) => c.id === parent.parent_id) || parent;
      const before = new Set(db.postComments.filter((c) => c.post_id === p.id).map((c) => c.user_id));
      db.postComments.push({ id: ++db.seq, post_id: p.id, user_id: uid, body: body.slice(0, 600), parent_id: parent ? parent.id : null, created_at: now() });
      const pa = parent?.user_id || null;
      if (pa) notify(pa, uid, "reply", { post_id: p.id }, body);
      if (p.author_id !== pa) notify(p.author_id, uid, "comment", { post_id: p.id }, body);
      before.forEach((u) => { if (u !== p.author_id && u !== pa) notify(u, uid, "also_commented", { post_id: p.id }, body); });
      demoMentions(p, body); save();
    },
    async deletePostComment(id) {
      const c = db.postComments.find((x) => x.id === Number(id)); if (!c) return;
      const p = db.posts.find((x) => x.id === c.post_id);
      if (c.user_id !== me() && p?.author_id !== uid && !isAdmin()) fail("You can only remove your own comments.");
      db.postComments = db.postComments.filter((x) => x !== c); save();
    },
    async setPostHidden(id, hidden) { adminOnly(); const p = db.posts.find((x) => x.id === Number(id)); if (p) { p.is_hidden = !!hidden; save(); } },
    async trendingWishes() {
      me();
      const cut = new Date(Date.now() - 30 * 864e5).toISOString(), counts = new Map();
      db.wishes.filter((w) => (w.created_at || now()) > cut && ccOf(w.user_id) === ccOf(uid) && !prof(w.user_id)?.is_banned)
        .forEach((w) => counts.set(w.perfume_id, (counts.get(w.perfume_id) || 0) + 1));
      return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([pid, n]) => ({ perfume: clone(perf(pid)), wanted: n })).filter((r) => r.perfume);
    },

    // Demo-only helpers (the "Demo tools" panel)
    demoUsers: () => db.profiles.map((p) => ({ id: p.id, display_name: p.display_name, email: db.users.find((u) => u.id === p.id)?.email, is_admin: p.is_admin })),
    demoSwitchUser: (id) => setUid(id),
    demoReset: () => { db = freshDb(); save(); setUid(null); },
    demoWasRefreshed: () => { const r = api_refreshed; api_refreshed = false; return r; }
  };
  window.DemoApi = api;
})();
