-- Swapfume live update — 015 catch duplicate perfumes; admins can merge them
-- Same as supabase/migrations/015_duplicates.sql.
-- Safe to run more than once. Run the files in this folder in number order.

-- =====================================================================
-- Swapfume — 015: stop duplicate perfumes, and merge the ones that slipped in
-- Run AFTER 014. Safe to run more than once.
--   1. Fuzzy matching (pg_trgm): "Bacarat Rouge" finds "Baccarat Rouge 540".
--   2. Brand nicknames: "YSL" = "Yves Saint Laurent", "Jo Malone" = "Jo Malone London", "D&G" = …
--   3. Tidy names: "Sauvage EDP" is saved as "Sauvage" + "Eau de Parfum"; "Dior Sauvage" under Dior → "Sauvage".
--   4. perfume_lookup(): what the "Suggest a perfume" form shows while you type.
--   5. request_perfume() and the CSV import use the same tidying.
--   6. Admins: list likely duplicates, merge one perfume into another, or mark a pair "not a duplicate".
-- =====================================================================

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;
grant usage on schema extensions to authenticated;

-- 1. Words-with-spaces version of norm_text() (for fuzzy matching) -------------------
create or replace function public.norm_words(t text)
returns text language sql immutable as $$
  select trim(regexp_replace(
           regexp_replace(
             regexp_replace(
               translate(lower(coalesce(t, '')),
                         'àáâãäåāçćčèéêëēėęìíîïīñńòóôõöøōùúûüūýÿžźżšśłœæ',
                         'aaaaaaaccceeeeeeeiiiiinnooooooouuuuuyyzzzssloa'),
               '\m(oudh|aoud|oude)\M', 'oud', 'g'),
             '\m(misk|mousk|musc)\M', 'musk', 'g'),
           '[^a-z0-9]+', ' ', 'g'));
$$;

-- A looser brand key: ignores "and"/"&", "the", "parfums", "perfumes", "paris", "london", "fragrances".
-- "Jo Malone" = "Jo Malone London", "Memo" = "Memo Paris", "Dolce and Gabbana" = "Dolce & Gabbana".
create or replace function public.brand_key(t text)
returns text language sql immutable as $$
  select public.norm_text(regexp_replace(public.norm_words(t),
           '\m(and|the|parfums?|perfumes?|perfumery|paris|london|fragrances?|cosmetics)\M', ' ', 'g'));
$$;

-- 2. Brand nicknames -------------------------------------------------------------------
create table if not exists public.brand_aliases (
  alias_key  text primary key,   -- brand_key() of the nickname
  brand      text not null       -- the spelling the catalog uses
);
alter table public.brand_aliases enable row level security;
revoke all on public.brand_aliases from anon, authenticated;
drop policy if exists "admins manage brand aliases" on public.brand_aliases;
create policy "admins manage brand aliases" on public.brand_aliases
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.brand_aliases to authenticated;

insert into public.brand_aliases (alias_key, brand)
select public.brand_key(a), b from (values
  ('YSL', 'Yves Saint Laurent'), ('Saint Laurent', 'Yves Saint Laurent'), ('Yves St Laurent', 'Yves Saint Laurent'),
  ('Christian Dior', 'Dior'), ('Dior Parfums', 'Dior'),
  ('Armani', 'Giorgio Armani'),
  ('MFK', 'Maison Francis Kurkdjian'), ('Francis Kurkdjian', 'Maison Francis Kurkdjian'), ('Kurkdjian', 'Maison Francis Kurkdjian'),
  ('PDM', 'Parfums de Marly'), ('De Marly', 'Parfums de Marly'),
  ('JPG', 'Jean Paul Gaultier'), ('Gaultier', 'Jean Paul Gaultier'), ('Jean-Paul Gaultier', 'Jean Paul Gaultier'),
  ('CK', 'Calvin Klein'),
  ('CH', 'Carolina Herrera'),
  ('D&G', 'Dolce & Gabbana'), ('DG', 'Dolce & Gabbana'),
  ('TF', 'Tom Ford'),
  ('Bulgari', 'Bvlgari'),
  ('By Kilian', 'Kilian'), ('Kilian Paris', 'Kilian'),
  ('Rabanne', 'Paco Rabanne'),
  ('Thierry Mugler', 'Mugler'),
  ('Annick Goutal', 'Goutal'),
  ('Frederic Malle', 'Frédéric Malle'), ('Editions de Parfums Frederic Malle', 'Frédéric Malle'), ('Malle', 'Frédéric Malle'),
  ('MMM', 'Maison Margiela'), ('Margiela', 'Maison Margiela'), ('Maison Martin Margiela', 'Maison Margiela'),
  ('BDK', 'BDK Parfums'),
  ('Bond No 9', 'Bond No. 9'), ('Bond Number 9', 'Bond No. 9'), ('Bond Number Nine', 'Bond No. 9'),
  ('VS', 'Victoria''s Secret'),
  ('BBW', 'Bath & Body Works'),
  ('A&F', 'Abercrombie & Fitch'), ('Abercrombie', 'Abercrombie & Fitch'),
  ('Van Cleef', 'Van Cleef & Arpels'),
  ('DS Durga', 'D.S. & Durga'), ('DS & Durga', 'D.S. & Durga'),
  ('CDG', 'Comme des Garçons'),
  ('LV', 'Louis Vuitton'),
  ('Roja Dove', 'Roja Parfums'), ('Roja', 'Roja Parfums'),
  ('Initio Parfums Prives', 'Initio'),
  ('Dsquared', 'Dsquared2'),
  ('Nishane Istanbul', 'Nishane'),
  ('Hermes', 'Hermès'),
  ('Lancome', 'Lancôme'),
  ('Estee Lauder', 'Estée Lauder'),
  ('Chloe', 'Chloé'),
  ('Penhaligons', 'Penhaligon''s'),
  ('Boss', 'Hugo Boss'),
  ('Elizabeth & James', 'Elizabeth and James'),
  ('Viktor and Rolf', 'Viktor&Rolf'),
  ('Ralph Lauren Fragrances', 'Ralph Lauren')
) v(a, b)
on conflict (alias_key) do nothing;

-- The catalog spelling for whatever brand a member typed.
-- Nickname list first, then an existing brand with the same loose key, else the member's own spelling (trimmed).
create or replace function public.canonical_brand(t text)
returns text language plpgsql stable security definer set search_path = public as $$
declare v_key text := public.brand_key(t); v text;
begin
  if v_key = '' then return trim(coalesce(t, '')); end if;
  select brand into v from public.brand_aliases where alias_key = v_key;
  if found then return v; end if;
  select brand into v from public.perfumes
   where status = 'approved' and public.brand_key(brand) = v_key
   group by brand order by count(*) desc limit 1;
  return coalesce(v, regexp_replace(trim(coalesce(t, '')), '\s+', ' ', 'g'));
end;
$$;

-- 3. Tidy a name: pull a concentration off the end, and the brand off the front -------------
-- Returns {name, concentration}. concentration is '' when the name didn't contain one.
-- Bare "Parfum" / "Cologne" are left alone: they're often part of the real name ("Le Male Le Parfum").
create or replace function public.tidy_perfume_name(p_brand text, p_name text)
returns jsonb language plpgsql immutable as $$
declare
  v_name text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_brand text := regexp_replace(trim(coalesce(p_brand, '')), '\s+', ' ', 'g');
  m text[]; v_conc text := '';
begin
  m := regexp_match(v_name, '^(.*?)[\s,\-–—(]+(eau de parfum|eau de toilette|eau de cologne|extrait de parfum|parfum extrait|extrait|edp|edt|edc|perfume oil|attar)\)?\.?$', 'i');
  if m is not null and public.norm_text(m[1]) <> '' then
    v_name := trim(m[1]);
    v_conc := case public.norm_text(m[2])
                when 'eaudeparfum' then 'Eau de Parfum'
                when 'eaudetoilette' then 'Eau de Toilette'
                when 'eaudecologne' then 'Eau de Cologne'
                when 'extraitdeparfum' then 'Extrait de Parfum'
                when 'perfumeoilattar' then 'Perfume Oil / Attar'
                else '' end;
  end if;
  -- "Dior Sauvage" typed with brand "Dior" → "Sauvage"
  if v_brand <> '' and lower(v_name) like lower(v_brand) || ' %'
     and public.norm_text(substr(v_name, length(v_brand) + 2)) <> '' then
    v_name := trim(substr(v_name, length(v_brand) + 2));
  end if;
  return jsonb_build_object('name', v_name, 'concentration', v_conc);
end;
$$;

-- 4. Close matches for the "Suggest a perfume" form (and the admin queue) ----------------
-- Includes perfumes still waiting for approval, so two members don't suggest the same one.
create or replace function public.similar_perfumes(p_brand text, p_name text, p_exclude bigint default null)
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_brand text := public.canonical_brand(p_brand);
  v_name text := (public.tidy_perfume_name(public.canonical_brand(p_brand), p_name))->>'name';
  v_bkey text := public.brand_key(public.canonical_brand(p_brand));
  v_words text := public.norm_words(v_name);
  v_all text := public.norm_words(public.canonical_brand(p_brand) || ' ' || v_name);
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  if public.norm_text(v_name) = '' then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(to_jsonb(t) order by t.score desc, t.brand, t.name) from (
      select p.id, p.brand, p.name, p.concentration, p.year, p.status, p.image_url,
             round(greatest(
               case when public.brand_key(p.brand) = v_bkey then
                 case when public.norm_text(p.name) = public.norm_text(v_name) then 1.0
                      else greatest(similarity(public.norm_words(p.name), v_words),
                                    word_similarity(v_words, public.norm_words(p.name)) * 0.9) end
               else 0 end,
               similarity(public.norm_words(p.brand || ' ' || p.name), v_all) * 0.9
             )::numeric, 2) as score
        from public.perfumes p
       where p.status <> 'rejected' and (p_exclude is null or p.id <> p_exclude)
    ) t
    where t.score >= 0.45
    limit 8), '[]'::jsonb);
end;
$$;

-- Everything the form needs in one call, while the member types.
-- {brand, name, concentration (found in the name, or ''), similar: [...]}
create or replace function public.perfume_lookup(p_brand text, p_name text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_brand text := public.canonical_brand(p_brand); v_t jsonb;
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  v_t := public.tidy_perfume_name(v_brand, p_name);
  return jsonb_build_object('brand', v_brand, 'name', v_t->>'name', 'concentration', v_t->>'concentration',
                            'similar', public.similar_perfumes(p_brand, p_name));
end;
$$;

-- Brand names for the form's suggestions list (catalog brands + nicknames).
create or replace function public.catalog_brands()
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(brand order by lower(brand)), '{}') from (
    select distinct brand from public.perfumes where status = 'approved'
  ) b;
$$;

-- 5. request_perfume(): same tidying before the duplicate check --------------------------
create or replace function public.request_perfume(p_brand text, p_name text, p_concentration text, p_year int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_brand text := left(public.canonical_brand(p_brand), 80);
  v_t jsonb;
  v_name text;
  v_conc text := trim(coalesce(p_concentration, ''));
  v_key text;
  v_row public.perfumes;
  v_id bigint;
begin
  if not public.is_active_member() then raise exception 'Your account cannot do this right now.'; end if;
  if public.norm_text(p_brand) = '' or public.norm_text(p_name) = '' then
    raise exception 'Please fill in both the brand and the perfume name.';
  end if;
  v_t := public.tidy_perfume_name(v_brand, p_name);
  v_name := left(v_t->>'name', 120);
  if v_t->>'concentration' <> '' and (v_conc = '' or public.norm_text(v_conc) = public.norm_text(v_t->>'concentration')) then
    v_conc := v_t->>'concentration';
  elsif v_t->>'concentration' <> '' then
    v_name := left(regexp_replace(trim(p_name), '\s+', ' ', 'g'), 120);   -- the name says one thing, the menu another: keep what they typed
  end if;
  v_key := public.norm_text(v_brand) || '|' || public.norm_text(v_name) || '|' || public.norm_text(v_conc);

  select * into v_row from public.perfumes where norm_key = v_key and status <> 'rejected' limit 1;
  if not found and v_conc = '' then
    -- No concentration given: any concentration of the same perfume counts.
    select * into v_row from public.perfumes
     where brand_name_key = public.norm_text(v_brand) || '|' || public.norm_text(v_name) and status <> 'rejected'
     order by (status = 'approved') desc, id limit 1;
  end if;
  if found then
    return jsonb_build_object('result', case when v_row.status = 'approved' then 'exists' else 'already_requested' end,
                              'id', v_row.id);
  end if;

  insert into public.perfumes (brand, name, concentration, year, status, requested_by)
  values (v_brand, v_name, left(v_conc, 60), p_year, 'pending', auth.uid())
  returning id into v_id;
  return jsonb_build_object('result', 'requested', 'id', v_id);
end;
$$;

-- 6. Admin: likely duplicates, merging, "not a duplicate" -------------------------------
create table if not exists public.perfume_not_duplicates (
  a bigint not null references public.perfumes(id) on delete cascade,
  b bigint not null references public.perfumes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (a, b),
  check (a < b)
);
alter table public.perfume_not_duplicates enable row level security;
revoke all on public.perfume_not_duplicates from anon, authenticated;

create or replace function public.admin_mark_not_duplicate(p_a bigint, p_b bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  insert into public.perfume_not_duplicates (a, b) values (least(p_a, p_b), greatest(p_a, p_b))
  on conflict do nothing;
end;
$$;

-- True when two names are the same apart from one misspelled word: "Parisian Musc" / "Parisian Musk",
-- "Bacarat Rouge 540" / "Baccarat Rouge 540". Flankers ("Libre" / "Libre Intense"), numbers ("Opus VII" / "Opus VIII")
-- and short words ("for Him" / "for Her", "K" / "Q") don't count.
create or replace function public.one_word_typo(a text, b text)
returns boolean language plpgsql immutable set search_path = public, extensions as $$
declare x text[] := string_to_array(a, ' '); y text[] := string_to_array(b, ' '); i int; diff int := 0; wa text; wb text;
begin
  if a is null or b is null or a = b or cardinality(x) <> cardinality(y) then return false; end if;
  for i in 1 .. cardinality(x) loop
    if x[i] <> y[i] then diff := diff + 1; wa := x[i]; wb := y[i]; end if;
  end loop;
  return diff = 1 and length(wa) >= 4 and length(wb) >= 4
     and wa !~ '^([0-9]+|[ivxl]+)$' and wb !~ '^([0-9]+|[ivxl]+)$'
     and similarity(wa, wb) >= 0.3;
end;
$$;

-- Pairs of approved perfumes that look like the same thing:
-- same brand (nicknames count), the same name or one misspelled word, and the same concentration or one left blank.
create or replace function public.admin_find_duplicate_perfumes()
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  return coalesce((
    with p as (
      select id, brand, name, concentration, year, image_url, rating_count,
             coalesce((select a.brand from public.brand_aliases a where a.alias_key = public.brand_key(x.brand)), x.brand) as cb,
             public.norm_words(name) as w, public.norm_text(concentration) as c
        from public.perfumes x where status = 'approved'
    ), k as (select *, public.brand_key(cb) as bk from p)
    select jsonb_agg(jsonb_build_object(
             'score', round(s::numeric, 2),
             'a', jsonb_build_object('id', a_id, 'brand', a_brand, 'name', a_name, 'concentration', a_conc, 'year', a_year,
                                     'uses', (select count(*) from public.collection_items where perfume_id = a_id) + (select count(*) from public.wishlist_items where perfume_id = a_id)),
             'b', jsonb_build_object('id', b_id, 'brand', b_brand, 'name', b_name, 'concentration', b_conc, 'year', b_year,
                                     'uses', (select count(*) from public.collection_items where perfume_id = b_id) + (select count(*) from public.wishlist_items where perfume_id = b_id)))
           order by s desc, a_brand, a_name)
      from (
        select x.id a_id, x.brand a_brand, x.name a_name, x.concentration a_conc, x.year a_year,
               y.id b_id, y.brand b_brand, y.name b_name, y.concentration b_conc, y.year b_year,
               case when public.norm_text(x.name) = public.norm_text(y.name) then 1.0 else similarity(x.w, y.w) end s
          from k x join k y on x.bk = y.bk and x.id < y.id
         where (x.c = y.c or x.c = '' or y.c = '')
           and (x.w = y.w or public.norm_text(x.name) = public.norm_text(y.name)
                or public.one_word_typo(x.w, y.w))
           and not exists (select 1 from public.perfume_not_duplicates n where n.a = x.id and n.b = y.id)
         limit 200
      ) pairs), '[]'::jsonb);
end;
$$;

-- Merge p_dup into p_keep: everyone's collection items, wishlists, swaps, reviews and suggestions move
-- to p_keep, missing details (notes, family, perfumers, photo, year) are copied over, then p_dup is deleted.
-- p_use_dup_name: keep p_keep's members and history, but use p_dup's spelling of the name (when that one was right).
drop function if exists public.admin_merge_perfumes(bigint, bigint);
create or replace function public.admin_merge_perfumes(p_dup bigint, p_keep bigint, p_use_dup_name boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  d public.perfumes; k public.perfumes;
  n_items int; n_wish int; n_wish_dropped int; n_swaps int; n_reviews int; n_reviews_dropped int;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if p_dup = p_keep then raise exception 'Pick two different perfumes.'; end if;
  select * into d from public.perfumes where id = p_dup for update;
  if not found then raise exception 'The duplicate was not found (maybe it was already merged).'; end if;
  select * into k from public.perfumes where id = p_keep for update;
  if not found then raise exception 'The perfume to keep was not found.'; end if;
  if k.status = 'rejected' then raise exception 'Keep an approved perfume, not a rejected one.'; end if;

  update public.collection_items set perfume_id = p_keep where perfume_id = p_dup;
  get diagnostics n_items = row_count;
  update public.swap_items set perfume_id = p_keep where perfume_id = p_dup;
  get diagnostics n_swaps = row_count;

  -- Wishlists: one entry per member and perfume.
  delete from public.wishlist_items w where w.perfume_id = p_dup
     and exists (select 1 from public.wishlist_items x where x.user_id = w.user_id and x.perfume_id = p_keep);
  get diagnostics n_wish_dropped = row_count;
  update public.wishlist_items set perfume_id = p_keep where perfume_id = p_dup;
  get diagnostics n_wish = row_count;

  -- Perfume reviews: one per member and perfume; a member who reviewed both keeps the review on p_keep.
  delete from public.perfume_reviews r where r.perfume_id = p_dup
     and exists (select 1 from public.perfume_reviews x where x.user_id = r.user_id and x.perfume_id = p_keep);
  get diagnostics n_reviews_dropped = row_count;
  update public.perfume_reviews set perfume_id = p_keep where perfume_id = p_dup;
  get diagnostics n_reviews = row_count;

  update public.note_suggestions set perfume_id = p_keep where perfume_id = p_dup;
  update public.photo_suggestions set perfume_id = p_keep where perfume_id = p_dup;

  update public.perfumes set
    year        = coalesce(k.year, d.year),
    family      = coalesce(k.family, d.family),
    notes_top   = case when cardinality(k.notes_top) = 0 then d.notes_top else k.notes_top end,
    notes_heart = case when cardinality(k.notes_heart) = 0 then d.notes_heart else k.notes_heart end,
    notes_base  = case when cardinality(k.notes_base) = 0 then d.notes_base else k.notes_base end,
    perfumers   = case when cardinality(k.perfumers) = 0 then d.perfumers else k.perfumers end,
    image_url   = coalesce(k.image_url, d.image_url),
    image_credit = case when k.image_url is null then d.image_credit else k.image_credit end,
    is_classic  = k.is_classic or d.is_classic
  where id = p_keep;

  delete from public.perfumes where id = p_dup;
  if p_use_dup_name then
    if exists (select 1 from public.perfumes where id <> p_keep and status <> 'rejected'
                and norm_key = public.norm_text(k.brand) || '|' || public.norm_text(d.name) || '|' || public.norm_text(k.concentration)) then
      raise exception 'Another perfume already uses that name. Merge that one first.';
    end if;
    update public.perfumes set name = d.name where id = p_keep;
  end if;
  perform public.refresh_perfume_rating(p_keep);

  return jsonb_build_object('items', n_items, 'wishlists', n_wish, 'wishlists_already_there', n_wish_dropped,
                            'swaps', n_swaps, 'reviews', n_reviews, 'reviews_already_there', n_reviews_dropped);
end;
$$;

-- CSV import: same brand nicknames and name tidying as member suggestions -------------------
create or replace function public.admin_import_perfumes(p_rows jsonb, p_commit boolean, p_allow_pre2000 boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  fams constant text[] := array['floral','woody','amber','citrus','fresh','aquatic','green','fruity','gourmand','musky','leather','aromatic','chypre','fougère'];
  r jsonb; i int := 0;
  v_brand text; v_name text; v_conc text; v_year int; v_family text; v_key text; v_id bigint; v_msg text; v_t jsonb;
  seen text[] := '{}'; out jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'Expected a list of rows.'; end if;
  if jsonb_array_length(p_rows) > 1000 then raise exception 'Import at most 1,000 rows at a time.'; end if;

  for r in select value from jsonb_array_elements(p_rows) loop
    i := i + 1; v_msg := ''; v_id := null;
    v_brand := left(public.canonical_brand(r->>'brand'), 80);
    v_name  := left(trim(coalesce(r->>'name', '')), 120);
    v_conc  := left(trim(coalesce(r->>'concentration', '')), 60);
    v_conc  := case lower(regexp_replace(v_conc, '[^a-zA-Z]', '', 'g'))
                 when 'edp' then 'Eau de Parfum' when 'edt' then 'Eau de Toilette' when 'edc' then 'Eau de Cologne'
                 when 'extrait' then 'Extrait de Parfum' else v_conc end;
    if public.norm_text(v_brand) = '' or public.norm_text(v_name) = '' then
      out := out || jsonb_build_object('row', i, 'status', 'invalid', 'message', 'Brand and name are required.');
      continue;
    end if;
    v_t := public.tidy_perfume_name(v_brand, v_name);
    if v_t->>'concentration' = '' or v_conc = '' or public.norm_text(v_conc) = public.norm_text(v_t->>'concentration') then
      v_name := left(v_t->>'name', 120);
      if v_conc = '' then v_conc := v_t->>'concentration'; end if;
    end if;
    begin
      v_year := nullif(trim(coalesce(r->>'year', '')), '')::int;
    exception when others then v_year := -1; end;
    if v_year is not null and (v_year < 1700 or v_year > 2100) then
      out := out || jsonb_build_object('row', i, 'status', 'invalid', 'message', 'Year looks off.');
      continue;
    end if;
    v_family := lower(trim(coalesce(r->>'family', '')));
    if v_family = 'fougere' then v_family := 'fougère'; end if;
    if v_family = '' then v_family := null;
    elsif not v_family = any(fams) then v_msg := 'Unknown family "' || v_family || '" left empty.'; v_family := null; end if;

    v_key := public.norm_text(v_brand) || '|' || public.norm_text(v_name) || '|' || public.norm_text(v_conc);
    if v_key = any(seen) then
      out := out || jsonb_build_object('row', i, 'status', 'duplicate_in_file', 'message', 'Same perfume appears earlier in this file.');
      continue;
    end if;
    seen := seen || v_key;
    select id into v_id from public.perfumes where norm_key = v_key and status <> 'rejected' limit 1;
    if found then
      out := out || jsonb_build_object('row', i, 'status', 'exists', 'id', v_id, 'message', 'Already in the catalog.');
      continue;
    end if;
    if v_year is not null and v_year < 2000 and not p_allow_pre2000 then
      out := out || jsonb_build_object('row', i, 'status', 'pre2000', 'message', 'Released before 2000 — skipped unless you allow classics.');
      continue;
    end if;
    if p_commit then
      insert into public.perfumes (brand, name, concentration, year, status, is_classic, family, notes_top, notes_heart, notes_base, perfumers)
      values (v_brand, v_name, v_conc, v_year, 'approved', coalesce(v_year < 2000, false), v_family,
              (select coalesce(array_agg(left(trim(x), 60)), '{}') from (select x from jsonb_array_elements_text(coalesce(r->'notes_top', '[]')) x where trim(x) <> '' limit 15) t),
              (select coalesce(array_agg(left(trim(x), 60)), '{}') from (select x from jsonb_array_elements_text(coalesce(r->'notes_heart', '[]')) x where trim(x) <> '' limit 15) t),
              (select coalesce(array_agg(left(trim(x), 60)), '{}') from (select x from jsonb_array_elements_text(coalesce(r->'notes_base', '[]')) x where trim(x) <> '' limit 15) t),
              (select coalesce(array_agg(left(trim(x), 80)), '{}') from (select x from jsonb_array_elements_text(coalesce(r->'perfumers', '[]')) x where trim(x) <> '' limit 8) t))
      on conflict (norm_key) where status <> 'rejected' do nothing
      returning id into v_id;
      out := out || jsonb_build_object('row', i, 'status', case when v_id is null then 'exists' else 'added' end, 'id', v_id, 'message', v_msg);
    else
      out := out || jsonb_build_object('row', i, 'status', 'new', 'message', v_msg);
    end if;
  end loop;
  return out;
end;
$$;

-- Who may call what ------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'similar_perfumes(text,text,bigint)', 'perfume_lookup(text,text)', 'catalog_brands()',
    'request_perfume(text,text,text,integer)',
    'admin_mark_not_duplicate(bigint,bigint)', 'admin_find_duplicate_perfumes()', 'admin_merge_perfumes(bigint,bigint,boolean)',
    'admin_import_perfumes(jsonb,boolean,boolean)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  -- helpers used inside the functions above
  foreach f in array array['canonical_brand(text)'] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;
