-- Swapfume live update — 005 scent notes, pictures, note corrections
-- Same as supabase/migrations/005_notes_and_images.sql.
-- Safe to run more than once. Run the files in this folder in number order.

-- =====================================================================
-- Swapfume — 005: scent notes, scent family, catalog pictures, note corrections
--
-- Safe to run on a database that already has 001–004 and seed.sql:
--   * it only ADDS columns/tables/functions
--   * it fills in notes for catalog perfumes that don't have any yet
--     (perfumes an admin already edited are left alone), so running it twice is harmless.
--
-- Pictures: we never copy brand or shop product photos. The app draws an
-- illustrated bottle by default, can show the newest member photo of that
-- perfume, and an admin can set a catalog photo they have the rights to use
-- (image_url + image_credit).
-- =====================================================================

-- 1. New catalog columns ----------------------------------------------------
alter table public.perfumes
  add column if not exists family       text,
  add column if not exists notes_top    text[] not null default '{}',
  add column if not exists notes_heart  text[] not null default '{}',
  add column if not exists notes_base   text[] not null default '{}',
  add column if not exists image_url    text,
  add column if not exists image_credit text;

do $$ begin
  alter table public.perfumes add constraint perfumes_family_check check (family is null or family in
    ('floral','woody','amber','citrus','fresh','aquatic','green','fruity','gourmand','musky','leather','aromatic','chypre','fougère'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.perfumes add constraint perfumes_notes_size_check check
    (cardinality(notes_top) <= 15 and cardinality(notes_heart) <= 15 and cardinality(notes_base) <= 15);
exception when duplicate_object then null; end $$;

-- 2. Members can suggest note corrections; admins approve or reject ------------
create table if not exists public.note_suggestions (
  id            bigint generated always as identity primary key,
  perfume_id    bigint not null references public.perfumes(id) on delete cascade,
  suggested_by  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  family        text check (family is null or family in
                  ('floral','woody','amber','citrus','fresh','aquatic','green','fruity','gourmand','musky','leather','aromatic','chypre','fougère')),
  notes_top     text[] not null default '{}',
  notes_heart   text[] not null default '{}',
  notes_base    text[] not null default '{}',
  comment       text not null default '' check (char_length(comment) <= 500),
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at    timestamptz not null default now(),
  check (cardinality(notes_top) <= 15 and cardinality(notes_heart) <= 15 and cardinality(notes_base) <= 15)
);
create index if not exists note_suggestions_status_idx on public.note_suggestions (status);

alter table public.note_suggestions enable row level security;
revoke all on public.note_suggestions from anon;

drop policy if exists "suggest note corrections" on public.note_suggestions;
create policy "suggest note corrections" on public.note_suggestions
  for insert to authenticated
  with check (suggested_by = auth.uid() and status = 'pending' and public.is_active_member());

drop policy if exists "read own suggestions or admin" on public.note_suggestions;
create policy "read own suggestions or admin" on public.note_suggestions
  for select to authenticated using (suggested_by = auth.uid() or public.is_admin());

-- 3. Admin actions -------------------------------------------------------------
create or replace function public.admin_review_note_suggestion(p_id bigint, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare s public.note_suggestions;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  select * into s from public.note_suggestions where id = p_id and status = 'pending' for update;
  if not found then return; end if;
  if p_approve then
    update public.perfumes
       set family = coalesce(s.family, family),
           notes_top = s.notes_top, notes_heart = s.notes_heart, notes_base = s.notes_base
     where id = s.perfume_id;
  end if;
  update public.note_suggestions set status = case when p_approve then 'approved' else 'rejected' end where id = p_id;
end;
$$;

-- Set (or clear, with p_url = null) the catalog picture. Only for photos the admin has rights to use.
create or replace function public.admin_set_perfume_image(p_perfume bigint, p_url text, p_credit text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  update public.perfumes
     set image_url = nullif(trim(coalesce(p_url, '')), ''),
         image_credit = case when nullif(trim(coalesce(p_url, '')), '') is null then null else left(coalesce(p_credit, ''), 200) end
   where id = p_perfume;
end;
$$;

revoke execute on function public.admin_review_note_suggestion(bigint, boolean) from public, anon;
revoke execute on function public.admin_set_perfume_image(bigint, text, text) from public, anon;
grant execute on function public.admin_review_note_suggestion(bigint, boolean) to authenticated;
grant execute on function public.admin_set_perfume_image(bigint, text, text) to authenticated;

-- 4. Notes for the starter catalog (generated from js/catalog-seed.js) -----------
-- BEGIN GENERATED NOTES
-- Only fills perfumes that have no family yet, so admin edits are never overwritten.
update public.perfumes p
   set family = v.family, notes_top = v.top, notes_heart = v.heart, notes_base = v.base
  from (values
    ('Chanel', 'No. 5', 'Eau de Parfum', 'floral', array['aldehydes', 'neroli', 'bergamot']::text[], array['rose', 'jasmine', 'iris', 'ylang-ylang']::text[], array['sandalwood', 'vanilla', 'vetiver']::text[]),
    ('Chanel', 'No. 5 L''Eau', 'Eau de Toilette', 'floral', array['lemon', 'orange', 'aldehydes']::text[], array['rose', 'jasmine', 'ylang-ylang']::text[], array['cedar', 'white musk']::text[]),
    ('Chanel', 'Coco Mademoiselle', 'Eau de Parfum', 'chypre', array['orange', 'bergamot']::text[], array['rose', 'jasmine']::text[], array['patchouli', 'vetiver', 'vanilla', 'white musk']::text[]),
    ('Chanel', 'Coco Noir', 'Eau de Parfum', 'amber', array['grapefruit', 'bergamot']::text[], array['rose', 'jasmine', 'geranium']::text[], array['patchouli', 'sandalwood', 'tonka', 'vanilla', 'incense']::text[]),
    ('Chanel', 'Chance Eau Tendre', 'Eau de Toilette', 'floral', array['grapefruit', 'quince']::text[], array['jasmine', 'hyacinth']::text[], array['white musk', 'iris', 'cedar']::text[]),
    ('Chanel', 'Chance', 'Eau de Parfum', 'floral', array['pink pepper', 'citrus']::text[], array['jasmine', 'iris']::text[], array['patchouli', 'vanilla', 'white musk']::text[]),
    ('Chanel', 'Gabrielle', 'Eau de Parfum', 'floral', array['mandarin', 'grapefruit']::text[], array['jasmine', 'tuberose', 'orange blossom', 'ylang-ylang']::text[], array['sandalwood', 'musk']::text[]),
    ('Chanel', 'Bleu de Chanel', 'Eau de Parfum', 'woody', array['grapefruit', 'lemon', 'mint']::text[], array['ginger', 'nutmeg', 'jasmine']::text[], array['incense', 'sandalwood', 'cedar', 'labdanum']::text[]),
    ('Chanel', 'Allure Homme Sport', 'Eau de Toilette', 'fresh', array['orange', 'aldehydes']::text[], array['pepper', 'neroli', 'sea notes']::text[], array['tonka', 'vanilla', 'white musk', 'cedar']::text[]),
    ('Chanel', 'Coromandel', 'Eau de Parfum', 'amber', array['bergamot', 'orange']::text[], array['patchouli', 'iris']::text[], array['benzoin', 'incense', 'white musk']::text[]),
    ('Chanel', 'Sycomore', 'Eau de Parfum', 'woody', array['pink pepper', 'juniper']::text[], array['vetiver']::text[], array['cedar', 'sandalwood']::text[]),
    ('Chanel', 'Égoïste Platinum', 'Eau de Toilette', 'fougère', array['lavender', 'rosemary', 'petitgrain']::text[], array['geranium', 'clary sage']::text[], array['vetiver', 'oakmoss', 'cedar']::text[]),
    ('Dior', 'J''adore', 'Eau de Parfum', 'floral', array['pear', 'melon', 'mandarin']::text[], array['jasmine', 'rose', 'ylang-ylang', 'tuberose']::text[], array['musk', 'vanilla', 'cedar']::text[]),
    ('Dior', 'Miss Dior', 'Eau de Parfum', 'floral', array['mandarin', 'pink pepper']::text[], array['rose', 'peony', 'lily of the valley']::text[], array['patchouli', 'rosewood', 'musk']::text[]),
    ('Dior', 'Miss Dior Blooming Bouquet', 'Eau de Toilette', 'floral', array['mandarin']::text[], array['peony', 'rose']::text[], array['white musk']::text[]),
    ('Dior', 'Hypnotic Poison', 'Eau de Toilette', 'amber', array['coconut', 'plum', 'apricot']::text[], array['jasmine', 'tuberose', 'caraway']::text[], array['vanilla', 'almond', 'sandalwood', 'musk']::text[]),
    ('Dior', 'Poison', 'Eau de Toilette', 'amber', array['plum', 'coriander', 'berries']::text[], array['tuberose', 'rose', 'cinnamon']::text[], array['vanilla', 'amber', 'sandalwood', 'musk']::text[]),
    ('Dior', 'Sauvage', 'Eau de Toilette', 'aromatic', array['bergamot', 'pepper']::text[], array['Sichuan pepper', 'lavender', 'geranium']::text[], array['ambroxan', 'cedar', 'labdanum']::text[]),
    ('Dior', 'Sauvage', 'Eau de Parfum', 'aromatic', array['bergamot']::text[], array['Sichuan pepper', 'lavender', 'star anise', 'nutmeg']::text[], array['ambroxan', 'vanilla']::text[]),
    ('Dior', 'Dior Homme Intense', 'Eau de Parfum', 'woody', array['lavender']::text[], array['iris', 'ambrette', 'pear']::text[], array['vetiver', 'cedar']::text[]),
    ('Dior', 'Fahrenheit', 'Eau de Toilette', 'leather', array['nutmeg', 'lavender', 'mandarin', 'bergamot']::text[], array['violet leaf', 'honeysuckle']::text[], array['leather', 'vetiver', 'cedar']::text[]),
    ('Dior', 'Eau Sauvage', 'Eau de Toilette', 'citrus', array['lemon', 'bergamot', 'basil', 'rosemary']::text[], array['jasmine', 'coriander']::text[], array['vetiver', 'oakmoss', 'musk']::text[]),
    ('Dior', 'Oud Ispahan', 'Eau de Parfum', 'woody', array['labdanum']::text[], array['rose']::text[], array['oud', 'patchouli', 'sandalwood']::text[]),
    ('Dior', 'Gris Dior', 'Eau de Parfum', 'chypre', array['bergamot']::text[], array['rose', 'jasmine']::text[], array['patchouli', 'oakmoss', 'musk']::text[]),
    ('Dior', 'Ambre Nuit', 'Eau de Parfum', 'amber', array['bergamot', 'pink pepper']::text[], array['rose']::text[], array['amber', 'guaiac wood']::text[]),
    ('Guerlain', 'Shalimar', 'Eau de Parfum', 'amber', array['bergamot', 'lemon']::text[], array['iris', 'jasmine', 'rose']::text[], array['vanilla', 'incense', 'tonka', 'opoponax']::text[]),
    ('Guerlain', 'Mitsouko', 'Eau de Toilette', 'chypre', array['bergamot']::text[], array['peach', 'rose', 'jasmine']::text[], array['oakmoss', 'labdanum', 'vetiver']::text[]),
    ('Guerlain', 'L''Heure Bleue', 'Eau de Parfum', 'floral', array['anise', 'bergamot', 'neroli']::text[], array['carnation', 'violet', 'iris', 'rose']::text[], array['vanilla', 'tonka', 'benzoin', 'musk']::text[]),
    ('Guerlain', 'Habit Rouge', 'Eau de Toilette', 'amber', array['bergamot', 'lemon', 'orange']::text[], array['rose', 'carnation', 'cinnamon']::text[], array['leather', 'vanilla', 'benzoin', 'opoponax']::text[]),
    ('Guerlain', 'Vetiver', 'Eau de Toilette', 'woody', array['bergamot', 'lemon']::text[], array['nutmeg', 'pepper', 'tobacco']::text[], array['vetiver']::text[]),
    ('Guerlain', 'La Petite Robe Noire', 'Eau de Parfum', 'gourmand', array['black cherry', 'almond', 'bergamot']::text[], array['rose', 'licorice']::text[], array['black tea', 'vanilla', 'patchouli']::text[]),
    ('Guerlain', 'Mon Guerlain', 'Eau de Parfum', 'amber', array['lavender', 'bergamot']::text[], array['iris', 'jasmine']::text[], array['vanilla', 'sandalwood', 'coumarin']::text[]),
    ('Guerlain', 'Aqua Allegoria Pera Granita', 'Eau de Toilette', 'fruity', array['pear', 'citrus']::text[], array['white flowers']::text[], array['musk']::text[]),
    ('Guerlain', 'L''Homme Idéal', 'Eau de Parfum', 'amber', array['citrus', 'almond']::text[], array['leather']::text[], array['tonka', 'vanilla']::text[]),
    ('Yves Saint Laurent', 'Black Opium', 'Eau de Parfum', 'gourmand', array['pear', 'pink pepper', 'orange blossom']::text[], array['coffee', 'jasmine']::text[], array['vanilla', 'patchouli', 'cedar']::text[]),
    ('Yves Saint Laurent', 'Libre', 'Eau de Parfum', 'floral', array['lavender', 'mandarin']::text[], array['orange blossom', 'jasmine']::text[], array['vanilla', 'musk', 'cedar']::text[]),
    ('Yves Saint Laurent', 'Mon Paris', 'Eau de Parfum', 'fruity', array['strawberry', 'raspberry', 'pear']::text[], array['peony', 'jasmine']::text[], array['patchouli', 'white musk']::text[]),
    ('Yves Saint Laurent', 'Opium', 'Eau de Parfum', 'amber', array['mandarin', 'plum', 'clove']::text[], array['carnation', 'jasmine', 'rose', 'cinnamon']::text[], array['incense', 'myrrh', 'opoponax', 'vanilla']::text[]),
    ('Yves Saint Laurent', 'Y', 'Eau de Parfum', 'fougère', array['apple', 'ginger', 'bergamot']::text[], array['sage', 'juniper', 'geranium']::text[], array['tonka', 'amberwood', 'cedar']::text[]),
    ('Yves Saint Laurent', 'La Nuit de L''Homme', 'Eau de Toilette', 'aromatic', array['cardamom', 'bergamot']::text[], array['lavender', 'cedar']::text[], array['vetiver', 'caraway']::text[]),
    ('Yves Saint Laurent', 'Kouros', 'Eau de Toilette', 'fougère', array['aldehydes', 'artemisia', 'coriander']::text[], array['geranium', 'clove']::text[], array['honey', 'leather', 'musk', 'oakmoss', 'incense']::text[]),
    ('Yves Saint Laurent', 'Tuxedo', 'Eau de Parfum', 'amber', array['spices']::text[], array['patchouli']::text[], array['vanilla', 'amber']::text[]),
    ('Lancôme', 'La Vie Est Belle', 'Eau de Parfum', 'gourmand', array['blackcurrant', 'pear']::text[], array['iris', 'jasmine', 'orange blossom']::text[], array['praline', 'vanilla', 'patchouli', 'tonka']::text[]),
    ('Lancôme', 'Idôle', 'Eau de Parfum', 'floral', array['bergamot', 'pear', 'pink pepper']::text[], array['rose', 'jasmine']::text[], array['white musk', 'vanilla']::text[]),
    ('Lancôme', 'Trésor', 'Eau de Parfum', 'floral', array['peach', 'bergamot']::text[], array['rose', 'iris', 'heliotrope']::text[], array['vanilla', 'sandalwood', 'musk']::text[]),
    ('Lancôme', 'Hypnôse', 'Eau de Parfum', 'amber', array['passionflower']::text[], array['jasmine', 'gardenia']::text[], array['vanilla', 'vetiver']::text[]),
    ('Giorgio Armani', 'Acqua di Giò', 'Eau de Toilette', 'aquatic', array['lime', 'lemon', 'bergamot', 'sea notes']::text[], array['jasmine', 'rosemary']::text[], array['white musk', 'cedar', 'patchouli']::text[]),
    ('Giorgio Armani', 'Acqua di Giò Profumo', 'Parfum', 'aquatic', array['bergamot', 'sea notes']::text[], array['geranium', 'sage', 'rosemary']::text[], array['incense', 'patchouli']::text[]),
    ('Giorgio Armani', 'Acqua di Gioia', 'Eau de Parfum', 'fresh', array['lemon', 'mint', 'pink pepper']::text[], array['jasmine']::text[], array['cedar', 'labdanum', 'brown sugar']::text[]),
    ('Giorgio Armani', 'Sì', 'Eau de Parfum', 'chypre', array['blackcurrant']::text[], array['rose', 'freesia']::text[], array['vanilla', 'patchouli', 'ambroxan']::text[]),
    ('Giorgio Armani', 'My Way', 'Eau de Parfum', 'floral', array['bergamot', 'orange blossom']::text[], array['tuberose', 'jasmine']::text[], array['vanilla', 'white musk', 'cedar']::text[]),
    ('Giorgio Armani', 'Code', 'Eau de Toilette', 'amber', array['bergamot', 'lemon']::text[], array['olive blossom', 'star anise']::text[], array['tonka', 'guaiac wood', 'leather']::text[]),
    ('Giorgio Armani', 'Stronger With You', 'Eau de Toilette', 'gourmand', array['cardamom', 'pink pepper', 'mint']::text[], array['sage', 'lavender']::text[], array['chestnut', 'vanilla']::text[]),
    ('Prada', 'Candy', 'Eau de Parfum', 'gourmand', array['caramel']::text[], array['musk', 'powdery notes']::text[], array['benzoin', 'vanilla']::text[]),
    ('Prada', 'Infusion d''Iris', 'Eau de Parfum', 'floral', array['mandarin', 'orange blossom']::text[], array['iris', 'galbanum']::text[], array['incense', 'cedar', 'vetiver', 'benzoin']::text[]),
    ('Prada', 'L''Homme', 'Eau de Toilette', 'woody', array['neroli', 'black pepper', 'cardamom']::text[], array['iris', 'violet', 'geranium']::text[], array['amber', 'patchouli', 'cedar']::text[]),
    ('Prada', 'Luna Rossa Carbon', 'Eau de Toilette', 'aromatic', array['bergamot', 'pepper']::text[], array['lavender', 'metallic notes']::text[], array['ambroxan', 'patchouli']::text[]),
    ('Prada', 'Paradoxe', 'Eau de Parfum', 'floral', array['pear', 'bergamot', 'mandarin']::text[], array['neroli', 'jasmine']::text[], array['amber', 'white musk', 'vanilla']::text[]),
    ('Gucci', 'Bloom', 'Eau de Parfum', 'floral', array['jasmine']::text[], array['tuberose', 'Rangoon creeper']::text[], array['orris root']::text[]),
    ('Gucci', 'Guilty Pour Homme', 'Eau de Toilette', 'aromatic', array['lemon', 'lavender', 'pink pepper']::text[], array['orange blossom', 'neroli']::text[], array['patchouli', 'cedar']::text[]),
    ('Gucci', 'Flora Gorgeous Gardenia', 'Eau de Parfum', 'floral', array['pear blossom', 'red berries']::text[], array['gardenia', 'jasmine']::text[], array['brown sugar', 'patchouli']::text[]),
    ('Tom Ford', 'Black Orchid', 'Eau de Parfum', 'amber', array['truffle', 'blackcurrant', 'ylang-ylang', 'bergamot']::text[], array['orchid', 'spices', 'fruity notes']::text[], array['patchouli', 'chocolate', 'vanilla', 'incense', 'sandalwood']::text[]),
    ('Tom Ford', 'Tobacco Vanille', 'Eau de Parfum', 'amber', array['tobacco leaf', 'spices']::text[], array['tonka', 'vanilla', 'cacao', 'tobacco flower']::text[], array['dried fruits', 'woody notes']::text[]),
    ('Tom Ford', 'Oud Wood', 'Eau de Parfum', 'woody', array['rosewood', 'cardamom', 'pepper']::text[], array['oud', 'sandalwood', 'vetiver']::text[], array['tonka', 'vanilla', 'amber']::text[]),
    ('Tom Ford', 'Neroli Portofino', 'Eau de Parfum', 'citrus', array['bergamot', 'mandarin', 'lemon', 'lavender']::text[], array['neroli', 'orange blossom', 'jasmine']::text[], array['amber', 'angelica', 'ambrette']::text[]),
    ('Tom Ford', 'Lost Cherry', 'Eau de Parfum', 'gourmand', array['black cherry', 'cherry liqueur', 'bitter almond']::text[], array['rose', 'jasmine']::text[], array['tonka', 'sandalwood', 'vanilla']::text[]),
    ('Tom Ford', 'Soleil Blanc', 'Eau de Parfum', 'floral', array['bergamot', 'cardamom', 'pistachio']::text[], array['ylang-ylang', 'jasmine', 'tuberose']::text[], array['coconut', 'tonka', 'amber', 'benzoin']::text[]),
    ('Tom Ford', 'Ombré Leather', 'Eau de Parfum', 'leather', array['cardamom']::text[], array['leather', 'jasmine']::text[], array['amber', 'moss', 'patchouli']::text[]),
    ('Tom Ford', 'Noir de Noir', 'Eau de Parfum', 'chypre', array['saffron']::text[], array['rose', 'truffle']::text[], array['oud', 'patchouli', 'vanilla', 'oakmoss']::text[]),
    ('Tom Ford', 'Fucking Fabulous', 'Eau de Parfum', 'leather', array['lavender', 'clary sage', 'bitter almond']::text[], array['leather', 'orris']::text[], array['tonka', 'vanilla', 'cashmeran']::text[]),
    ('Tom Ford', 'Bitter Peach', 'Eau de Parfum', 'fruity', array['peach', 'blood orange', 'cardamom']::text[], array['rum', 'cognac', 'jasmine']::text[], array['vanilla', 'tonka', 'sandalwood']::text[]),
    ('Tom Ford', 'Rose Prick', 'Eau de Parfum', 'floral', array['Sichuan pepper', 'turmeric']::text[], array['rose']::text[], array['patchouli', 'tonka']::text[]),
    ('Hermès', 'Terre d''Hermès', 'Eau de Toilette', 'woody', array['orange', 'grapefruit']::text[], array['pepper', 'geranium', 'flint']::text[], array['vetiver', 'cedar', 'patchouli', 'benzoin']::text[]),
    ('Hermès', 'Un Jardin sur le Nil', 'Eau de Toilette', 'green', array['green mango', 'grapefruit']::text[], array['lotus', 'hyacinth']::text[], array['sycamore wood', 'musk', 'incense']::text[]),
    ('Hermès', 'Twilly d''Hermès', 'Eau de Parfum', 'floral', array['ginger']::text[], array['tuberose']::text[], array['sandalwood']::text[]),
    ('Hermès', 'Eau des Merveilles', 'Eau de Toilette', 'woody', array['orange', 'lemon']::text[], array['pepper']::text[], array['amber', 'woods', 'oakmoss']::text[]),
    ('Hermès', 'H24', 'Eau de Toilette', 'aromatic', array['clary sage']::text[], array['narcissus']::text[], array['rosewood', 'metallic notes']::text[]),
    ('Le Labo', 'Santal 33', 'Eau de Parfum', 'woody', array['cardamom', 'violet']::text[], array['iris', 'papyrus']::text[], array['sandalwood', 'cedar', 'leather']::text[]),
    ('Le Labo', 'Another 13', 'Eau de Parfum', 'musky', array['pear', 'citrus']::text[], array['ambroxan', 'jasmine']::text[], array['musk', 'moss']::text[]),
    ('Le Labo', 'Rose 31', 'Eau de Parfum', 'floral', array['rose', 'cumin']::text[], array['spices']::text[], array['cedar', 'oud', 'musk']::text[]),
    ('Le Labo', 'Thé Noir 29', 'Eau de Parfum', 'woody', array['bergamot', 'fig', 'bay leaf']::text[], array['black tea', 'cedar']::text[], array['vetiver', 'tobacco', 'musk']::text[]),
    ('Le Labo', 'Bergamote 22', 'Eau de Parfum', 'citrus', array['bergamot', 'grapefruit', 'petitgrain']::text[], array['orange blossom']::text[], array['vetiver', 'cedar', 'musk', 'amber']::text[]),
    ('Le Labo', 'Lys 41', 'Eau de Parfum', 'floral', array['lily']::text[], array['tuberose', 'jasmine']::text[], array['vanilla', 'musk', 'woods']::text[]),
    ('Byredo', 'Gypsy Water', 'Eau de Parfum', 'woody', array['bergamot', 'lemon', 'juniper', 'pepper']::text[], array['incense', 'pine needles', 'orris']::text[], array['amber', 'vanilla', 'sandalwood']::text[]),
    ('Byredo', 'Mojave Ghost', 'Eau de Parfum', 'woody', array['ambrette', 'sapodilla']::text[], array['magnolia', 'violet', 'sandalwood']::text[], array['cedar', 'amber', 'musk']::text[]),
    ('Byredo', 'Bal d''Afrique', 'Eau de Parfum', 'floral', array['bergamot', 'lemon', 'neroli', 'marigold']::text[], array['violet', 'cyclamen', 'jasmine']::text[], array['vetiver', 'musk', 'cedar', 'amber']::text[]),
    ('Byredo', 'Blanche', 'Eau de Parfum', 'musky', array['aldehydes', 'rose', 'pink pepper']::text[], array['peony', 'violet', 'neroli']::text[], array['musk', 'sandalwood']::text[]),
    ('Byredo', 'Rose of No Man''s Land', 'Eau de Parfum', 'floral', array['pink pepper']::text[], array['rose', 'raspberry blossom']::text[], array['papyrus', 'white amber']::text[]),
    ('Byredo', 'Bibliothèque', 'Eau de Parfum', 'leather', array['plum', 'peach']::text[], array['peony', 'violet']::text[], array['leather', 'vanilla', 'patchouli']::text[]),
    ('Maison Francis Kurkdjian', 'Baccarat Rouge 540', 'Eau de Parfum', 'amber', array['saffron', 'jasmine']::text[], array['amberwood', 'ambergris']::text[], array['fir resin', 'cedar']::text[]),
    ('Maison Francis Kurkdjian', 'Baccarat Rouge 540', 'Extrait de Parfum', 'amber', array['bitter almond', 'saffron']::text[], array['jasmine']::text[], array['amber', 'musk', 'woods']::text[]),
    ('Maison Francis Kurkdjian', 'Aqua Universalis', 'Eau de Toilette', 'citrus', array['bergamot', 'lemon']::text[], array['lily of the valley', 'white flowers']::text[], array['musk', 'woods']::text[]),
    ('Maison Francis Kurkdjian', 'Gentle Fluidity Gold', 'Eau de Parfum', 'amber', array['juniper', 'nutmeg']::text[], array['coriander', 'musk']::text[], array['vanilla', 'amberwood']::text[]),
    ('Maison Francis Kurkdjian', 'Grand Soir', 'Eau de Parfum', 'amber', array['amber accord']::text[], array['benzoin']::text[], array['vanilla', 'tonka']::text[]),
    ('Maison Francis Kurkdjian', 'Oud Satin Mood', 'Eau de Parfum', 'amber', array['violet']::text[], array['rose', 'oud']::text[], array['vanilla', 'benzoin', 'amber']::text[]),
    ('Maison Margiela', 'Replica Jazz Club', 'Eau de Toilette', 'amber', array['pink pepper', 'lemon', 'neroli']::text[], array['rum', 'clary sage', 'vetiver']::text[], array['tobacco leaf', 'vanilla', 'styrax']::text[]),
    ('Maison Margiela', 'Replica By the Fireplace', 'Eau de Toilette', 'woody', array['clove', 'pink pepper', 'orange blossom']::text[], array['chestnut', 'guaiac wood', 'juniper']::text[], array['vanilla', 'cashmeran', 'Peru balsam']::text[]),
    ('Maison Margiela', 'Replica Lazy Sunday Morning', 'Eau de Toilette', 'musky', array['pear', 'aldehydes']::text[], array['lily of the valley', 'iris', 'rose']::text[], array['white musk', 'ambrette', 'patchouli']::text[]),
    ('Maison Margiela', 'Replica Beach Walk', 'Eau de Toilette', 'fresh', array['bergamot', 'lemon', 'pink pepper']::text[], array['ylang-ylang', 'coconut milk', 'heliotrope']::text[], array['musk', 'cedar', 'benzoin']::text[]),
    ('Maison Margiela', 'Replica Coffee Break', 'Eau de Toilette', 'gourmand', array['coffee']::text[], array['milk notes', 'lavender']::text[], array['vanilla', 'musk']::text[]),
    ('Maison Margiela', 'Replica Bubble Bath', 'Eau de Toilette', 'musky', array['bergamot', 'pink pepper']::text[], array['lavender', 'rose', 'coconut milk']::text[], array['white musk']::text[]),
    ('Diptyque', 'Philosykos', 'Eau de Toilette', 'green', array['fig leaf', 'green notes']::text[], array['fig', 'coconut']::text[], array['fig wood', 'cedar']::text[]),
    ('Diptyque', 'Do Son', 'Eau de Toilette', 'floral', array['orange blossom', 'pink pepper']::text[], array['tuberose', 'rose']::text[], array['musk', 'benzoin']::text[]),
    ('Diptyque', 'Tam Dao', 'Eau de Toilette', 'woody', array['rosewood', 'cypress']::text[], array['sandalwood']::text[], array['cedar', 'amber', 'musk']::text[]),
    ('Diptyque', 'Orphéon', 'Eau de Parfum', 'woody', array['juniper']::text[], array['jasmine']::text[], array['cedar', 'tonka']::text[]),
    ('Diptyque', 'Eau Rose', 'Eau de Toilette', 'floral', array['blackcurrant', 'citrus']::text[], array['rose']::text[], array['musk', 'cedar']::text[]),
    ('Diptyque', 'L''Ombre dans L''Eau', 'Eau de Toilette', 'green', array['blackcurrant leaf']::text[], array['rose']::text[], array['green notes', 'musk']::text[]),
    ('Diptyque', 'Fleur de Peau', 'Eau de Parfum', 'musky', array['pink pepper', 'aldehydes']::text[], array['iris', 'rose']::text[], array['musk', 'ambrette']::text[]),
    ('Creed', 'Aventus', 'Eau de Parfum', 'chypre', array['pineapple', 'bergamot', 'blackcurrant', 'apple']::text[], array['birch', 'patchouli', 'jasmine']::text[], array['musk', 'oakmoss', 'ambergris', 'vanilla']::text[]),
    ('Creed', 'Green Irish Tweed', 'Eau de Parfum', 'fougère', array['lemon verbena', 'peppermint']::text[], array['violet leaf', 'iris']::text[], array['sandalwood', 'ambergris']::text[]),
    ('Creed', 'Silver Mountain Water', 'Eau de Parfum', 'fresh', array['bergamot', 'mandarin']::text[], array['green tea', 'blackcurrant']::text[], array['musk', 'sandalwood', 'petitgrain']::text[]),
    ('Creed', 'Love in White', 'Eau de Parfum', 'floral', array['orange peel']::text[], array['iris', 'jasmine', 'magnolia']::text[], array['sandalwood', 'vanilla', 'ambergris']::text[]),
    ('Creed', 'Aventus for Her', 'Eau de Parfum', 'fruity', array['green apple', 'lemon', 'pink pepper']::text[], array['rose']::text[], array['sandalwood', 'musk']::text[]),
    ('Creed', 'Viking', 'Eau de Parfum', 'aromatic', array['bergamot', 'lemon', 'pink pepper']::text[], array['rose', 'peppermint']::text[], array['sandalwood', 'vetiver', 'patchouli']::text[]),
    ('Parfums de Marly', 'Layton', 'Eau de Parfum', 'aromatic', array['apple', 'lavender', 'bergamot', 'mandarin']::text[], array['geranium', 'violet', 'jasmine']::text[], array['vanilla', 'cardamom', 'sandalwood', 'patchouli']::text[]),
    ('Parfums de Marly', 'Delina', 'Eau de Parfum', 'floral', array['lychee', 'rhubarb', 'bergamot', 'nutmeg']::text[], array['rose', 'peony']::text[], array['vanilla', 'cashmeran', 'musk']::text[]),
    ('Parfums de Marly', 'Pegasus', 'Eau de Parfum', 'amber', array['bergamot', 'heliotrope', 'bitter almond']::text[], array['lavender', 'jasmine']::text[], array['vanilla', 'sandalwood', 'amber']::text[]),
    ('Parfums de Marly', 'Herod', 'Eau de Parfum', 'amber', array['cinnamon', 'pepper']::text[], array['tobacco', 'incense', 'osmanthus']::text[], array['vanilla', 'cypriol', 'musk']::text[]),
    ('Parfums de Marly', 'Valaya', 'Eau de Parfum', 'musky', array['aldehydes', 'bergamot']::text[], array['orange blossom']::text[], array['white musk', 'vanilla']::text[]),
    ('Jo Malone London', 'Wood Sage & Sea Salt', 'Cologne', 'fresh', array['ambrette', 'sea salt']::text[], array['sage']::text[], array['driftwood']::text[]),
    ('Jo Malone London', 'English Pear & Freesia', 'Cologne', 'fruity', array['pear', 'melon']::text[], array['freesia', 'rose']::text[], array['patchouli', 'musk', 'amber']::text[]),
    ('Jo Malone London', 'Peony & Blush Suede', 'Cologne', 'floral', array['red apple']::text[], array['peony', 'rose', 'jasmine']::text[], array['suede']::text[]),
    ('Jo Malone London', 'Lime Basil & Mandarin', 'Cologne', 'citrus', array['lime', 'mandarin']::text[], array['basil', 'thyme']::text[], array['vetiver', 'amber']::text[]),
    ('Jo Malone London', 'Myrrh & Tonka', 'Cologne Intense', 'amber', array['lavender']::text[], array['myrrh']::text[], array['tonka', 'vanilla', 'almond']::text[]),
    ('Jo Malone London', 'Velvet Rose & Oud', 'Cologne Intense', 'floral', array['clove']::text[], array['rose']::text[], array['oud', 'praline']::text[]),
    ('Kilian', 'Love, Don''t Be Shy', 'Eau de Parfum', 'gourmand', array['neroli', 'bergamot', 'pink pepper']::text[], array['orange blossom', 'jasmine', 'honeysuckle']::text[], array['marshmallow', 'vanilla', 'caramel', 'musk']::text[]),
    ('Kilian', 'Angels'' Share', 'Eau de Parfum', 'gourmand', array['cognac']::text[], array['cinnamon', 'tonka', 'oak']::text[], array['praline', 'vanilla', 'sandalwood']::text[]),
    ('Kilian', 'Good Girl Gone Bad', 'Eau de Parfum', 'floral', array['osmanthus']::text[], array['jasmine', 'tuberose', 'rose']::text[], array['cedar', 'amber']::text[]),
    ('Kilian', 'Black Phantom', 'Eau de Parfum', 'gourmand', array['rum', 'sugarcane']::text[], array['coffee', 'dark chocolate', 'heliotrope']::text[], array['sandalwood', 'caramel']::text[]),
    ('Frédéric Malle', 'Portrait of a Lady', 'Eau de Parfum', 'floral', array['raspberry', 'clove', 'cinnamon', 'blackcurrant']::text[], array['rose']::text[], array['patchouli', 'incense', 'sandalwood', 'musk', 'benzoin']::text[]),
    ('Frédéric Malle', 'Carnal Flower', 'Eau de Parfum', 'floral', array['eucalyptus', 'melon', 'bergamot']::text[], array['tuberose', 'jasmine', 'orange blossom']::text[], array['coconut', 'musk']::text[]),
    ('Frédéric Malle', 'Musc Ravageur', 'Eau de Parfum', 'amber', array['lavender', 'bergamot', 'mandarin']::text[], array['cinnamon', 'clove']::text[], array['vanilla', 'musk', 'amber', 'sandalwood']::text[]),
    ('Frédéric Malle', 'Une Rose', 'Eau de Parfum', 'floral', array['rose']::text[], array['rose', 'geranium']::text[], array['earthy notes', 'woods']::text[]),
    ('Frédéric Malle', 'Lipstick Rose', 'Eau de Parfum', 'floral', array['aldehydes', 'raspberry']::text[], array['rose', 'violet']::text[], array['vanilla', 'musk', 'vetiver']::text[]),
    ('Serge Lutens', 'Ambre Sultan', 'Eau de Parfum', 'amber', array['oregano', 'bay leaf', 'coriander']::text[], array['myrtle', 'angelica']::text[], array['amber', 'benzoin', 'labdanum', 'patchouli', 'vanilla']::text[]),
    ('Serge Lutens', 'Féminité du Bois', 'Eau de Parfum', 'woody', array['plum', 'orange blossom']::text[], array['cinnamon', 'clove', 'honey']::text[], array['cedar', 'musk']::text[]),
    ('Serge Lutens', 'Chergui', 'Eau de Parfum', 'amber', array['tobacco leaf', 'honey']::text[], array['hay', 'iris', 'rose']::text[], array['musk', 'sandalwood', 'amber', 'incense']::text[]),
    ('Serge Lutens', 'La Fille de Berlin', 'Eau de Parfum', 'floral', array['pepper']::text[], array['rose']::text[], array['musk', 'woods']::text[]),
    ('Serge Lutens', 'Fleurs d''Oranger', 'Eau de Parfum', 'floral', array['orange blossom', 'petitgrain']::text[], array['jasmine', 'tuberose']::text[], array['nutmeg', 'musk']::text[]),
    ('L''Artisan Parfumeur', 'Mûre et Musc', 'Eau de Toilette', 'fruity', array['citrus', 'basil']::text[], array['blackberry']::text[], array['musk']::text[]),
    ('L''Artisan Parfumeur', 'Timbuktu', 'Eau de Toilette', 'woody', array['green mango', 'cardamom', 'pink pepper']::text[], array['papyrus']::text[], array['vetiver', 'incense', 'patchouli']::text[]),
    ('L''Artisan Parfumeur', 'Passage d''Enfer', 'Eau de Toilette', 'woody', array['incense']::text[], array['lily']::text[], array['sandalwood', 'benzoin']::text[]),
    ('Juliette Has A Gun', 'Not a Perfume', 'Eau de Parfum', 'musky', '{}'::text[], '{}'::text[], array['ambroxan']::text[]),
    ('Juliette Has A Gun', 'Mmmm...', 'Eau de Parfum', 'gourmand', array['jasmine']::text[], array['vanilla']::text[], array['musk']::text[]),
    ('Escentric Molecules', 'Molecule 01', 'Eau de Toilette', 'woody', '{}'::text[], '{}'::text[], array['Iso E Super']::text[]),
    ('Escentric Molecules', 'Escentric 01', 'Eau de Toilette', 'woody', array['lime', 'pink pepper']::text[], array['Iso E Super']::text[], array['incense', 'ambrette']::text[]),
    ('Kayali', 'Vanilla 28', 'Eau de Parfum', 'gourmand', array['brown sugar']::text[], array['vanilla orchid', 'jasmine']::text[], array['amber', 'tonka', 'musk']::text[]),
    ('Kayali', 'Yum Pistachio Gelato 33', 'Eau de Parfum', 'gourmand', array['pistachio', 'almond']::text[], array['vanilla', 'cream']::text[], array['musk', 'sandalwood']::text[]),
    ('Ariana Grande', 'Cloud', 'Eau de Parfum', 'gourmand', array['lavender', 'pear', 'bergamot']::text[], array['coconut', 'praline', 'vanilla orchid']::text[], array['musk', 'cashmere woods']::text[]),
    ('Ariana Grande', 'Sweet Like Candy', 'Eau de Parfum', 'gourmand', array['blackberry']::text[], array['marshmallow']::text[], array['vanilla', 'musk']::text[]),
    ('Sol de Janeiro', 'Cheirosa 62', 'Perfume Mist', 'gourmand', array['pistachio', 'almond']::text[], array['jasmine', 'heliotrope']::text[], array['salted caramel', 'vanilla', 'sandalwood']::text[]),
    ('Viktor&Rolf', 'Flowerbomb', 'Eau de Parfum', 'floral', array['tea', 'bergamot']::text[], array['orchid', 'jasmine', 'rose', 'freesia']::text[], array['patchouli', 'musk']::text[]),
    ('Viktor&Rolf', 'Spicebomb', 'Eau de Toilette', 'amber', array['pink pepper', 'elemi', 'grapefruit', 'bergamot']::text[], array['cinnamon', 'saffron', 'chili']::text[], array['tobacco', 'leather', 'vetiver']::text[]),
    ('Viktor&Rolf', 'Good Fortune', 'Eau de Parfum', 'floral', array['spices']::text[], array['jasmine']::text[], array['vanilla', 'woods']::text[]),
    ('Mugler', 'Angel', 'Eau de Parfum', 'gourmand', array['bergamot', 'red berries']::text[], array['honey']::text[], array['patchouli', 'vanilla', 'caramel', 'chocolate']::text[]),
    ('Mugler', 'Alien', 'Eau de Parfum', 'floral', array['jasmine']::text[], array['cashmeran']::text[], array['white amber']::text[]),
    ('Mugler', 'A*Men', 'Eau de Toilette', 'amber', array['lavender', 'mint', 'bergamot']::text[], array['coffee', 'honey', 'caramel']::text[], array['patchouli', 'tar', 'vanilla', 'tonka']::text[]),
    ('Mugler', 'Aura', 'Eau de Parfum', 'green', array['rhubarb leaf']::text[], array['orange blossom']::text[], array['vanilla', 'woods']::text[]),
    ('Jean Paul Gaultier', 'Le Male', 'Eau de Toilette', 'fougère', array['lavender', 'mint', 'cardamom', 'bergamot']::text[], array['cinnamon', 'orange blossom', 'cumin']::text[], array['vanilla', 'tonka', 'sandalwood', 'amber']::text[]),
    ('Jean Paul Gaultier', 'Classique', 'Eau de Toilette', 'floral', array['mandarin']::text[], array['orange blossom', 'rose', 'ginger']::text[], array['vanilla', 'amber', 'musk']::text[]),
    ('Jean Paul Gaultier', 'Scandal', 'Eau de Parfum', 'floral', array['blood orange', 'mandarin']::text[], array['honey', 'gardenia', 'jasmine']::text[], array['patchouli', 'beeswax', 'caramel']::text[]),
    ('Jean Paul Gaultier', 'Le Beau', 'Eau de Toilette', 'amber', array['bergamot']::text[], array['coconut']::text[], array['tonka', 'woods']::text[]),
    ('Jean Paul Gaultier', 'Ultra Male', 'Eau de Toilette', 'amber', array['pear', 'mint', 'bergamot']::text[], array['cinnamon', 'clary sage', 'lavender']::text[], array['vanilla', 'amber', 'cedar']::text[]),
    ('Carolina Herrera', 'Good Girl', 'Eau de Parfum', 'amber', array['almond', 'coffee', 'bergamot']::text[], array['tuberose', 'jasmine']::text[], array['tonka', 'cacao', 'vanilla']::text[]),
    ('Carolina Herrera', '212 VIP', 'Eau de Parfum', 'gourmand', array['rum', 'passion fruit']::text[], array['gardenia']::text[], array['vanilla', 'musk']::text[]),
    ('Carolina Herrera', '212 Men', 'Eau de Toilette', 'aromatic', array['bergamot', 'lavender', 'green notes']::text[], array['ginger', 'pepper']::text[], array['sandalwood', 'musk', 'incense']::text[]),
    ('Carolina Herrera', 'Bad Boy', 'Eau de Toilette', 'amber', array['white pepper', 'black pepper', 'bergamot']::text[], array['sage', 'cedar']::text[], array['tonka', 'cacao', 'amberwood']::text[]),
    ('Paco Rabanne', '1 Million', 'Eau de Toilette', 'amber', array['blood mandarin', 'grapefruit', 'mint']::text[], array['rose', 'cinnamon', 'spices']::text[], array['leather', 'woody notes', 'amber', 'patchouli']::text[]),
    ('Paco Rabanne', 'Lady Million', 'Eau de Parfum', 'floral', array['raspberry', 'neroli', 'lemon']::text[], array['jasmine', 'orange blossom', 'gardenia']::text[], array['honey', 'patchouli', 'amber']::text[]),
    ('Paco Rabanne', 'Invictus', 'Eau de Toilette', 'aquatic', array['grapefruit', 'sea notes', 'mandarin']::text[], array['bay leaf', 'jasmine']::text[], array['ambergris', 'guaiac wood', 'oakmoss', 'patchouli']::text[]),
    ('Paco Rabanne', 'Olympéa', 'Eau de Parfum', 'amber', array['green mandarin', 'water jasmine', 'ginger flower']::text[], array['vanilla', 'salt']::text[], array['sandalwood', 'cashmere wood', 'ambergris']::text[]),
    ('Paco Rabanne', 'Phantom', 'Eau de Toilette', 'aromatic', array['lemon']::text[], array['lavender', 'apple']::text[], array['vanilla', 'vetiver', 'patchouli']::text[]),
    ('Valentino', 'Donna Born in Roma', 'Eau de Parfum', 'floral', array['pink pepper', 'blackcurrant', 'bergamot']::text[], array['jasmine']::text[], array['vanilla', 'cashmeran']::text[]),
    ('Valentino', 'Uomo Born in Roma', 'Eau de Toilette', 'aromatic', array['violet leaf', 'salt']::text[], array['sage', 'ginger']::text[], array['vetiver', 'woods']::text[]),
    ('Givenchy', 'L''Interdit', 'Eau de Parfum', 'floral', array['pear', 'bergamot']::text[], array['orange blossom', 'jasmine', 'tuberose']::text[], array['patchouli', 'vetiver', 'vanilla', 'ambroxan']::text[]),
    ('Givenchy', 'Gentleman', 'Eau de Parfum', 'woody', array['black pepper']::text[], array['iris']::text[], array['patchouli', 'vanilla']::text[]),
    ('Givenchy', 'Ange ou Démon', 'Eau de Parfum', 'amber', array['mandarin', 'saffron']::text[], array['lily', 'ylang-ylang', 'orchid']::text[], array['vanilla', 'oak', 'tonka']::text[]),
    ('Givenchy', 'Π (Pi)', 'Eau de Toilette', 'amber', array['mandarin', 'rosemary', 'basil']::text[], array['neroli']::text[], array['vanilla', 'benzoin', 'tonka', 'almond']::text[]),
    ('Narciso Rodriguez', 'For Her', 'Eau de Toilette', 'musky', array['orange blossom', 'osmanthus']::text[], array['musk', 'amber']::text[], array['vanilla', 'vetiver']::text[]),
    ('Narciso Rodriguez', 'For Her', 'Eau de Parfum', 'musky', array['rose', 'peach']::text[], array['musk', 'amber']::text[], array['patchouli', 'cedar']::text[]),
    ('Narciso Rodriguez', 'Narciso', 'Eau de Parfum', 'musky', array['gardenia', 'rose']::text[], array['musk']::text[], array['cedar', 'vetiver']::text[]),
    ('Narciso Rodriguez', 'Musc Noir For Her', 'Eau de Parfum', 'musky', array['plum']::text[], array['musk']::text[], array['suede']::text[]),
    ('Dolce & Gabbana', 'Light Blue', 'Eau de Toilette', 'citrus', array['lemon', 'apple', 'cedar', 'bellflower']::text[], array['bamboo', 'jasmine', 'white rose']::text[], array['cedar', 'musk', 'amber']::text[]),
    ('Dolce & Gabbana', 'Light Blue Pour Homme', 'Eau de Toilette', 'citrus', array['grapefruit', 'bergamot', 'juniper']::text[], array['rosemary', 'Sichuan pepper', 'rosewood']::text[], array['musk', 'oakmoss', 'incense']::text[]),
    ('Dolce & Gabbana', 'The One', 'Eau de Parfum', 'amber', array['peach', 'lychee', 'mandarin', 'bergamot']::text[], array['lily', 'plum', 'jasmine']::text[], array['vanilla', 'amber', 'musk']::text[]),
    ('Dolce & Gabbana', 'The One for Men', 'Eau de Parfum', 'amber', array['grapefruit', 'coriander', 'basil']::text[], array['ginger', 'cardamom', 'orange blossom']::text[], array['tobacco', 'amber', 'cedar']::text[]),
    ('Versace', 'Eros', 'Eau de Toilette', 'fougère', array['mint', 'green apple', 'lemon']::text[], array['tonka', 'ambroxan', 'geranium']::text[], array['vanilla', 'vetiver', 'oakmoss', 'cedar']::text[]),
    ('Versace', 'Bright Crystal', 'Eau de Toilette', 'floral', array['pomegranate', 'yuzu']::text[], array['peony', 'magnolia', 'lotus']::text[], array['musk', 'mahogany', 'amber']::text[]),
    ('Versace', 'Dylan Blue', 'Eau de Toilette', 'aromatic', array['bergamot', 'grapefruit', 'fig leaf', 'water notes']::text[], array['violet leaf', 'black pepper', 'ambroxan']::text[], array['incense', 'tonka', 'musk']::text[]),
    ('Burberry', 'Her', 'Eau de Parfum', 'fruity', array['strawberry', 'raspberry', 'blackberry', 'lemon']::text[], array['violet', 'jasmine']::text[], array['musk', 'amber']::text[]),
    ('Burberry', 'Brit', 'Eau de Parfum', 'amber', array['lime', 'pear', 'almond']::text[], array['peony']::text[], array['vanilla', 'tonka', 'mahogany', 'amber']::text[]),
    ('Burberry', 'Hero', 'Eau de Toilette', 'woody', array['bergamot']::text[], array['juniper', 'black pepper']::text[], array['cedar']::text[]),
    ('Marc Jacobs', 'Daisy', 'Eau de Toilette', 'floral', array['strawberry', 'violet leaf', 'grapefruit']::text[], array['violet', 'gardenia', 'jasmine']::text[], array['musk', 'vanilla', 'white woods']::text[]),
    ('Marc Jacobs', 'Perfect', 'Eau de Parfum', 'floral', array['rhubarb', 'almond milk']::text[], array['daffodil', 'jasmine']::text[], array['cashmeran', 'cedar']::text[]),
    ('Calvin Klein', 'CK One', 'Eau de Toilette', 'citrus', array['bergamot', 'lemon', 'cardamom']::text[], array['jasmine', 'violet', 'lily of the valley']::text[], array['musk', 'amber', 'cedar', 'green tea']::text[]),
    ('Calvin Klein', 'Eternity', 'Eau de Parfum', 'floral', array['freesia', 'mandarin', 'sage']::text[], array['lily', 'carnation']::text[], array['sandalwood', 'musk', 'amber']::text[]),
    ('Calvin Klein', 'Obsession', 'Eau de Parfum', 'amber', array['mandarin', 'bergamot']::text[], array['spices', 'jasmine', 'orange blossom']::text[], array['amber', 'vanilla', 'musk', 'incense']::text[]),
    ('Estée Lauder', 'Beautiful', 'Eau de Parfum', 'floral', array['rose', 'lily', 'mandarin']::text[], array['tuberose', 'jasmine', 'orange blossom']::text[], array['sandalwood', 'vetiver', 'amber']::text[]),
    ('Estée Lauder', 'Youth Dew', 'Eau de Parfum', 'amber', array['aldehydes', 'orange', 'peach']::text[], array['clove', 'cinnamon', 'rose', 'jasmine']::text[], array['incense', 'amber', 'vanilla', 'patchouli']::text[]),
    ('Estée Lauder', 'Pleasures', 'Eau de Parfum', 'floral', array['green notes', 'violet leaf']::text[], array['lily', 'peony', 'rose']::text[], array['sandalwood', 'musk', 'patchouli']::text[]),
    ('Clinique', 'Happy', 'Eau de Parfum', 'citrus', array['bergamot', 'mandarin', 'grapefruit']::text[], array['freesia', 'lily']::text[], array['musk', 'amber']::text[]),
    ('Clinique', 'Aromatics Elixir', 'Parfum de Toilette', 'chypre', array['herbs', 'aldehydes']::text[], array['rose', 'jasmine', 'ylang-ylang']::text[], array['patchouli', 'oakmoss', 'vetiver']::text[]),
    ('Elizabeth Arden', 'Red Door', 'Eau de Toilette', 'floral', array['ylang-ylang', 'peach']::text[], array['rose', 'orchid', 'lily']::text[], array['honey', 'sandalwood', 'vetiver']::text[]),
    ('Elizabeth Arden', 'Green Tea', 'Eau de Parfum', 'green', array['lemon', 'bergamot', 'mint', 'orange']::text[], array['green tea', 'jasmine']::text[], array['musk', 'oakmoss', 'amber']::text[]),
    ('Davidoff', 'Cool Water', 'Eau de Toilette', 'aquatic', array['mint', 'lavender', 'sea notes']::text[], array['geranium', 'jasmine', 'neroli']::text[], array['musk', 'sandalwood', 'oakmoss']::text[]),
    ('Azzaro', 'Pour Homme', 'Eau de Toilette', 'fougère', array['lavender', 'anise', 'basil', 'lemon']::text[], array['iris', 'vetiver']::text[], array['oakmoss', 'leather', 'tonka', 'amber']::text[]),
    ('Azzaro', 'The Most Wanted', 'Eau de Parfum', 'amber', array['cardamom']::text[], array['toffee']::text[], array['amberwood']::text[]),
    ('Issey Miyake', 'L''Eau d''Issey', 'Eau de Toilette', 'aquatic', array['lotus', 'melon', 'freesia', 'rose water']::text[], array['lily', 'peony', 'carnation']::text[], array['musk', 'cedar', 'sandalwood']::text[]),
    ('Issey Miyake', 'L''Eau d''Issey Pour Homme', 'Eau de Toilette', 'aquatic', array['yuzu', 'bergamot', 'lemon', 'coriander']::text[], array['nutmeg', 'water lily']::text[], array['vetiver', 'cedar', 'sandalwood', 'musk']::text[]),
    ('Kenzo', 'Flower by Kenzo', 'Eau de Parfum', 'floral', array['hawthorn', 'mandarin']::text[], array['rose', 'violet']::text[], array['vanilla', 'white musk', 'incense']::text[]),
    ('Cacharel', 'Anaïs Anaïs', 'Eau de Toilette', 'floral', array['hyacinth', 'orange blossom', 'galbanum']::text[], array['jasmine', 'rose', 'lily of the valley']::text[], array['sandalwood', 'vetiver', 'incense', 'musk']::text[]),
    ('Nina Ricci', 'L''Air du Temps', 'Eau de Toilette', 'floral', array['carnation', 'bergamot']::text[], array['rose', 'jasmine', 'ylang-ylang']::text[], array['sandalwood', 'musk', 'iris']::text[]),
    ('Chloé', 'Chloé', 'Eau de Parfum', 'floral', array['peony', 'lychee', 'freesia']::text[], array['rose', 'magnolia', 'lily of the valley']::text[], array['cedar', 'amber']::text[]),
    ('Chloé', 'Nomade', 'Eau de Parfum', 'chypre', array['mirabelle plum', 'bergamot', 'lemon']::text[], array['freesia', 'peach', 'rose']::text[], array['oakmoss', 'patchouli', 'sandalwood']::text[]),
    ('Bvlgari', 'Omnia Crystalline', 'Eau de Toilette', 'floral', array['bamboo', 'nashi pear']::text[], array['lotus']::text[], array['tea', 'white woods', 'musk']::text[]),
    ('Bvlgari', 'Man in Black', 'Eau de Parfum', 'leather', array['rum', 'spices']::text[], array['iris', 'tuberose', 'leather']::text[], array['tonka', 'benzoin', 'guaiac wood']::text[]),
    ('Montblanc', 'Explorer', 'Eau de Parfum', 'woody', array['bergamot', 'pink pepper', 'clary sage']::text[], array['vetiver', 'leather']::text[], array['patchouli', 'ambroxan']::text[]),
    ('Montblanc', 'Legend', 'Eau de Toilette', 'fougère', array['bergamot', 'lavender']::text[], array['apple', 'rose']::text[], array['tonka', 'sandalwood']::text[]),
    ('Hugo Boss', 'Boss Bottled', 'Eau de Toilette', 'woody', array['apple', 'plum', 'bergamot', 'lemon']::text[], array['cinnamon', 'geranium', 'clove']::text[], array['vanilla', 'sandalwood', 'cedar', 'vetiver']::text[]),
    ('Ralph Lauren', 'Polo Green', 'Eau de Toilette', 'chypre', array['artemisia', 'basil', 'pine']::text[], array['juniper', 'leather']::text[], array['oakmoss', 'patchouli', 'tobacco']::text[]),
    ('Lattafa', 'Khamrah', 'Eau de Parfum', 'amber', array['cinnamon', 'nutmeg', 'bergamot']::text[], array['dates', 'praline']::text[], array['vanilla', 'tonka', 'amber']::text[]),
    ('Armaf', 'Club de Nuit Intense Man', 'Eau de Toilette', 'chypre', array['pineapple', 'blackcurrant', 'apple', 'bergamot']::text[], array['birch', 'jasmine']::text[], array['musk', 'ambergris', 'vanilla', 'patchouli']::text[]),
    ('Amouage', 'Interlude Man', 'Eau de Parfum', 'amber', array['bergamot', 'oregano', 'pimento']::text[], array['incense', 'opoponax', 'amber']::text[], array['leather', 'oud', 'sandalwood', 'patchouli']::text[]),
    ('Amouage', 'Reflection Man', 'Eau de Parfum', 'floral', array['rosemary', 'pink pepper']::text[], array['jasmine', 'orris', 'neroli']::text[], array['sandalwood', 'vetiver', 'cedar']::text[]),
    ('Amouage', 'Jubilation XXV', 'Eau de Parfum', 'amber', array['orange', 'coriander']::text[], array['rose', 'frankincense', 'myrrh']::text[], array['oakmoss', 'ambergris', 'patchouli']::text[]),
    ('Initio', 'Side Effect', 'Eau de Parfum', 'amber', array['rum']::text[], array['tobacco', 'cinnamon']::text[], array['vanilla']::text[]),
    ('Initio', 'Oud for Greatness', 'Eau de Parfum', 'woody', array['saffron', 'nutmeg', 'lavender']::text[], array['oud']::text[], array['patchouli', 'musk']::text[]),
    ('Xerjoff', 'Naxos', 'Eau de Parfum', 'amber', array['bergamot', 'lemon', 'lavender']::text[], array['honey', 'cinnamon']::text[], array['tobacco', 'tonka', 'vanilla']::text[]),
    ('Xerjoff', 'Erba Pura', 'Eau de Parfum', 'fruity', array['orange', 'lemon', 'bergamot']::text[], array['fruity notes']::text[], array['white musk', 'vanilla', 'amber']::text[]),
    ('Nishane', 'Hacivat', 'Extrait de Parfum', 'chypre', array['pineapple', 'grapefruit', 'bergamot']::text[], array['cedar', 'patchouli', 'jasmine']::text[], array['oakmoss', 'woody notes']::text[]),
    ('Nishane', 'Ani', 'Extrait de Parfum', 'amber', array['ginger', 'bergamot', 'cardamom']::text[], array['vanilla']::text[], array['sandalwood', 'benzoin', 'musk']::text[]),
    ('Mancera', 'Cedrat Boisé', 'Eau de Parfum', 'woody', array['citron', 'lemon', 'blackcurrant', 'spices']::text[], array['patchouli', 'jasmine']::text[], array['leather', 'sandalwood', 'oakmoss', 'musk', 'vanilla']::text[]),
    ('Montale', 'Intense Café', 'Eau de Parfum', 'gourmand', array['coffee']::text[], array['rose']::text[], array['vanilla', 'amber', 'musk']::text[]),
    ('Maison Crivelli', 'Hibiscus Mahajád', 'Extrait de Parfum', 'floral', array['pepper']::text[], array['hibiscus', 'rose']::text[], array['leather', 'woods']::text[]),
    ('Penhaligon''s', 'Halfeti', 'Eau de Parfum', 'amber', array['grapefruit', 'bergamot', 'cardamom']::text[], array['rose', 'jasmine', 'lavender']::text[], array['oud', 'leather', 'tonka', 'sandalwood']::text[]),
    ('Penhaligon''s', 'Luna', 'Eau de Toilette', 'citrus', array['orange', 'bergamot']::text[], array['rose', 'jasmine']::text[], array['myrrh', 'ambergris']::text[]),
    ('Atelier Cologne', 'Orange Sanguine', 'Cologne Absolue', 'citrus', array['blood orange', 'bitter orange', 'mandarin']::text[], array['geranium', 'jasmine']::text[], array['sandalwood', 'tonka', 'amber']::text[]),
    ('Acqua di Parma', 'Colonia', 'Eau de Cologne', 'citrus', array['lemon', 'bergamot', 'orange']::text[], array['lavender', 'rosemary', 'verbena', 'rose']::text[], array['vetiver', 'sandalwood', 'patchouli']::text[]),
    ('Acqua di Parma', 'Blu Mediterraneo Fico di Amalfi', 'Eau de Toilette', 'green', array['fig', 'lemon', 'bergamot', 'grapefruit']::text[], array['fig nectar', 'pink pepper', 'jasmine']::text[], array['fig wood', 'cedar', 'benzoin']::text[]),
    ('Comme des Garçons', 'Wonderwood', 'Eau de Parfum', 'woody', array['pepper', 'nutmeg']::text[], array['cedar', 'guaiac wood', 'vetiver']::text[], array['sandalwood', 'oud']::text[]),
    ('Comme des Garçons', 'Hinoki', 'Eau de Toilette', 'woody', array['camphor', 'cypress']::text[], array['hinoki wood']::text[], array['cedar', 'incense', 'vetiver']::text[]),
    ('D.S. & Durga', 'I Don''t Know What', 'Eau de Parfum', 'woody', array['citrus']::text[], array['vetiver']::text[], array['ambroxan', 'Iso E Super']::text[]),
    ('Imaginary Authors', 'A City on Fire', 'Eau de Parfum', 'woody', array['smoky notes']::text[], array['cistus']::text[], array['woods']::text[]),
    ('Imaginary Authors', 'Memoirs of a Trespasser', 'Eau de Parfum', 'amber', '{}'::text[], array['vanilla']::text[], array['guaiac wood', 'amber']::text[]),
    ('Zoologist', 'Bat', 'Extrait de Parfum', 'woody', array['fruity notes']::text[], array['earthy', 'mineral notes']::text[], array['musk', 'woods']::text[]),
    ('Phlur', 'Missing Person', 'Eau de Parfum', 'musky', array['bergamot']::text[], array['jasmine']::text[], array['musk', 'woods']::text[]),
    ('Glossier', 'You', 'Eau de Parfum', 'musky', array['pink pepper', 'iris']::text[], array['ambrette']::text[], array['ambroxan', 'musk']::text[]),
    ('Maison Louis Marie', 'No. 04 Bois de Balincourt', 'Perfume Oil', 'woody', '{}'::text[], array['vetiver']::text[], array['sandalwood', 'cedar']::text[]),
    ('Henry Rose', 'Torn', 'Eau de Parfum', 'woody', '{}'::text[], array['woods']::text[], array['musk']::text[]),
    ('Ellis Brooklyn', 'Myth', 'Eau de Parfum', 'musky', '{}'::text[], '{}'::text[], array['musk', 'woods']::text[]),
    ('Commodity', 'Book', 'Eau de Parfum', 'woody', '{}'::text[], array['woods']::text[], array['musk']::text[]),
    ('Snif', 'Cool Kids', 'Eau de Toilette', 'fresh', '{}'::text[], '{}'::text[], array['musk']::text[]),
    ('Tocca', 'Cleopatra', 'Eau de Parfum', 'amber', array['citrus']::text[], array['jasmine']::text[], array['vanilla', 'amber']::text[]),
    ('Vilhelm Parfumerie', 'Mango Skin', 'Eau de Parfum', 'fruity', array['mango']::text[], array['florals']::text[], array['musk', 'woods']::text[]),
    ('Ormonde Jayne', 'Ta''if', 'Eau de Parfum', 'floral', array['pink pepper', 'saffron']::text[], array['rose']::text[], array['amber', 'dates']::text[]),
    ('Floraiku', 'Sweet Dreams in Kyoto', 'Eau de Parfum', 'floral', '{}'::text[], array['florals']::text[], array['musk']::text[]),
    ('Eris Parfums', 'Ma Bête', 'Eau de Parfum', 'leather', array['spices']::text[], array['florals']::text[], array['leather', 'musk']::text[]),
    ('BDK Parfums', 'Gris Charnel', 'Eau de Parfum', 'woody', array['fig', 'cardamom', 'black tea']::text[], array['iris', 'vetiver']::text[], array['sandalwood', 'tonka']::text[]),
    ('Essential Parfums', 'Bois Impérial', 'Eau de Parfum', 'woody', array['basil']::text[], array['vetiver']::text[], array['akigalawood', 'woods']::text[]),
    ('Goldfield & Banks', 'Pacific Rock Moss', 'Perfume Concentrate', 'aromatic', array['lemon']::text[], array['sage', 'moss']::text[], array['cedar']::text[]),
    ('Matiere Premiere', 'Radical Rose', 'Eau de Parfum', 'floral', '{}'::text[], array['rose']::text[], array['woods', 'musk']::text[]),
    ('The Body Shop', 'White Musk', 'Eau de Toilette', 'musky', '{}'::text[], array['floral notes']::text[], array['white musk']::text[]),
    ('Clean Reserve', 'Skin', 'Eau de Parfum', 'musky', '{}'::text[], '{}'::text[], array['musk']::text[]),
    ('Pacifica', 'Tahitian Gardenia', 'Perfume', 'floral', '{}'::text[], array['gardenia', 'coconut']::text[], array['musk']::text[]),
    ('Bath & Body Works', 'Warm Vanilla Sugar', 'Fine Fragrance Mist', 'gourmand', '{}'::text[], array['vanilla']::text[], array['sugar', 'musk']::text[]),
    ('Victoria''s Secret', 'Bombshell', 'Eau de Parfum', 'fruity', array['passion fruit', 'grapefruit']::text[], array['peony', 'vanilla orchid']::text[], array['musk', 'woods']::text[]),
    ('Britney Spears', 'Fantasy', 'Eau de Parfum', 'gourmand', array['lychee', 'kiwi']::text[], array['white chocolate', 'jasmine']::text[], array['musk', 'woods']::text[]),
    ('Zara', 'Red Temptation', 'Eau de Parfum', 'amber', '{}'::text[], '{}'::text[], array['amber', 'vanilla']::text[]),
    ('Demeter', 'Paperback', 'Cologne Spray', 'woody', '{}'::text[], array['paper accord']::text[], array['woods', 'musk']::text[]),
    ('Philosophy', 'Amazing Grace', 'Eau de Toilette', 'musky', array['bergamot']::text[], array['florals']::text[], array['musk']::text[]),
    ('Elizabeth and James', 'Nirvana Black', 'Eau de Parfum', 'woody', '{}'::text[], array['violet']::text[], array['sandalwood', 'vanilla', 'musk']::text[]),
    ('Maison Margiela', 'Replica When the Rain Stops', 'Eau de Toilette', 'fresh', array['bergamot']::text[], array['aquatic notes', 'rose']::text[], array['moss', 'patchouli']::text[]),
    ('Tom Ford', 'Ébène Fumé', 'Eau de Parfum', 'woody', array['pink pepper']::text[], array['palo santo', 'incense']::text[], array['ebony wood', 'leather']::text[]),
    ('Le Labo', 'Gaiac 10', 'Eau de Parfum', 'woody', '{}'::text[], array['guaiac wood']::text[], array['musk', 'cedar']::text[]),
    ('Chanel', 'Les Exclusifs 31 Rue Cambon', 'Eau de Parfum', 'chypre', array['pepper', 'bergamot']::text[], array['iris', 'jasmine']::text[], array['patchouli', 'labdanum']::text[]),
    ('Guerlain', 'Insolence', 'Eau de Parfum', 'floral', array['red berries']::text[], array['violet', 'iris']::text[], array['tonka', 'musk']::text[]),
    ('Dior', 'Hypnotic Poison', 'Eau de Parfum', 'amber', array['almond']::text[], array['jasmine']::text[], array['vanilla', 'musk']::text[]),
    ('Yves Saint Laurent', 'Paris', 'Eau de Toilette', 'floral', array['mimosa']::text[], array['rose', 'violet']::text[], array['sandalwood', 'musk']::text[]),
    ('Hermès', 'Galop d''Hermès', 'Parfum', 'leather', array['quince']::text[], array['rose']::text[], array['leather']::text[]),
    ('Byredo', 'Super Cedar', 'Eau de Parfum', 'woody', array['pink pepper']::text[], array['cedar']::text[], array['musk', 'vetiver']::text[]),
    ('Diptyque', 'Eau Duelle', 'Eau de Toilette', 'amber', array['spices']::text[], array['black tea']::text[], array['vanilla', 'incense']::text[]),
    ('Maison Francis Kurkdjian', 'À la rose', 'Eau de Parfum', 'floral', array['bergamot', 'orange']::text[], array['rose']::text[], array['cedar', 'musk']::text[]),
    ('Frédéric Malle', 'Bigarade Concentrée', 'Eau de Parfum', 'citrus', array['bitter orange', 'grapefruit']::text[], array['rose', 'black pepper']::text[], array['cedar', 'hay']::text[]),
    ('Serge Lutens', 'Santal Majuscule', 'Eau de Parfum', 'woody', '{}'::text[], array['rose', 'cacao']::text[], array['sandalwood']::text[]),
    ('Kilian', 'Straight to Heaven', 'Eau de Parfum', 'amber', array['rum']::text[], array['patchouli', 'cedar']::text[], array['vanilla', 'amber']::text[]),
    ('Jo Malone London', 'Blackberry & Bay', 'Cologne', 'fruity', array['grapefruit']::text[], array['blackberry', 'bay leaf']::text[], array['cedar', 'woods']::text[]),
    ('Creed', 'Royal Oud', 'Eau de Parfum', 'woody', array['lemon', 'pink pepper', 'bergamot']::text[], array['cedar']::text[], array['oud', 'sandalwood', 'musk']::text[]),
    ('Parfums de Marly', 'Oriana', 'Eau de Parfum', 'gourmand', array['red fruits']::text[], array['florals']::text[], array['vanilla', 'musk']::text[])
  ) as v(brand, name, concentration, family, top, heart, base)
 where p.norm_key = public.norm_text(v.brand) || '|' || public.norm_text(v.name) || '|' || public.norm_text(v.concentration)
   and p.family is null;
-- END GENERATED NOTES
