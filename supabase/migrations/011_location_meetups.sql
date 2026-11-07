-- =====================================================================
-- Swapfume — 011: location (by ZIP code) and meeting in person
--   * Each member may save their ZIP code. It is private, like the address:
--     only the member can read it. Others only ever get a rounded distance.
--   * member_distances() tells a signed-in member roughly how far other
--     members are (only up to 50 miles; nothing for blocked members).
--   * A swap can be "mail" (as before) or "meetup" when the two members are
--     20 miles or less apart. Meet-ups share no addresses; the two agree on a
--     public place and time in the swap's meeting plan, then each confirms
--     "we met and swapped".
-- Safe to run more than once. Run after 001–010.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Private location (ZIP code + its rounded centre point)
-- ---------------------------------------------------------------------
create table if not exists public.private_locations (
  user_id    uuid primary key default auth.uid() references public.profiles(id) on delete cascade,
  zip        text not null check (zip ~ '^[0-9]{5}$'),
  lat        numeric(5,2) not null check (lat between 17 and 72),
  lon        numeric(6,2) not null check (lon between -180 and -64),
  updated_at timestamptz not null default now()
);
alter table public.private_locations enable row level security;
revoke all on public.private_locations from anon;
drop policy if exists "read own location" on public.private_locations;
create policy "read own location" on public.private_locations
  for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.private_locations from authenticated;

-- The app looks the ZIP code up in the public Census list and sends its centre point.
create or replace function public.set_my_location(p_zip text, p_lat numeric, p_lon numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  if p_zip is null or p_zip !~ '^[0-9]{5}$' then raise exception 'Please enter a 5-digit US ZIP code.'; end if;
  if p_lat is null or p_lon is null or p_lat not between 17 and 72 or p_lon not between -180 and -64 then
    raise exception 'We couldn''t find that ZIP code.';
  end if;
  insert into public.private_locations (user_id, zip, lat, lon, updated_at)
  values (auth.uid(), p_zip, round(p_lat, 2), round(p_lon, 2), now())
  on conflict (user_id) do update set zip = excluded.zip, lat = excluded.lat, lon = excluded.lon, updated_at = now();
end;
$$;

create or replace function public.clear_my_location()
returns void language sql security definer set search_path = public as $$
  delete from public.private_locations where user_id = auth.uid();
$$;

-- Great-circle distance in miles.
create or replace function public.miles_between(lat1 numeric, lon1 numeric, lat2 numeric, lon2 numeric)
returns numeric language sql immutable as $$
  select 3958.8 * 2 * asin(least(1, sqrt(
    power(sin(radians((lat2 - lat1)::float8) / 2), 2)
    + cos(radians(lat1::float8)) * cos(radians(lat2::float8)) * power(sin(radians((lon2 - lon1)::float8) / 2), 2)
  )))::numeric;
$$;

-- Distance between the signed-in member and a pair partner, unrounded (internal use).
create or replace function public.distance_to(p_other uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select public.miles_between(a.lat, a.lon, b.lat, b.lon)
    from public.private_locations a, public.private_locations b
   where a.user_id = auth.uid() and b.user_id = p_other;
$$;

-- Rounded distances to other members: nearest mile up to 20, nearest 5 miles up to 50,
-- nothing beyond 50 miles, nothing for blocked members.
create or replace function public.member_distances(p_user_ids uuid[])
returns table (user_id uuid, miles int)
language sql stable security definer set search_path = public as $$
  select b.user_id,
         case when d <= 20 then greatest(1, round(d))::int else (round(d / 5) * 5)::int end
    from public.private_locations a
    join public.private_locations b on b.user_id = any(p_user_ids) and b.user_id <> a.user_id
    cross join lateral (select public.miles_between(a.lat, a.lon, b.lat, b.lon) as d) x
   where a.user_id = auth.uid() and d <= 50 and not public.is_blocked_with(b.user_id);
$$;

-- ---------------------------------------------------------------------
-- 2. Swap method: by mail (default) or meeting in person
-- ---------------------------------------------------------------------
alter table public.swaps add column if not exists method text not null default 'mail';
do $$ begin
  alter table public.swaps add constraint swaps_method_check check (method in ('mail', 'meetup'));
exception when duplicate_object then null; end $$;
alter table public.swaps add column if not exists meet_plan text not null default '';
do $$ begin
  alter table public.swaps add constraint swaps_meet_plan_len check (char_length(meet_plan) <= 300);
exception when duplicate_object then null; end $$;
alter table public.swaps add column if not exists meet_plan_by uuid references public.profiles(id) on delete set null;
alter table public.swaps add column if not exists meet_plan_at timestamptz;

-- Addresses are shared only for swaps by mail.
drop policy if exists "read own or accepted partner address" on public.private_addresses;
create policy "read own or accepted partner address" on public.private_addresses
  for select to authenticated using (
    user_id = auth.uid()
    or exists (
      select 1 from public.swaps s
      where s.status in ('accepted', 'completed') and s.method = 'mail'
        and ((s.proposer_id = auth.uid() and s.recipient_id = private_addresses.user_id)
          or (s.recipient_id = auth.uid() and s.proposer_id = private_addresses.user_id))
    )
  );

-- propose_swap with a method. (The 4-argument version from 008 stays for older app versions = mail.)
create or replace function public.propose_swap(p_recipient uuid, p_my_items bigint[], p_their_items bigint[], p_message text, p_method text)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_swap bigint;
  v_count int;
  v_method text := coalesce(nullif(p_method, ''), 'mail');
  v_miles numeric;
begin
  if not public.is_active_member() then raise exception 'Your account cannot do this right now.'; end if;
  if v_method not in ('mail', 'meetup') then raise exception 'Choose mail or meeting in person.'; end if;
  if p_recipient = auth.uid() then raise exception 'You cannot swap with yourself.'; end if;
  if exists (select 1 from public.profiles where id = p_recipient and is_banned)
     or not exists (select 1 from public.profiles where id = p_recipient)
     or public.is_blocked_with(p_recipient) then
    raise exception 'This member is not available for swaps.';
  end if;
  if coalesce(array_length(p_my_items, 1), 0) = 0 or coalesce(array_length(p_their_items, 1), 0) = 0 then
    raise exception 'Pick at least one item from each side.';
  end if;
  if v_method = 'mail' and not exists (select 1 from public.private_addresses where user_id = auth.uid()) then
    raise exception 'Add your shipping address in your profile first (it stays private until a swap is accepted).';
  end if;
  if v_method = 'meetup' then
    v_miles := public.distance_to(p_recipient);
    if v_miles is null then raise exception 'Meeting in person needs both of you to add a ZIP code under Me.'; end if;
    if v_miles > 20 then raise exception 'Meeting in person is for members 20 miles or less apart.'; end if;
  end if;

  select count(*) into v_count from public.collection_items
   where id = any(p_my_items) and owner_id = auth.uid() and tradeable and not is_hidden;
  if v_count <> array_length(p_my_items, 1) then raise exception 'Some of your items are not available for trade.'; end if;

  select count(*) into v_count from public.collection_items
   where id = any(p_their_items) and owner_id = p_recipient and tradeable and not is_hidden;
  if v_count <> array_length(p_their_items, 1) then raise exception 'Some of their items are no longer available.'; end if;

  insert into public.swaps (proposer_id, recipient_id, message, method)
  values (auth.uid(), p_recipient, left(coalesce(p_message, ''), 600), v_method)
  returning id into v_swap;

  insert into public.swap_items (swap_id, item_id, from_user_id, perfume_id, size, volume_ml)
  select v_swap, ci.id, ci.owner_id, ci.perfume_id, ci.size, ci.volume_ml
    from public.collection_items ci
   where ci.id = any(p_my_items) or ci.id = any(p_their_items);

  return v_swap;
end;
$$;

-- Accepting: an address is needed only for swaps by mail.
create or replace function public.respond_swap(p_swap bigint, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v public.swaps;
begin
  select * into v from public.swaps where id = p_swap for update;
  if not found or v.recipient_id is distinct from auth.uid() then raise exception 'Only the person who received this proposal can answer it.'; end if;
  if v.status <> 'proposed' then raise exception 'This proposal has already been answered.'; end if;
  if p_accept then
    if not public.is_active_member() then raise exception 'Your account cannot do this right now.'; end if;
    if v.proposer_id is null or public.is_blocked_with(v.proposer_id) then raise exception 'This member is not available for swaps.'; end if;
    if v.method = 'mail' and not exists (select 1 from public.private_addresses where user_id = auth.uid()) then
      raise exception 'Add your shipping address in your profile before accepting.';
    end if;
  end if;
  update public.swaps set status = case when p_accept then 'accepted' else 'declined' end, updated_at = now() where id = p_swap;
end;
$$;

-- Either side writes the meeting plan (place, day, time) once the swap is accepted.
create or replace function public.set_meet_plan(p_swap bigint, p_plan text)
returns void language plpgsql security definer set search_path = public as $$
declare v public.swaps;
begin
  select * into v from public.swaps where id = p_swap for update;
  if not found or auth.uid() not in (v.proposer_id, v.recipient_id) then raise exception 'Not your swap.'; end if;
  if v.method <> 'meetup' then raise exception 'This swap is by mail.'; end if;
  if v.status <> 'accepted' then raise exception 'You can plan the meet-up once the swap is accepted.'; end if;
  update public.swaps set meet_plan = left(trim(coalesce(p_plan, '')), 300), meet_plan_by = auth.uid(), meet_plan_at = now(), updated_at = now()
   where id = p_swap;
end;
$$;

-- "We met up and swapped": each side confirms; when both have, the swap is completed.
create or replace function public.mark_met(p_swap bigint)
returns void language plpgsql security definer set search_path = public as $$
declare v public.swaps;
begin
  select * into v from public.swaps where id = p_swap for update;
  if not found or auth.uid() not in (v.proposer_id, v.recipient_id) then raise exception 'Not your swap.'; end if;
  if v.method <> 'meetup' then raise exception 'This swap is by mail.'; end if;
  if v.status <> 'accepted' then raise exception 'This swap is not in progress.'; end if;
  if v.proposer_id = auth.uid() then
    update public.swaps set proposer_shipped_at = coalesce(proposer_shipped_at, now()), proposer_received_at = coalesce(proposer_received_at, now()), updated_at = now() where id = p_swap;
  else
    update public.swaps set recipient_shipped_at = coalesce(recipient_shipped_at, now()), recipient_received_at = coalesce(recipient_received_at, now()), updated_at = now() where id = p_swap;
  end if;
  update public.swaps set status = 'completed', updated_at = now()
   where id = p_swap and proposer_received_at is not null and recipient_received_at is not null;
end;
$$;

-- Mail-only steps refuse meet-up swaps (keeps the two flows apart).
create or replace function public.mark_shipped(p_swap bigint)
returns void language plpgsql security definer set search_path = public as $$
declare v public.swaps;
begin
  select * into v from public.swaps where id = p_swap for update;
  if not found or auth.uid() not in (v.proposer_id, v.recipient_id) then raise exception 'Not your swap.'; end if;
  if v.method = 'meetup' then raise exception 'This swap is a meet-up — confirm when you have met.'; end if;
  if v.status <> 'accepted' then raise exception 'You can mark shipping only on an accepted swap.'; end if;
  if v.proposer_id = auth.uid() then
    update public.swaps set proposer_shipped_at = coalesce(proposer_shipped_at, now()), updated_at = now() where id = p_swap;
  else
    update public.swaps set recipient_shipped_at = coalesce(recipient_shipped_at, now()), updated_at = now() where id = p_swap;
  end if;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'set_my_location(text,numeric,numeric)', 'clear_my_location()', 'member_distances(uuid[])',
    'propose_swap(uuid,bigint[],bigint[],text,text)', 'respond_swap(bigint,boolean)',
    'set_meet_plan(bigint,text)', 'mark_met(bigint)', 'mark_shipped(bigint)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  -- internal helper: not callable from the app
  execute 'revoke execute on function public.distance_to(uuid) from public, anon, authenticated';
end $$;
