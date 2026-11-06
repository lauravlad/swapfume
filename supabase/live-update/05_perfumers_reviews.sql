-- Swapfume live update — 009 perfumers, perfume reviews, CSV import (schema only)
-- Same as supabase/migrations/009_perfumers_reviews.sql without its catalog data.
-- Safe to run more than once. Run the files in this folder in number order.

-- =====================================================================
-- Swapfume — 009: perfumers, perfume reviews, admin bulk import, bigger catalog
--   1. perfumes.perfumers (the "nose"), searchable; members can suggest it
--      through the same correction queue as notes.
--   2. perfume_reviews: members rate a perfume 1–5 with optional text and quick
--      tags (longevity, sillage, seasons, day/night). One per member per perfume.
--      "Helpful" votes. Moderated through reports + admin hide. Average stars
--      are kept on the perfume so lists can sort by rating.
--      NO sample reviews are added here — real members write them.
--   3. admin_import_perfumes(): CSV bulk import with preview (dry run),
--      using the same normalization and duplicate check as everything else.
--   4. Perfumer names for catalog perfumes (generated; only where we're sure).
-- Safe to run more than once. Run after 001–008.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Perfumers
-- ---------------------------------------------------------------------
-- "Francis Kurkdjian, Olivier Polge" — lets search use a simple text match.
create or replace function public.perfumers_text(a text[])
returns text language sql immutable as $$ select coalesce(array_to_string(a, ', '), '') $$;

alter table public.perfumes add column if not exists perfumers text[] not null default '{}';
alter table public.perfumes add column if not exists perfumers_search text
  generated always as (public.perfumers_text(perfumers)) stored;
do $$ begin
  alter table public.perfumes add constraint perfumes_perfumers_size_check check (cardinality(perfumers) <= 8);
exception when duplicate_object then null; end $$;
create index if not exists perfumes_perfumers_idx on public.perfumes using gin (perfumers);

alter table public.note_suggestions add column if not exists perfumers text[] not null default '{}';
do $$ begin
  alter table public.note_suggestions add constraint note_suggestions_perfumers_size_check check (cardinality(perfumers) <= 8);
exception when duplicate_object then null; end $$;

-- Approving a suggestion: notes change only if the suggestion has notes,
-- perfumers only if it names perfumers.
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
           notes_top   = case when cardinality(s.notes_top) + cardinality(s.notes_heart) + cardinality(s.notes_base) > 0 then s.notes_top else notes_top end,
           notes_heart = case when cardinality(s.notes_top) + cardinality(s.notes_heart) + cardinality(s.notes_base) > 0 then s.notes_heart else notes_heart end,
           notes_base  = case when cardinality(s.notes_top) + cardinality(s.notes_heart) + cardinality(s.notes_base) > 0 then s.notes_base else notes_base end,
           perfumers   = case when cardinality(s.perfumers) > 0 then s.perfumers else perfumers end
     where id = s.perfume_id;
  end if;
  update public.note_suggestions set status = case when p_approve then 'approved' else 'rejected' end where id = p_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Perfume reviews
-- ---------------------------------------------------------------------
alter table public.perfumes add column if not exists rating_avg numeric(3,2);
alter table public.perfumes add column if not exists rating_count int not null default 0;
create index if not exists perfumes_rating_idx on public.perfumes (rating_avg desc nulls last, rating_count desc);

create table if not exists public.perfume_reviews (
  id            bigint generated always as identity primary key,
  perfume_id    bigint not null references public.perfumes(id) on delete cascade,
  user_id       uuid default auth.uid() references public.profiles(id) on delete set null,  -- null = "Former member"
  rating        int not null check (rating between 1 and 5),
  body          text not null default '' check (char_length(body) <= 1000),
  longevity     text check (longevity in ('weak', 'moderate', 'long-lasting', 'beast')),
  sillage       text check (sillage in ('intimate', 'moderate', 'strong')),
  seasons       text[] not null default '{}' check (seasons <@ array['spring', 'summer', 'fall', 'winter']),
  daytimes      text[] not null default '{}' check (daytimes <@ array['day', 'night']),
  helpful_count int not null default 0,
  is_hidden     boolean not null default false,   -- an admin can hide a reported review
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (perfume_id, user_id)
);
create index if not exists perfume_reviews_perfume_idx on public.perfume_reviews (perfume_id, created_at desc);
create index if not exists perfume_reviews_user_idx on public.perfume_reviews (user_id);

create table if not exists public.perfume_review_votes (
  review_id   bigint not null references public.perfume_reviews(id) on delete cascade,
  user_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (review_id, user_id)
);
create index if not exists perfume_review_votes_user_idx on public.perfume_review_votes (user_id);

-- Is this member banned? (Lets the rules hide banned members' reviews.)
create or replace function public.is_banned_user(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_banned from public.profiles where id = p_user), false);
$$;

alter table public.perfume_reviews enable row level security;
alter table public.perfume_review_votes enable row level security;
revoke all on public.perfume_reviews, public.perfume_review_votes from anon;

-- Read: your own, or (admin), or visible ones from members who aren't banned
-- and with whom there's no block either way. Deleted members' reviews stay visible.
drop policy if exists "read perfume reviews" on public.perfume_reviews;
create policy "read perfume reviews" on public.perfume_reviews
  for select to authenticated using (
    user_id = auth.uid() or public.is_admin()
    or (not is_hidden and (user_id is null or (not public.is_banned_user(user_id) and not public.is_blocked_with(user_id))))
  );
drop policy if exists "write own perfume review" on public.perfume_reviews;
create policy "write own perfume review" on public.perfume_reviews
  for insert to authenticated with check (
    user_id = auth.uid() and public.is_active_member() and not is_hidden and helpful_count = 0
    and exists (select 1 from public.perfumes p where p.id = perfume_id and p.status = 'approved')
  );
drop policy if exists "edit own perfume review" on public.perfume_reviews;
create policy "edit own perfume review" on public.perfume_reviews
  for update to authenticated using (user_id = auth.uid() and public.is_active_member()) with check (user_id = auth.uid());
drop policy if exists "delete own perfume review" on public.perfume_reviews;
create policy "delete own perfume review" on public.perfume_reviews
  for delete to authenticated using (user_id = auth.uid());
revoke update on public.perfume_reviews from authenticated;
grant update (rating, body, longevity, sillage, seasons, daytimes, updated_at) on public.perfume_reviews to authenticated;

drop policy if exists "read helpful votes" on public.perfume_review_votes;
create policy "read helpful votes" on public.perfume_review_votes
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "vote helpful" on public.perfume_review_votes;
create policy "vote helpful" on public.perfume_review_votes
  for insert to authenticated with check (
    user_id = auth.uid() and public.is_active_member()
    and exists (select 1 from public.perfume_reviews r where r.id = review_id and r.user_id is distinct from auth.uid())
  );
drop policy if exists "remove own vote" on public.perfume_review_votes;
create policy "remove own vote" on public.perfume_review_votes
  for delete to authenticated using (user_id = auth.uid());
revoke update on public.perfume_review_votes from authenticated;

-- Keep the perfume's average and count current (visible reviews by non-banned members).
create or replace function public.refresh_perfume_rating(p_perfume bigint)
returns void language sql security definer set search_path = public as $$
  update public.perfumes p
     set rating_avg = s.avg, rating_count = s.n
    from (select round(avg(r.rating)::numeric, 2) as avg, count(*)::int as n
            from public.perfume_reviews r
            left join public.profiles u on u.id = r.user_id
           where r.perfume_id = p_perfume and not r.is_hidden and not coalesce(u.is_banned, false)) s
   where p.id = p_perfume;
$$;

create or replace function public.perfume_reviews_changed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then perform public.refresh_perfume_rating(old.perfume_id); end if;
  if tg_op in ('INSERT', 'UPDATE') then perform public.refresh_perfume_rating(new.perfume_id); end if;
  return null;
end;
$$;
drop trigger if exists perfume_reviews_rating on public.perfume_reviews;
create trigger perfume_reviews_rating after insert or delete or update of rating, is_hidden, perfume_id
  on public.perfume_reviews for each row execute function public.perfume_reviews_changed();

-- Bans change which reviews count.
create or replace function public.profile_ban_changed()
returns trigger language plpgsql security definer set search_path = public as $$
declare v bigint;
begin
  if new.is_banned is distinct from old.is_banned then
    for v in select distinct perfume_id from public.perfume_reviews where user_id = new.id loop
      perform public.refresh_perfume_rating(v);
    end loop;
  end if;
  return null;
end;
$$;
drop trigger if exists profiles_ban_rating on public.profiles;
create trigger profiles_ban_rating after update of is_banned on public.profiles
  for each row execute function public.profile_ban_changed();

create or replace function public.perfume_review_votes_changed()
returns trigger language plpgsql security definer set search_path = public as $$
declare v bigint := coalesce(new.review_id, old.review_id);
begin
  update public.perfume_reviews set helpful_count = (select count(*) from public.perfume_review_votes where review_id = v) where id = v;
  return null;
end;
$$;
drop trigger if exists perfume_review_votes_count on public.perfume_review_votes;
create trigger perfume_review_votes_count after insert or delete on public.perfume_review_votes
  for each row execute function public.perfume_review_votes_changed();

-- Moderation: reports can point at a perfume review; admins can hide/unhide it.
alter table public.reports add column if not exists target_perfume_review_id bigint
  references public.perfume_reviews(id) on delete set null;

create or replace function public.admin_set_perfume_review_hidden(p_review bigint, p_hidden boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  update public.perfume_reviews set is_hidden = p_hidden where id = p_review;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Admin bulk import (CSV → JSON rows from the app)
-- p_rows: [{brand, name, concentration, year, family, notes_top[], notes_heart[], notes_base[], perfumers[]}, ...]
-- p_commit = false → preview only. Returns one result per row:
--   {row, status: new | added | exists | duplicate_in_file | pre2000 | invalid, message, id}
-- Pre-2000 rows are skipped unless p_allow_pre2000 (they're then marked Classic).
-- ---------------------------------------------------------------------
create or replace function public.admin_import_perfumes(p_rows jsonb, p_commit boolean, p_allow_pre2000 boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  fams constant text[] := array['floral','woody','amber','citrus','fresh','aquatic','green','fruity','gourmand','musky','leather','aromatic','chypre','fougère'];
  r jsonb; i int := 0;
  v_brand text; v_name text; v_conc text; v_year int; v_family text; v_key text; v_id bigint; v_msg text;
  seen text[] := '{}'; out jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'Expected a list of rows.'; end if;
  if jsonb_array_length(p_rows) > 1000 then raise exception 'Import at most 1,000 rows at a time.'; end if;

  for r in select value from jsonb_array_elements(p_rows) loop
    i := i + 1; v_msg := ''; v_id := null;
    v_brand := left(trim(coalesce(r->>'brand', '')), 80);
    v_name  := left(trim(coalesce(r->>'name', '')), 120);
    v_conc  := left(trim(coalesce(r->>'concentration', '')), 60);
    v_conc  := case lower(regexp_replace(v_conc, '[^a-zA-Z]', '', 'g'))
                 when 'edp' then 'Eau de Parfum' when 'edt' then 'Eau de Toilette' when 'edc' then 'Eau de Cologne'
                 when 'extrait' then 'Extrait de Parfum' else v_conc end;
    if public.norm_text(v_brand) = '' or public.norm_text(v_name) = '' then
      out := out || jsonb_build_object('row', i, 'status', 'invalid', 'message', 'Brand and name are required.');
      continue;
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

do $$
declare f text;
begin
  foreach f in array array[
    'admin_review_note_suggestion(bigint,boolean)', 'admin_set_perfume_review_hidden(bigint,boolean)',
    'admin_import_perfumes(jsonb,boolean,boolean)', 'is_banned_user(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  -- internal helpers: not callable from the app
  foreach f in array array['refresh_perfume_rating(bigint)'] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 4. Catalog additions and perfumer names (generated by tools/make-seed-sql.js)
-- ---------------------------------------------------------------------
-- (catalog data: see the numbered catalog files in this folder)

-- (catalog data: see the numbered catalog files in this folder)
