-- =====================================================================
-- Swapfume — 006: bigger catalog, classics, smarter duplicate check
-- Run AFTER 005. Safe on a database that already has the first seed:
--   * marks pre-2000 classics (is_classic = true)
--   * removes pre-2000 starter-catalog perfumes that are NOT on the classics list,
--     but only if no member uses them (collections, wishlists, swaps, note suggestions)
--   * adds the new perfumes; anything already there is skipped (no duplicates)
--   * duplicate check now treats spelling variants as the same:
--       "Oudh" / "Aoud" / "Oude" = "Oud", "Misk" = "Musk", "Al-Haramain" = "Al Haramain",
--       "EDP" = "Eau de Parfum", "EDT", "EDC", "Extrait", and "Attar" / "Perfume Oil" = "Perfume Oil / Attar"
-- Running it twice does no harm.
-- =====================================================================

-- 1. "Classic" flag (true for pre-2000 perfumes kept in the catalog) -------------
alter table public.perfumes add column if not exists is_classic boolean not null default false;

-- 2. Smarter normalising for the duplicate check -------------------------------------
create or replace function public.norm_text(t text)
returns text
language sql
immutable
as $$
  select case x
           when 'edp' then 'eaudeparfum'
           when 'edt' then 'eaudetoilette'
           when 'edc' then 'eaudecologne'
           when 'cologne' then 'eaudecologne'
           when 'extrait' then 'extraitdeparfum'
           when 'parfumextrait' then 'extraitdeparfum'
           when 'attar' then 'perfumeoilattar'
           when 'ittar' then 'perfumeoilattar'
           when 'itr' then 'perfumeoilattar'
           when 'perfumeoil' then 'perfumeoilattar'
           when 'oil' then 'perfumeoilattar'
           when 'concentratedperfumeoil' then 'perfumeoilattar'
           else x
         end
  from (
    select regexp_replace(
             regexp_replace(
               regexp_replace(
                 translate(lower(coalesce(t, '')),
                           'àáâãäåāçćčèéêëēėęìíîïīñńòóôõöøōùúûüūýÿžźżšśłœæ',
                           'aaaaaaaccceeeeeeeiiiiinnooooooouuuuuyyzzzssloa'),
                 '\m(oudh|aoud|oude)\M', 'oud', 'g'),
               '\m(misk|mousk)\M', 'musk', 'g'),
             '[^a-z0-9]+', '', 'g') as x
  ) s;
$$;

-- Recompute the stored keys with the new rules (updating a row refreshes them).
update public.perfumes set brand = brand;

-- 3. Admin approval also sets the Classic flag for pre-2000 suggestions ---------------
create or replace function public.admin_review_perfume(p_id bigint, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  update public.perfumes
     set status = case when p_approve then 'approved' else 'rejected' end,
         is_classic = case when p_approve then coalesce(year < 2000, false) else is_classic end
   where id = p_id and status = 'pending';
end;
$$;

-- 4. Catalog data (generated from js/catalog-seed.js + js/catalog/*.js) -----------------
-- BEGIN GENERATED CATALOG
-- a) Mark the classics that are already in the catalog.
update public.perfumes p set is_classic = true
  from (values
    ('Chanel', 'No. 5', 'Eau de Parfum'),
    ('Chanel', 'Égoïste Platinum', 'Eau de Toilette'),
    ('Dior', 'J''adore', 'Eau de Parfum'),
    ('Dior', 'Hypnotic Poison', 'Eau de Toilette'),
    ('Dior', 'Poison', 'Eau de Toilette'),
    ('Dior', 'Fahrenheit', 'Eau de Toilette'),
    ('Dior', 'Eau Sauvage', 'Eau de Toilette'),
    ('Guerlain', 'Shalimar', 'Eau de Parfum'),
    ('Guerlain', 'Mitsouko', 'Eau de Toilette'),
    ('Guerlain', 'L''Heure Bleue', 'Eau de Parfum'),
    ('Guerlain', 'Habit Rouge', 'Eau de Toilette'),
    ('Guerlain', 'Vetiver', 'Eau de Toilette'),
    ('Yves Saint Laurent', 'Opium', 'Eau de Parfum'),
    ('Yves Saint Laurent', 'Kouros', 'Eau de Toilette'),
    ('Lancôme', 'Trésor', 'Eau de Parfum'),
    ('Giorgio Armani', 'Acqua di Giò', 'Eau de Toilette'),
    ('Diptyque', 'Philosykos', 'Eau de Toilette'),
    ('Diptyque', 'L''Ombre dans L''Eau', 'Eau de Toilette'),
    ('Creed', 'Green Irish Tweed', 'Eau de Parfum'),
    ('Creed', 'Silver Mountain Water', 'Eau de Parfum'),
    ('Jo Malone London', 'Lime Basil & Mandarin', 'Cologne'),
    ('Serge Lutens', 'Ambre Sultan', 'Eau de Parfum'),
    ('Serge Lutens', 'Féminité du Bois', 'Eau de Parfum'),
    ('Serge Lutens', 'Fleurs d''Oranger', 'Eau de Parfum'),
    ('L''Artisan Parfumeur', 'Mûre et Musc', 'Eau de Toilette'),
    ('L''Artisan Parfumeur', 'Passage d''Enfer', 'Eau de Toilette'),
    ('Mugler', 'Angel', 'Eau de Parfum'),
    ('Mugler', 'A*Men', 'Eau de Toilette'),
    ('Jean Paul Gaultier', 'Le Male', 'Eau de Toilette'),
    ('Jean Paul Gaultier', 'Classique', 'Eau de Toilette'),
    ('Carolina Herrera', '212 Men', 'Eau de Toilette'),
    ('Givenchy', 'Π (Pi)', 'Eau de Toilette'),
    ('Calvin Klein', 'CK One', 'Eau de Toilette'),
    ('Calvin Klein', 'Eternity', 'Eau de Parfum'),
    ('Calvin Klein', 'Obsession', 'Eau de Parfum'),
    ('Estée Lauder', 'Beautiful', 'Eau de Parfum'),
    ('Estée Lauder', 'Youth Dew', 'Eau de Parfum'),
    ('Estée Lauder', 'Pleasures', 'Eau de Parfum'),
    ('Clinique', 'Happy', 'Eau de Parfum'),
    ('Clinique', 'Aromatics Elixir', 'Parfum de Toilette'),
    ('Elizabeth Arden', 'Red Door', 'Eau de Toilette'),
    ('Elizabeth Arden', 'Green Tea', 'Eau de Parfum'),
    ('Davidoff', 'Cool Water', 'Eau de Toilette'),
    ('Azzaro', 'Pour Homme', 'Eau de Toilette'),
    ('Issey Miyake', 'L''Eau d''Issey', 'Eau de Toilette'),
    ('Issey Miyake', 'L''Eau d''Issey Pour Homme', 'Eau de Toilette'),
    ('Cacharel', 'Anaïs Anaïs', 'Eau de Toilette'),
    ('Nina Ricci', 'L''Air du Temps', 'Eau de Toilette'),
    ('Hugo Boss', 'Boss Bottled', 'Eau de Toilette'),
    ('Ralph Lauren', 'Polo Green', 'Eau de Toilette'),
    ('Acqua di Parma', 'Colonia', 'Eau de Cologne'),
    ('The Body Shop', 'White Musk', 'Eau de Toilette'),
    ('Philosophy', 'Amazing Grace', 'Eau de Toilette'),
    ('Yves Saint Laurent', 'Paris', 'Eau de Toilette'),
    ('Chanel', 'No. 19', 'Eau de Parfum'),
    ('Chanel', 'Coco', 'Eau de Parfum'),
    ('Chanel', 'Cristalle', 'Eau de Toilette'),
    ('Chanel', 'Allure', 'Eau de Parfum'),
    ('Chanel', 'Allure Homme', 'Eau de Toilette'),
    ('Chanel', 'Antaeus', 'Eau de Toilette'),
    ('Chanel', 'Pour Monsieur', 'Eau de Toilette'),
    ('Chanel', 'Égoïste', 'Eau de Toilette'),
    ('Chanel', 'Bois des Îles', 'Eau de Parfum'),
    ('Chanel', 'Cuir de Russie', 'Eau de Parfum'),
    ('Chanel', 'No. 22', 'Eau de Parfum'),
    ('Dior', 'Dune', 'Eau de Toilette'),
    ('Guerlain', 'Jicky', 'Eau de Toilette'),
    ('Guerlain', 'Vol de Nuit', 'Eau de Toilette'),
    ('Yves Saint Laurent', 'Rive Gauche', 'Eau de Toilette'),
    ('Hermès', 'Eau d''Orange Verte', 'Eau de Cologne'),
    ('Lanvin', 'Arpège', 'Eau de Parfum'),
    ('Aramis', 'Aramis', 'Eau de Toilette'),
    ('Guy Laroche', 'Drakkar Noir', 'Eau de Toilette'),
    ('Calvin Klein', 'Obsession for Men', 'Eau de Toilette'),
    ('Calvin Klein', 'Eternity for Men', 'Eau de Toilette'),
    ('Calvin Klein', 'CK Be', 'Eau de Toilette'),
    ('Estée Lauder', 'White Linen', 'Eau de Parfum'),
    ('Elizabeth Arden', 'Sunflowers', 'Eau de Toilette'),
    ('Elizabeth Arden', '5th Avenue', 'Eau de Parfum'),
    ('Ralph Lauren', 'Romance', 'Eau de Parfum'),
    ('Tommy Hilfiger', 'Tommy', 'Eau de Toilette'),
    ('Tommy Hilfiger', 'Tommy Girl', 'Eau de Toilette'),
    ('Donna Karan', 'Cashmere Mist', 'Eau de Toilette'),
    ('Bvlgari', 'Eau Parfumée au Thé Vert', 'Eau de Cologne'),
    ('Bvlgari', 'Pour Homme', 'Eau de Toilette'),
    ('Cartier', 'Déclaration', 'Eau de Toilette'),
    ('Cartier', 'Pasha de Cartier', 'Eau de Toilette'),
    ('Van Cleef & Arpels', 'First', 'Eau de Parfum'),
    ('Lolita Lempicka', 'Lolita Lempicka', 'Eau de Parfum'),
    ('Rochas', 'Eau de Rochas', 'Eau de Toilette'),
    ('Caron', 'Pour un Homme de Caron', 'Eau de Toilette'),
    ('Penhaligon''s', 'Blenheim Bouquet', 'Eau de Toilette'),
    ('Floris', 'No. 89', 'Eau de Toilette'),
    ('Goutal', 'Eau d''Hadrien', 'Eau de Parfum'),
    ('Goutal', 'Petite Chérie', 'Eau de Parfum'),
    ('Davidoff', 'Cool Water Woman', 'Eau de Toilette'),
    ('Hugo Boss', 'Hugo', 'Eau de Toilette'),
    ('Azzaro', 'Chrome', 'Eau de Toilette'),
    ('Kenzo', 'Kenzo pour Homme', 'Eau de Toilette'),
    ('Paco Rabanne', 'Pour Homme', 'Eau de Toilette'),
    ('Sisley', 'Eau du Soir', 'Eau de Parfum'),
    ('Creed', 'Millésime Impérial', 'Eau de Parfum'),
    ('Amouage', 'Gold Woman', 'Eau de Parfum'),
    ('Amouage', 'Gold Man', 'Eau de Parfum'),
    ('Creed', 'Bois du Portugal', 'Eau de Parfum'),
    ('Serge Lutens', 'Iris Silver Mist', 'Eau de Parfum'),
    ('Serge Lutens', 'Tubéreuse Criminelle', 'Eau de Parfum'),
    ('Serge Lutens', 'Muscs Koublaï Khän', 'Eau de Parfum'),
    ('Serge Lutens', 'Bois de Violette', 'Eau de Parfum'),
    ('Serge Lutens', 'Cuir Mauresque', 'Eau de Parfum'),
    ('L''Artisan Parfumeur', 'Premier Figuier', 'Eau de Toilette'),
    ('L''Artisan Parfumeur', 'La Chasse aux Papillons', 'Eau de Toilette'),
    ('Goutal', 'Sables', 'Eau de Parfum'),
    ('Avon', 'Far Away', 'Parfum')
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
-- END GENERATED CATALOG
