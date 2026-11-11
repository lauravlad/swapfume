/* Small helpers shared by the app and both data layers. */
(function () {
  // Mirror of public.norm_text() (supabase/migrations/006): lowercase, no accents, letters+digits only,
  // and common spelling variants count as the same: "Oudh"/"Aoud" = "Oud", "Misk" = "Musk",
  // "EDP" = "Eau de Parfum", "Attar"/"Perfume Oil" = "Perfume Oil / Attar".
  const WHOLE = { edp: "eaudeparfum", edt: "eaudetoilette", edc: "eaudecologne", cologne: "eaudecologne",
    extrait: "extraitdeparfum", parfumextrait: "extraitdeparfum", attar: "perfumeoilattar", ittar: "perfumeoilattar",
    itr: "perfumeoilattar", perfumeoil: "perfumeoilattar", oil: "perfumeoilattar", concentratedperfumeoil: "perfumeoilattar" };
  function normText(t) {
    const x = String(t || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/ø/g, "o").replace(/ł/g, "l").replace(/œ/g, "o").replace(/æ/g, "a")
      .replace(/\b(oudh|aoud|oude)\b/g, "oud")
      .replace(/\b(misk|mousk)\b/g, "musk")
      .replace(/[^a-z0-9]+/g, "");
    return WHOLE[x] || x;
  }
  function brandNameKey(brand, name) { return normText(brand) + "|" + normText(name); }
  function perfumeKey(brand, name, conc) { return brandNameKey(brand, name) + "|" + normText(conc); }

  // ---- Duplicate catching (mirrors supabase/migrations/015; the demo uses these, the live site asks the database) ----
  // Words kept apart, for fuzzy matching. "Musc" (French) = "Musk".
  function normWords(t) {
    return String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/ø/g, "o").replace(/ł/g, "l").replace(/œ/g, "o").replace(/æ/g, "a")
      .replace(/\b(oudh|aoud|oude)\b/g, "oud").replace(/\b(misk|mousk|musc)\b/g, "musk")
      .replace(/[^a-z0-9]+/g, " ").trim();
  }
  // Looser brand key: "Jo Malone" = "Jo Malone London", "Dolce and Gabbana" = "Dolce & Gabbana".
  function brandKey(t) {
    return normText(normWords(t).replace(/\b(and|the|parfums?|perfumes?|perfumery|paris|london|fragrances?|cosmetics)\b/g, " "));
  }
  const BRAND_ALIASES = [["YSL", "Yves Saint Laurent"], ["Saint Laurent", "Yves Saint Laurent"], ["Yves St Laurent", "Yves Saint Laurent"],
    ["Christian Dior", "Dior"], ["Dior Parfums", "Dior"], ["Armani", "Giorgio Armani"], ["MFK", "Maison Francis Kurkdjian"],
    ["Francis Kurkdjian", "Maison Francis Kurkdjian"], ["Kurkdjian", "Maison Francis Kurkdjian"], ["PDM", "Parfums de Marly"], ["De Marly", "Parfums de Marly"],
    ["JPG", "Jean Paul Gaultier"], ["Gaultier", "Jean Paul Gaultier"], ["Jean-Paul Gaultier", "Jean Paul Gaultier"], ["CK", "Calvin Klein"], ["CH", "Carolina Herrera"],
    ["D&G", "Dolce & Gabbana"], ["DG", "Dolce & Gabbana"], ["TF", "Tom Ford"], ["Bulgari", "Bvlgari"], ["By Kilian", "Kilian"], ["Kilian Paris", "Kilian"],
    ["Rabanne", "Paco Rabanne"], ["Thierry Mugler", "Mugler"], ["Annick Goutal", "Goutal"], ["Frederic Malle", "Frédéric Malle"],
    ["Editions de Parfums Frederic Malle", "Frédéric Malle"], ["Malle", "Frédéric Malle"], ["MMM", "Maison Margiela"], ["Margiela", "Maison Margiela"],
    ["Maison Martin Margiela", "Maison Margiela"], ["BDK", "BDK Parfums"], ["Bond No 9", "Bond No. 9"], ["Bond Number 9", "Bond No. 9"], ["Bond Number Nine", "Bond No. 9"],
    ["VS", "Victoria's Secret"], ["BBW", "Bath & Body Works"], ["A&F", "Abercrombie & Fitch"], ["Abercrombie", "Abercrombie & Fitch"],
    ["Van Cleef", "Van Cleef & Arpels"], ["DS Durga", "D.S. & Durga"], ["DS & Durga", "D.S. & Durga"], ["CDG", "Comme des Garçons"], ["LV", "Louis Vuitton"],
    ["Roja Dove", "Roja Parfums"], ["Roja", "Roja Parfums"], ["Initio Parfums Prives", "Initio"], ["Dsquared", "Dsquared2"], ["Nishane Istanbul", "Nishane"],
    ["Hermes", "Hermès"], ["Lancome", "Lancôme"], ["Estee Lauder", "Estée Lauder"], ["Chloe", "Chloé"], ["Penhaligons", "Penhaligon's"], ["Boss", "Hugo Boss"],
    ["Elizabeth & James", "Elizabeth and James"], ["Viktor and Rolf", "Viktor&Rolf"], ["Ralph Lauren Fragrances", "Ralph Lauren"]];
  const ALIAS = new Map(BRAND_ALIASES.map(([a, b]) => [brandKey(a), b]));
  function canonicalBrand(t, brands = []) {
    const k = brandKey(t), clean = String(t || "").trim().replace(/\s+/g, " ");
    if (!k) return clean;
    if (ALIAS.has(k)) return ALIAS.get(k);
    return brands.find((b) => brandKey(b) === k) || clean;
  }
  const CONC_END = /^(.*?)[\s,\-–—(]+(eau de parfum|eau de toilette|eau de cologne|extrait de parfum|parfum extrait|extrait|edp|edt|edc|perfume oil|attar)\)?\.?$/i;
  const CONC_NAME = { eaudeparfum: "Eau de Parfum", eaudetoilette: "Eau de Toilette", eaudecologne: "Eau de Cologne", extraitdeparfum: "Extrait de Parfum", perfumeoilattar: "Perfume Oil / Attar" };
  // "Sauvage EDP" → {name: "Sauvage", concentration: "Eau de Parfum"}; "Dior Sauvage" under Dior → "Sauvage".
  function tidyPerfumeName(brand, name) {
    let n = String(name || "").trim().replace(/\s+/g, " "), conc = "";
    const b = String(brand || "").trim().replace(/\s+/g, " ");
    const m = n.match(CONC_END);
    if (m && normText(m[1])) { n = m[1].trim(); conc = CONC_NAME[normText(m[2])] || ""; }
    if (b && n.toLowerCase().startsWith(b.toLowerCase() + " ") && normText(n.slice(b.length + 1))) n = n.slice(b.length + 1).trim();
    return { name: n, concentration: conc };
  }
  // pg_trgm's similarity(): shared 3-letter pieces of the padded words.
  function trigrams(s) {
    const set = new Set();
    for (const w of String(s).split(/[^a-z0-9]+/).filter(Boolean)) { const p = "  " + w + " "; for (let i = 0; i + 3 <= p.length; i++) set.add(p.slice(i, i + 3)); }
    return set;
  }
  function similarity(a, b) {
    const A = trigrams(a), B = trigrams(b); if (!A.size || !B.size) return 0;
    let n = 0; A.forEach((g) => { if (B.has(g)) n++; }); return n / (A.size + B.size - n);
  }
  // Best match of a's trigrams inside b (approximation of pg_trgm word_similarity).
  function wordSimilarity(a, b) {
    const A = trigrams(a); if (!A.size) return 0;
    const words = String(b).split(" ").filter(Boolean); let best = 0;
    for (let i = 0; i < words.length; i++) for (let j = i; j < words.length; j++) {
      const B = trigrams(words.slice(i, j + 1).join(" ")); let n = 0; A.forEach((g) => { if (B.has(g)) n++; }); best = Math.max(best, n / A.size);
    }
    return best;
  }
  // Same name apart from one misspelled word ("Bacarat Rouge 540"), not a flanker or a different number.
  function oneWordTypo(a, b) {
    const x = String(a).split(" "), y = String(b).split(" ");
    if (a === b || x.length !== y.length) return false;
    const d = x.map((w, i) => [w, y[i]]).filter(([p, q]) => p !== q);
    if (d.length !== 1) return false;
    const [p, q] = d[0], num = /^([0-9]+|[ivxl]+)$/;
    return p.length >= 4 && q.length >= 4 && !num.test(p) && !num.test(q) && similarity(p, q) >= 0.3;
  }

  // ---- "Paste your list": match free-typed lines to catalog perfumes ----
  // One line per perfume, any order: "YSL Libre EDP 10ml decant", "Santal 33 sample x2", "1. Aventus".
  const SIZE_WORDS = [["sample", /\b(samples?|vials?|minis?|testers?|carded)\b/i], ["decant", /\b(decants?|atomi[sz]ers?|travel ?sprays?|splits?)\b/i], ["full", /\b(full|bottles?|fb|flacons?)\b/i]];
  const CONC_WORDS = [["Eau de Parfum", /\b(edp|eau de parfum)\b/i], ["Eau de Toilette", /\b(edt|eau de toilette)\b/i], ["Eau de Cologne", /\b(edc|eau de cologne|cologne)\b/i],
    ["Extrait de Parfum", /\b(extrait( de parfum)?)\b/i], ["Parfum", /\bparfum\b/i]];
  function parseListLine(raw) {
    let t = String(raw || "").replace(/^\s*(?:[-–•*·]+|\d{1,3}[.)])\s*/, "").replace(/\s+/g, " ").trim();
    if (!t) return null;
    const out = { raw: String(raw).trim(), size: null, volume_ml: null, quantity: 1, concentration: null };
    const vol = t.match(/(\d+(?:[.,]\d+)?)\s*ml\b/i);
    if (vol) { out.volume_ml = Number(vol[1].replace(",", ".")); t = t.replace(vol[0], " "); }
    const q = t.match(/(?:^|\s)(?:x\s?(\d{1,2})|(\d{1,2})\s?x)(?=\s|$)/i);
    if (q) { out.quantity = Math.max(1, Math.min(99, Number(q[1] || q[2]))); t = t.replace(q[0], " "); }
    for (const [size, re] of SIZE_WORDS) if (re.test(t)) { out.size = out.size || size; t = t.replace(new RegExp(re.source, "gi"), " "); }
    for (const [c, re] of CONC_WORDS) if (re.test(t)) { out.concentration = out.concentration || c; t = t.replace(new RegExp(re.source, "gi"), " "); }
    // Brand nicknames ("YSL", "MFK", "PDM"…) become the full brand name.
    for (const [a, b] of BRAND_ALIASES) { const re = new RegExp("(^|\\s)" + a.replace(/[.*+?^${}()|[\]\\&]/g, "\\$&") + "(?=\\s|$)", "i"); if (re.test(t)) { t = t.replace(re, "$1" + b); break; } }
    out.text = t.replace(/[,;|]+/g, " ").replace(/\s+/g, " ").trim();
    return out.text ? out : null;
  }
  function catalogMatcher(perfumes) {
    const idx = perfumes.map((p) => {
      const key = normWords(p.brand + " " + p.name), name = normWords(p.name), brand = normWords(p.brand);
      return { p, key, name, brandWords: brand.split(" ").filter((w) => w.length > 1), kt: trigrams(key), nt: trigrams(name) };
    });
    const sim = (A, B) => { if (!A.size || !B.size) return 0; let n = 0; A.forEach((g) => { if (B.has(g)) n++; }); return n / (A.size + B.size - n); };
    const contained = (A, B) => { if (!A.size) return 0; let n = 0; A.forEach((g) => { if (B.has(g)) n++; }); return n / A.size; };
    return function match(line) {
      const L = normWords(line.text), LT = trigrams(L), words = new Set(L.split(" "));
      const scored = idx.map((e) => {
        const brandIn = e.brandWords.length && e.brandWords.every((w) => words.has(w));
        const nameIn = contained(e.nt, LT);                       // how much of the perfume's name appears in the line
        let score = Math.max(sim(LT, e.kt), nameIn * (brandIn ? 1 : 0.88) * (0.72 + 0.28 * sim(LT, e.nt)));
        const rank = score + (line.concentration && e.p.concentration === line.concentration ? 0.04 : 0) + (!line.concentration && e.p.concentration === "Eau de Parfum" ? 0.01 : 0);
        return { p: e.p, score: Math.min(1, score), rank };
      }).filter((x) => x.score >= 0.5).sort((a, b) => b.rank - a.rank || a.p.name.length - b.p.name.length);
      return scored.slice(0, 5);
    };
  }

  // Shrink a photo before saving it (keeps uploads small and fast).
  function resizeImage(file, maxSide = 900, quality = 0.82) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type)) return reject(new Error("Please choose an image file."));
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not read that file."));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("That image could not be opened."));
        img.onload = () => {
          const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", quality);
          canvas.toBlob((blob) => resolve({ blob, dataUrl }), "image/jpeg", quality);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // Countries Swapfume is open in (same list as the database, migration 016).
  // Swaps happen only inside one country: perfume can't be mailed across borders.
  const COUNTRIES = [
    { code: "US", name: "United States", the: "the United States", postal: "ZIP code", example: "10001", unit: "mi",
      file: "js/data/zips.csv", addr: "Street, apartment\nCity, State ZIP" },
    { code: "CA", name: "Canada", the: "Canada", postal: "postal code", example: "M5V 3L9", unit: "km",
      file: "js/data/postal-ca.csv", addr: "Street, unit\nCity, Province  Postal code" },
    { code: "RO", name: "Romania", the: "Romania", postal: "postal code", example: "010011", unit: "km",
      file: "js/data/postal-ro.csv", addr: "Strada, număr, bloc, apartament\nLocalitate, județ, cod poștal" }
  ];
  const country = (code) => COUNTRIES.find((c) => c.code === code) || COUNTRIES[0];
  const openCountriesText = () => COUNTRIES.map((c) => c.the).join(", ").replace(/, ([^,]*)$/, " and $1");

  // Postal code -> centre point. US: ZIP codes from the US Census 2024 Gazetteer (public domain).
  // Canada (first 3 characters, e.g. M5V) and Romania: GeoNames (geonames.org, CC BY 4.0).
  // Each list is loaded only the first time someone saves a code.
  const postalTables = {};
  function cleanPostal(code, cc) {
    const z = String(code || "").toUpperCase().replace(/\s+/g, "");
    if (cc === "CA") {
      if (!/^[A-Z]\d[A-Z](\d[A-Z]\d)?$/.test(z)) throw new Error("Please enter a Canadian postal code, like M5V 3L9.");
      return z.slice(0, 3);
    }
    if (cc === "RO") { if (!/^\d{6}$/.test(z)) throw new Error("Please enter a 6-digit Romanian postal code."); return z; }
    if (!/^\d{5}$/.test(z)) throw new Error("Please enter a 5-digit US ZIP code.");
    return z;
  }
  async function postalLookup(code, cc = "US") {
    const info = country(cc), zip = cleanPostal(code, info.code);
    if (!postalTables[info.code]) {
      const res = await fetch(info.file);
      if (!res.ok) throw new Error(`Couldn't load the ${info.postal} list. Please try again.`);
      const t = new Map();
      (await res.text()).split("\n").forEach((line) => {
        if (!line || line[0] === "#") return;
        const [z, lat, lon] = line.split(",");
        t.set(z, [Number(lat), Number(lon)]);
      });
      postalTables[info.code] = t;
    }
    const hit = postalTables[info.code].get(zip);
    if (!hit) throw new Error(`We couldn't find that ${info.postal}. Check it and try again.`);
    return { zip, lat: hit[0], lon: hit[1] };
  }
  const zipLookup = (zip) => postalLookup(zip, "US");
  // Great-circle distance in miles (demo mode; the real database does this itself).
  function milesBetween(a, b) {
    const r = (d) => (d * Math.PI) / 180;
    const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lon - a.lon) / 2) ** 2;
    return 3958.8 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  // Same rounding as member_distances(): nearest mile up to 20, nearest 5 up to 50, nothing beyond.
  const roundMiles = (d) => (d > 50 ? null : d <= 20 ? Math.max(1, Math.round(d)) : Math.round(d / 5) * 5);

  window.Util = { normText, brandNameKey, perfumeKey, normWords, brandKey, canonicalBrand, tidyPerfumeName, similarity, wordSimilarity, oneWordTypo, resizeImage, parseListLine, catalogMatcher, zipLookup, postalLookup, COUNTRIES, country, openCountriesText, milesBetween, roundMiles };
})();
