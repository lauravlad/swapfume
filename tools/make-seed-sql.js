// Builds the database files from the hand-written catalog (js/catalog-seed.js + js/catalog/*.js):
//   supabase/seed.sql                                   fresh installs (run after migrations 001–008)
//   notes block in supabase/migrations/005_notes_and_images.sql   (starter list only)
//   catalog block in supabase/migrations/006, 007 and 008 (existing installs)
// It also checks every row and prints counts per category.
// Run from the perfume-swap folder:  node tools/make-seed-sql.js
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const window = {};
const load = (f) => new Function('window', fs.readFileSync(path.join(root, f), 'utf8'))(window);
load('js/util.js');
load('js/catalog-seed.js');
const EXTRA = ['js/catalog/classics.js', 'js/catalog/designer.js', 'js/catalog/niche.js', 'js/catalog/middle-eastern.js', 'js/catalog/asian.js',
  'js/catalog/more-designer.js', 'js/catalog/more-niche.js', 'js/catalog/more-mass-me.js', 'js/catalog/perfumers.js'];
EXTRA.forEach(load);
const U = window.Util;

// ---- check rows, drop duplicates ----
const problems = [];
const seen = new Map();
const dupes = [];
const rows = [];
window.CATALOG_SEED.forEach((r, i) => {
  const where = `${r[0]} ${r[1]} (${r[2]})`;
  if (r.length !== 8) problems.push(`${where}: expected 8 fields, got ${r.length}`);
  if (r[4] != null && !window.SCENT_FAMILIES.includes(r[4])) problems.push(`${where}: unknown family "${r[4]}"`);
  if (r[4] != null && !(r[5] || r[6] || r[7])) problems.push(`${where}: no notes`);
  if (!String(r[0] || '').trim() || !String(r[1] || '').trim()) problems.push(`${where}: brand and name are required`);
  if (r[3] != null && (r[3] < 1700 || r[3] > 2026)) problems.push(`${where}: odd year ${r[3]}`);
  const key = U.perfumeKey(r[0], r[1], r[2]);
  if (seen.has(key)) { dupes.push(`${where}`); return; }
  seen.set(key, i);
  rows.push({ row: r, original: i < window.CATALOG_ORIGINAL_COUNT });
});
if (problems.length) console.log('Problems:\n  ' + problems.join('\n  '));
if (dupes.length) console.log(`Skipped ${dupes.length} duplicate rows (already listed elsewhere).`);

const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const arr = (s) => {
  const items = String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
  return items.length ? `array[${items.map(q).join(', ')}]::text[]` : `'{}'::text[]`;
};
const isClassic = (r) => r[3] != null && r[3] < 2000;
const values = rows.map(({ row: [b, n, c, y, fam, top, heart, base] }) =>
  `  (${q(b)}, ${q(n)}, ${q(c || '')}, ${y == null ? 'null' : y}, 'approved', ${isClassic([b, n, c, y]) ? 'true' : 'false'}, ${fam ? q(fam) : 'null'}, ${arr(top)}, ${arr(heart)}, ${arr(base)})`);
const insertSql = `insert into public.perfumes (brand, name, concentration, year, status, is_classic, family, notes_top, notes_heart, notes_base) values
${values.join(',\n')}
on conflict (norm_key) where status <> 'rejected' do nothing;`;

// ---- perfumers (applied by brand + name to every concentration) ----
const PF = window.CATALOG_PERFUMERS || {};
const usedPF = new Set();
const pfRows = rows.filter(({ row }) => PF[row[0] + '|' + row[1]]).map(({ row: [b, n, c] }) => { usedPF.add(b + '|' + n); return `    (${q(b)}, ${q(n)}, ${q(c || '')}, ${arr(PF[b + '|' + n].join(', '))})`; });
const unusedPF = Object.keys(PF).filter((k) => !usedPF.has(k));
if (unusedPF.length) console.log('Perfumer entries with no matching catalog row:\n  ' + unusedPF.join('\n  '));
const perfumersSql = `-- Only fills perfumes that have no perfumer yet, so admin edits are never overwritten.
update public.perfumes p set perfumers = v.perfumers
  from (values
${pfRows.join(',\n')}
  ) as v(brand, name, concentration, perfumers)
 where p.norm_key = public.norm_text(v.brand) || '|' || public.norm_text(v.name) || '|' || public.norm_text(v.concentration)
   and cardinality(p.perfumers) = 0;`;

// ---- seed.sql ----
fs.writeFileSync(path.join(root, 'supabase', 'seed.sql'),
`-- Perfume catalog (${rows.length} perfumes), generated from js/catalog-seed.js and js/catalog/*.js by tools/make-seed-sql.js.
-- Written by hand for this app; not copied from any website's database.
-- Fresh install: run AFTER migrations 001–009. Safe to run more than once (duplicates are skipped).
${insertSql}

${perfumersSql}
`);

// ---- 005 notes block (starter list only) ----
const upd = rows.filter((x) => x.original).map(({ row: [b, n, c, , fam, top, heart, base] }) =>
  `    (${q(b)}, ${q(n)}, ${q(c || '')}, ${q(fam)}, ${arr(top)}, ${arr(heart)}, ${arr(base)})`);
const notesBlock = `-- BEGIN GENERATED NOTES
-- Only fills perfumes that have no family yet, so admin edits are never overwritten.
update public.perfumes p
   set family = v.family, notes_top = v.top, notes_heart = v.heart, notes_base = v.base
  from (values
${upd.join(',\n')}
  ) as v(brand, name, concentration, family, top, heart, base)
 where p.norm_key = public.norm_text(v.brand) || '|' || public.norm_text(v.name) || '|' || public.norm_text(v.concentration)
   and p.family is null;
-- END GENERATED NOTES`;
const m5 = path.join(root, 'supabase', 'migrations', '005_notes_and_images.sql');
fs.writeFileSync(m5, fs.readFileSync(m5, 'utf8').replace(/-- BEGIN GENERATED NOTES[\s\S]*-- END GENERATED NOTES/, notesBlock));

// ---- 006 catalog block ----
const classics = rows.filter((x) => isClassic(x.row)).map(({ row: [b, n, c] }) => `    (${q(b)}, ${q(n)}, ${q(c || '')})`);
const catBlock = `-- BEGIN GENERATED CATALOG
-- a) Mark the classics that are already in the catalog.
update public.perfumes p set is_classic = true
  from (values
${classics.join(',\n')}
  ) as v(brand, name, concentration)
 where p.norm_key = public.norm_text(v.brand) || '|' || public.norm_text(v.name) || '|' || public.norm_text(v.concentration);

-- b) Remove pre-2000 starter perfumes that are not classics, if nobody uses them.
delete from public.perfumes p
 where p.year < 2000 and not p.is_classic and p.requested_by is null and p.status = 'approved'
   and not exists (select 1 from public.collection_items x where x.perfume_id = p.id)
   and not exists (select 1 from public.wishlist_items x where x.perfume_id = p.id)
   and not exists (select 1 from public.swap_items x where x.perfume_id = p.id)
   and not exists (select 1 from public.note_suggestions x where x.perfume_id = p.id);

-- c) The perfumes themselves are added by migration 009 (or supabase/live-update/).
-- END GENERATED CATALOG`;
const m6 = path.join(root, 'supabase', 'migrations', '006_catalog_expansion.sql');
fs.writeFileSync(m6, fs.readFileSync(m6, 'utf8').replace(/-- BEGIN GENERATED CATALOG[\s\S]*-- END GENERATED CATALOG/, catBlock));

// ---- 007 block: fill known years, add anything missing ----
const known = rows.filter((x) => x.row[3] != null).map(({ row: [b, n, c, y] }) => `    (${q(b)}, ${q(n)}, ${q(c || '')}, ${y})`);
const block7 = `-- BEGIN GENERATED CATALOG
-- a) Fill in release years the catalog file knows, only where the database has none.
update public.perfumes p set year = v.year, is_classic = (v.year < 2000)
  from (values
${known.join(',\n')}
  ) as v(brand, name, concentration, year)
 where p.norm_key = public.norm_text(v.brand) || '|' || public.norm_text(v.name) || '|' || public.norm_text(v.concentration)
   and p.year is null;

-- b) New perfumes are added by migration 009 (or supabase/live-update/).
-- END GENERATED CATALOG`;
const m7 = path.join(root, 'supabase', 'migrations', '007_middle_east_more.sql');
fs.writeFileSync(m7, fs.readFileSync(m7, 'utf8').replace(/-- BEGIN GENERATED CATALOG[\s\S]*-- END GENERATED CATALOG/, block7));

// ---- 008 block: add anything missing ----
const block8 = `-- BEGIN GENERATED CATALOG
-- The new perfumes are added by migration 009 (or supabase/live-update/).
-- END GENERATED CATALOG`;
const m8 = path.join(root, 'supabase', 'migrations', '008_launch.sql');
fs.writeFileSync(m8, fs.readFileSync(m8, 'utf8').replace(/-- BEGIN GENERATED CATALOG[\s\S]*-- END GENERATED CATALOG/, block8));

// ---- 009 blocks: add anything missing + perfumers ----
const m9 = path.join(root, 'supabase', 'migrations', '009_perfumers_reviews.sql');
fs.writeFileSync(m9, fs.readFileSync(m9, 'utf8')
  .replace(/-- BEGIN GENERATED CATALOG[\s\S]*-- END GENERATED CATALOG/, `-- BEGIN GENERATED CATALOG\n-- Add every catalog perfume that isn't there yet (${rows.length} in the full list; duplicates skipped).\n${insertSql}\n-- END GENERATED CATALOG`)
  .replace(/-- BEGIN GENERATED PERFUMERS[\s\S]*-- END GENERATED PERFUMERS/, `-- BEGIN GENERATED PERFUMERS\n${perfumersSql}\n-- END GENERATED PERFUMERS`));

// ---- supabase/live-update/: everything from 005 on, in pieces small enough for the SQL editor ----
const LIMIT = 110 * 1024;
const liveDir = path.join(root, 'supabase', 'live-update');
fs.mkdirSync(liveDir, { recursive: true });
fs.readdirSync(liveDir).filter((f) => f.endsWith('.sql')).forEach((f) => fs.unlinkSync(path.join(liveDir, f)));
const mig = (f) => fs.readFileSync(path.join(root, 'supabase', 'migrations', f), 'utf8');
const stripGen = (sql) => sql.replace(/-- BEGIN GENERATED (CATALOG|PERFUMERS)[\s\S]*?-- END GENERATED \1/g, '-- (catalog data: see the numbered catalog files in this folder)');
const parts = [];
const head = (title, note) => `-- Swapfume live update — ${title}\n-- ${note}\n-- Safe to run more than once. Run the files in this folder in number order.\n\n`;
parts.push(['notes_and_images', head('005 scent notes, pictures, note corrections', 'Same as supabase/migrations/005_notes_and_images.sql.') + mig('005_notes_and_images.sql')]);
parts.push(['catalog_rules', head('006 classics + transliteration-aware duplicate check', 'Same as supabase/migrations/006_catalog_expansion.sql.') + mig('006_catalog_expansion.sql')]);
parts.push(['admin_year', head('007 admins can edit release years', 'Same as supabase/migrations/007_middle_east_more.sql.') + mig('007_middle_east_more.sql')]);
parts.push(['launch', head('008 18+ check, blocking, delete account', 'Same as supabase/migrations/008_launch.sql.') + mig('008_launch.sql')]);
parts.push(['perfumers_reviews', head('009 perfumers, perfume reviews, CSV import (schema only)', 'Same as supabase/migrations/009_perfumers_reviews.sql without its catalog data.') + stripGen(mig('009_perfumers_reviews.sql'))]);
// catalog rows, chunked
const chunkBy = (lines, budget) => { const out = []; let cur = [], size = 0; lines.forEach((l) => { if (size + l.length > budget && cur.length) { out.push(cur); cur = []; size = 0; } cur.push(l); size += l.length + 2; }); if (cur.length) out.push(cur); return out; };
const catChunks = chunkBy(values, LIMIT - 2000);
catChunks.forEach((c, k) => parts.push([`catalog_${k + 1}_of_${catChunks.length}`, head(`catalog part ${k + 1} of ${catChunks.length}`, 'Adds catalog perfumes that are not there yet; existing ones (and spelling variants) are skipped.') +
  `insert into public.perfumes (brand, name, concentration, year, status, is_classic, family, notes_top, notes_heart, notes_base) values\n${c.join(',\n')}\non conflict (norm_key) where status <> 'rejected' do nothing;\n`]));
const pfc = chunkBy(pfRows, LIMIT - 2000);
pfc.forEach((c, k) => parts.push([`perfumers_${k + 1}_of_${pfc.length}`, head(`perfumer names part ${k + 1} of ${pfc.length}`, 'Fills in perfumers only where a perfume has none yet.') +
  `update public.perfumes p set perfumers = v.perfumers\n  from (values\n${c.join(',\n')}\n  ) as v(brand, name, concentration, perfumers)\n where p.norm_key = public.norm_text(v.brand) || '|' || public.norm_text(v.name) || '|' || public.norm_text(v.concentration)\n   and cardinality(p.perfumers) = 0;\n`]));
// Migrations added after the first live setup go last, so earlier file numbers never change.
parts.push(['photo_suggestions', head('010 members suggest catalog photos; profile photos', 'Same as supabase/migrations/010_photo_suggestions.sql.') + mig('010_photo_suggestions.sql')]);
parts.push(['location_meetups', head('011 ZIP-code location, distances, meeting in person', 'Same as supabase/migrations/011_location_meetups.sql.') + mig('011_location_meetups.sql')]);
parts.push(['area_map', head('012 general-area map on profiles', 'Same as supabase/migrations/012_area_map.sql.') + mig('012_area_map.sql')]);
parts.push(['gifts', head('013 gifts: give perfume with nothing asked back', 'Same as supabase/migrations/013_gifts.sql.') + mig('013_gifts.sql')]);
parts.push(['forget_birthdate', head('014 do not keep dates of birth', 'Same as supabase/migrations/014_forget_birthdate.sql.') + mig('014_forget_birthdate.sql')]);
parts.push(['duplicates', head('015 catch duplicate perfumes; admins can merge them', 'Same as supabase/migrations/015_duplicates.sql.') + mig('015_duplicates.sql')]);
const liveList = parts.map(([name, sql], k) => {
  const file = `${String(k + 1).padStart(2, '0')}_${name}.sql`;
  fs.writeFileSync(path.join(liveDir, file), sql);
  const kb = Buffer.byteLength(sql) / 1024;
  if (kb > 120) console.log(`WARNING: ${file} is ${kb.toFixed(0)} KB`);
  return `${file} (${kb.toFixed(0)} KB)`;
});
console.log('Live update files:\n  ' + liveList.join('\n  '));

// ---- counts per category ----
const ME = new Set(['Lattafa', 'Asdaaf', 'Rasasi', 'Ajmal', 'Arabian Oud', 'Swiss Arabian', 'Armaf', 'Afnan', 'Al Haramain', 'Amouage', 'Maison Alhambra', 'Khadlaj', 'French Avenue', 'Fragrance World', 'Al Rehab', 'Nishane', 'Initio']);
const NICHE = new Set(['Le Labo', 'Byredo', 'Maison Francis Kurkdjian', 'Maison Margiela', 'Diptyque', 'Creed', 'Parfums de Marly', 'Jo Malone London', 'Kilian', 'Frédéric Malle', 'Serge Lutens', "L'Artisan Parfumeur", 'Juliette Has A Gun', 'Escentric Molecules', 'Comme des Garçons', "Penhaligon's", 'Atelier Cologne', 'Acqua di Parma', 'Imaginary Authors', 'Zoologist', 'D.S. & Durga', 'Maison Crivelli', 'Mancera', 'Montale', 'Xerjoff', 'Sospiro', 'Ormonde Jayne', 'BDK Parfums', 'Essential Parfums', 'Goldfield & Banks', 'Matiere Premiere', 'Vilhelm Parfumerie', 'Eris Parfums', 'Floraiku', 'Maison Louis Marie', 'Henry Rose', 'Ellis Brooklyn', 'Commodity', 'Phlur', 'Memo Paris', 'Nasomatto', 'Tiziana Terenzi', 'Ex Nihilo', 'Roja Parfums', "Etat Libre d'Orange", 'Goutal', 'Floris', 'Armani Privé', 'Louis Vuitton']);
const ASIAN = new Set(['Shiseido', 'Shiro', 'Issey Miyake', 'Kenzo']);
const MASS = new Set(['Ariana Grande', 'Sol de Janeiro', 'Bath & Body Works', "Victoria's Secret", 'Britney Spears', 'Zara', 'Demeter', 'Philosophy', 'Elizabeth and James', 'Pacifica', 'The Body Shop', 'Glossier', 'Kayali', 'Jennifer Lopez', 'Billie Eilish', 'Clean Reserve', 'Snif', 'Tocca']);
const cat = (r) => isClassic(r) ? 'Classics (pre-2000, still sold)' : ME.has(r[0]) ? 'Middle Eastern & related' : ASIAN.has(r[0]) ? 'Asian houses & Japan-born designers' : NICHE.has(r[0]) ? 'Niche' : MASS.has(r[0]) ? 'Mass-market, celebrity & indie' : 'Designer';
const counts = {};
rows.forEach(({ row }) => { counts[cat(row)] = (counts[cat(row)] || 0) + 1; });
console.log('Catalog:', rows.length, 'perfumes');
Object.entries(counts).forEach(([k, v]) => console.log('  ' + k.padEnd(34), v));
console.log('Brands:', new Set(rows.map((x) => x.row[0])).size, '· year unknown:', rows.filter((x) => x.row[3] == null).length,
  '· with notes:', rows.filter((x) => x.row[5] || x.row[6] || x.row[7]).length, '· with perfumer:', pfRows.length);
const me = {};
rows.forEach(({ row }) => { if (ME.has(row[0])) me[row[0]] = (me[row[0]] || 0) + 1; });
console.log('Middle Eastern & related, per house:');
Object.entries(me).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log('  ' + k.padEnd(20), v));
