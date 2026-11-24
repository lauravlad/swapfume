-- =====================================================================
-- Swapfume — 024: every member photo of a perfume is kept under that perfume
-- Run AFTER 023. Safe to run more than once.
--   * perfume_photos: a gallery per perfume. A photo lands here automatically
--     when a member adds or changes a listing photo, or posts a photo tagged
--     with a perfume. It stays when the listing or post is deleted (it goes
--     only when the member deletes their account, removes the photo, or an
--     admin hides/removes it).
--   * perfumes.member_photo_url: the newest visible member photo, kept up to
--     date by triggers, so tiles and lists can show a real photo when there's
--     no catalog picture.
--   * Members see photos unless hidden or from someone they blocked / who
--     blocked them. Members can delete their own; admins can hide or delete.
--   * reports.target_perfume_photo_id: "Report this photo".
-- =====================================================================

create table if not exists public.perfume_photos (
  id          bigint generated always as identity primary key,
  perfume_id  bigint not null references public.perfumes(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  image_url   text not null check (char_length(image_url) <= 500),
  source      text not null default 'listing' check (source in ('listing', 'post')),
  is_hidden   boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (perfume_id, image_url)
);
create index if not exists perfume_photos_perfume_idx on public.perfume_photos (perfume_id, created_at desc);
create index if not exists perfume_photos_user_idx on public.perfume_photos (user_id);

alter table public.perfumes add column if not exists member_photo_url text;

alter table public.perfume_photos enable row level security;
revoke all on public.perfume_photos from anon, authenticated;
grant select, delete on public.perfume_photos to authenticated;
drop policy if exists "see perfume photos" on public.perfume_photos;
create policy "see perfume photos" on public.perfume_photos for select to authenticated
  using (public.is_admin() or user_id = auth.uid()
         or (public.is_active_member() and not is_hidden and not public.is_blocked_with(user_id)));
drop policy if exists "delete own perfume photo" on public.perfume_photos;
create policy "delete own perfume photo" on public.perfume_photos for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Keep perfumes.member_photo_url = newest visible photo from a member in good standing.
create or replace function public.refresh_member_photo(p_perfume bigint)
returns void language sql security definer set search_path = public as $$
  update public.perfumes set member_photo_url = (
    select ph.image_url from public.perfume_photos ph join public.profiles pr on pr.id = ph.user_id
     where ph.perfume_id = p_perfume and not ph.is_hidden and not pr.is_banned
     order by ph.created_at desc limit 1)
   where id = p_perfume;
$$;

create or replace function public.perfume_photos_changed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then perform public.refresh_member_photo(old.perfume_id); end if;
  if tg_op in ('INSERT', 'UPDATE') and (tg_op = 'INSERT' or new.perfume_id <> old.perfume_id) then perform public.refresh_member_photo(new.perfume_id); end if;
  return null;
end;
$$;
drop trigger if exists perfume_photos_changed on public.perfume_photos;
create trigger perfume_photos_changed after insert or update or delete on public.perfume_photos
  for each row execute function public.perfume_photos_changed();

-- Only photos stored in the member's own folder are copied (the same rule as uploads).
create or replace function public.is_own_photo_url(p_url text, p_user uuid)
returns boolean language sql immutable as $$
  select p_url is not null and position('/bottle-photos/' || p_user::text || '/' in p_url) > 0;
$$;

-- Listing photo added or changed -> keep it under the perfume.
create or replace function public.items_keep_photo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.photo_url is not null and public.is_own_photo_url(new.photo_url, new.owner_id)
     and (tg_op = 'INSERT' or new.photo_url is distinct from old.photo_url or new.perfume_id <> old.perfume_id) then
    insert into public.perfume_photos (perfume_id, user_id, image_url, source)
    values (new.perfume_id, new.owner_id, new.photo_url, 'listing') on conflict (perfume_id, image_url) do nothing;
  end if;
  return null;
end;
$$;
drop trigger if exists items_keep_photo on public.collection_items;
create trigger items_keep_photo after insert or update of photo_url, perfume_id on public.collection_items
  for each row execute function public.items_keep_photo();

-- Post with a photo and a perfume tag -> keep it under the perfume.
create or replace function public.posts_keep_photo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.photo_url is not null and new.perfume_id is not null and public.is_own_photo_url(new.photo_url, new.author_id) then
    insert into public.perfume_photos (perfume_id, user_id, image_url, source)
    values (new.perfume_id, new.author_id, new.photo_url, 'post') on conflict (perfume_id, image_url) do nothing;
  end if;
  return null;
end;
$$;
drop trigger if exists posts_keep_photo on public.posts;
create trigger posts_keep_photo after insert on public.posts
  for each row execute function public.posts_keep_photo();

-- A ban hides that member's photos from the "newest photo" choice (and unbanning brings them back).
create or replace function public.profiles_ban_refresh_photos()
returns trigger language plpgsql security definer set search_path = public as $$
declare pid bigint;
begin
  if new.is_banned is distinct from old.is_banned then
    for pid in select distinct perfume_id from public.perfume_photos where user_id = new.id loop
      perform public.refresh_member_photo(pid);
    end loop;
  end if;
  return null;
end;
$$;
drop trigger if exists profiles_ban_refresh_photos on public.profiles;
create trigger profiles_ban_refresh_photos after update of is_banned on public.profiles
  for each row execute function public.profiles_ban_refresh_photos();

create or replace function public.admin_set_perfume_photo_hidden(p_id bigint, p_hidden boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  update public.perfume_photos set is_hidden = p_hidden where id = p_id;
end;
$$;

alter table public.reports add column if not exists target_perfume_photo_id bigint references public.perfume_photos(id) on delete set null;

-- Bring in the photos members have already uploaded.
insert into public.perfume_photos (perfume_id, user_id, image_url, source, created_at)
select i.perfume_id, i.owner_id, i.photo_url, 'listing', i.created_at
  from public.collection_items i
 where i.photo_url is not null and public.is_own_photo_url(i.photo_url, i.owner_id)
on conflict (perfume_id, image_url) do nothing;
insert into public.perfume_photos (perfume_id, user_id, image_url, source, created_at)
select p.perfume_id, p.author_id, p.photo_url, 'post', p.created_at
  from public.posts p
 where p.photo_url is not null and p.perfume_id is not null and public.is_own_photo_url(p.photo_url, p.author_id)
on conflict (perfume_id, image_url) do nothing;
update public.perfumes pf set member_photo_url = (
  select ph.image_url from public.perfume_photos ph join public.profiles pr on pr.id = ph.user_id
   where ph.perfume_id = pf.id and not ph.is_hidden and not pr.is_banned order by ph.created_at desc limit 1)
 where exists (select 1 from public.perfume_photos ph where ph.perfume_id = pf.id);

-- Merging duplicates (migration 015, extended): community posts and member photos
-- follow the perfume that is kept, instead of losing their tag or being deleted.
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
  update public.posts set perfume_id = p_keep where perfume_id = p_dup;
  delete from public.perfume_photos ph where ph.perfume_id = p_dup
     and exists (select 1 from public.perfume_photos x where x.perfume_id = p_keep and x.image_url = ph.image_url);
  update public.perfume_photos set perfume_id = p_keep where perfume_id = p_dup;

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
  perform public.refresh_member_photo(p_keep);

  return jsonb_build_object('items', n_items, 'wishlists', n_wish, 'wishlists_already_there', n_wish_dropped,
                            'swaps', n_swaps, 'reviews', n_reviews, 'reviews_already_there', n_reviews_dropped);
end;
$$;

do $$
begin
  execute 'revoke execute on function public.admin_merge_perfumes(bigint,bigint,boolean) from public, anon';
  execute 'grant execute on function public.admin_merge_perfumes(bigint,bigint,boolean) to authenticated';
  execute 'revoke execute on function public.admin_set_perfume_photo_hidden(bigint,boolean) from public, anon';
  execute 'grant execute on function public.admin_set_perfume_photo_hidden(bigint,boolean) to authenticated';
  execute 'revoke execute on function public.refresh_member_photo(bigint) from public, anon, authenticated';
  execute 'revoke execute on function public.perfume_photos_changed() from public, anon, authenticated';
  execute 'revoke execute on function public.items_keep_photo() from public, anon, authenticated';
  execute 'revoke execute on function public.posts_keep_photo() from public, anon, authenticated';
  execute 'revoke execute on function public.profiles_ban_refresh_photos() from public, anon, authenticated';
end $$;
