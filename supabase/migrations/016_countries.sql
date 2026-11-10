-- =====================================================================
-- Swapfume — 016: more countries (United States, Canada, Romania)
-- Run AFTER 015. Safe to run more than once.
--   1. Every member has a swap country (profiles.country_code: US, CA or RO).
--      Existing members are US. New members pick theirs at sign-up.
--      Members change it only through set_my_country() (not while a swap is open).
--   2. Swaps (and gifts) only between members of the same country —
--      perfume can't be mailed across borders. Enforced by a trigger on swaps.
--   3. Postal codes for each country: US ZIP (5 digits), Canadian FSA
--      (first 3 characters, e.g. M5V), Romanian code (6 digits). Still private.
--      Distances only between members of the same country.
--   4. "Bring Swapfume to my country": a waitlist anyone can join; only admins read it.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Swap country on each profile
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists country_code text not null default 'US';
do $$ begin
  alter table public.profiles add constraint profiles_country_code_check check (country_code in ('US', 'CA', 'RO'));
exception when duplicate_object then null; end $$;
-- Not in the member-editable column list (002 grants update on display_name, city, country, bio only).

create or replace function public.country_name(p_code text)
returns text language sql immutable as $$
  select case p_code when 'US' then 'United States' when 'CA' then 'Canada' when 'RO' then 'Romania' end;
$$;

-- Sign-up: the app sends country_code in the sign-up details (older app versions don't: they get US).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_birth date;
  v_adult boolean;
  v_cc text;
begin
  begin
    v_birth := nullif(trim(new.raw_user_meta_data ->> 'birthdate'), '')::date;
  exception when others then
    v_birth := null;
  end;
  if v_birth is not null and not public.is_adult_birthdate(v_birth) then
    raise exception 'You must be 18 or older to join Swapfume.';
  end if;
  v_adult := v_birth is not null or coalesce((new.raw_user_meta_data ->> 'adult_ok')::boolean, false);
  v_cc := upper(coalesce(nullif(trim(new.raw_user_meta_data ->> 'country_code'), ''), 'US'));
  if v_cc not in ('US', 'CA', 'RO') then v_cc := 'US'; end if;
  insert into public.profiles (id, display_name, adult_confirmed_at, country_code, country)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)), 40),
    case when v_adult then now() end,
    v_cc,
    public.country_name(v_cc)
  );
  return new;
end;
$$;

-- Moving country: allowed only with no swap in progress. The old postal code no longer fits, so it is removed.
create or replace function public.set_my_country(p_code text)
returns void language plpgsql security definer set search_path = public as $$
declare v_cc text := upper(trim(coalesce(p_code, '')));
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  if v_cc not in ('US', 'CA', 'RO') then raise exception 'Swapfume is open in the United States, Canada and Romania.'; end if;
  if v_cc = (select country_code from public.profiles where id = auth.uid()) then return; end if;
  if exists (select 1 from public.swaps
              where auth.uid() in (proposer_id, recipient_id) and status in ('proposed', 'accepted')) then
    raise exception 'Finish or cancel your open swaps before changing country.';
  end if;
  update public.profiles set country_code = v_cc, country = public.country_name(v_cc) where id = auth.uid();
  delete from public.private_locations where user_id = auth.uid();
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Same-country swaps only (covers propose_swap and offer_gift)
-- ---------------------------------------------------------------------
create or replace function public.swaps_same_country()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.proposer_id is not null and new.recipient_id is not null and
     (select country_code from public.profiles where id = new.proposer_id)
       is distinct from (select country_code from public.profiles where id = new.recipient_id) then
    raise exception 'Swaps are only between members in the same country — perfume can''t be mailed across borders.';
  end if;
  return new;
end;
$$;
drop trigger if exists swaps_same_country on public.swaps;
create trigger swaps_same_country before insert on public.swaps
  for each row execute function public.swaps_same_country();

-- ---------------------------------------------------------------------
-- 3. Postal codes for every open country
-- ---------------------------------------------------------------------
alter table public.private_locations drop constraint if exists private_locations_zip_check;
alter table public.private_locations drop constraint if exists private_locations_lat_check;
alter table public.private_locations drop constraint if exists private_locations_lon_check;
do $$ begin
  alter table public.private_locations add constraint private_locations_zip_check
    check (zip ~ '^[0-9]{5}$' or zip ~ '^[A-Z][0-9][A-Z]$' or zip ~ '^[0-9]{6}$');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.private_locations add constraint private_locations_lat_check check (lat between -90 and 90);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.private_locations add constraint private_locations_lon_check check (lon between -180 and 180);
exception when duplicate_object then null; end $$;

-- The app looks the code up in its public list and sends the centre point; the format and
-- rough area must match the member's country.
create or replace function public.set_my_location(p_zip text, p_lat numeric, p_lon numeric)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_cc text;
  v_zip text := upper(replace(trim(coalesce(p_zip, '')), ' ', ''));
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  select country_code into v_cc from public.profiles where id = auth.uid();
  if v_cc = 'CA' then
    v_zip := left(v_zip, 3);
    if v_zip !~ '^[A-Z][0-9][A-Z]$' then raise exception 'Please enter a Canadian postal code, like M5V 3L9.'; end if;
    if p_lat is null or p_lon is null or p_lat not between 41 and 84 or p_lon not between -142 and -52 then
      raise exception 'We couldn''t find that postal code.';
    end if;
  elsif v_cc = 'RO' then
    if v_zip !~ '^[0-9]{6}$' then raise exception 'Please enter a 6-digit Romanian postal code.'; end if;
    if p_lat is null or p_lon is null or p_lat not between 43 and 49 or p_lon not between 20 and 30 then
      raise exception 'We couldn''t find that postal code.';
    end if;
  else
    if v_zip !~ '^[0-9]{5}$' then raise exception 'Please enter a 5-digit US ZIP code.'; end if;
    if p_lat is null or p_lon is null or p_lat not between 17 and 72 or p_lon not between -180 and -64 then
      raise exception 'We couldn''t find that ZIP code.';
    end if;
  end if;
  insert into public.private_locations (user_id, zip, lat, lon, updated_at)
  values (auth.uid(), v_zip, round(p_lat, 2), round(p_lon, 2), now())
  on conflict (user_id) do update set zip = excluded.zip, lat = excluded.lat, lon = excluded.lon, updated_at = now();
end;
$$;

-- Distances only to members in the same country (same rounding as 011).
create or replace function public.member_distances(p_user_ids uuid[])
returns table (user_id uuid, miles int)
language sql stable security definer set search_path = public as $$
  select b.user_id,
         case when d <= 20 then greatest(1, round(d))::int else (round(d / 5) * 5)::int end
    from public.private_locations a
    join public.profiles pa on pa.id = a.user_id
    join public.private_locations b on b.user_id = any(p_user_ids) and b.user_id <> a.user_id
    join public.profiles pb on pb.id = b.user_id and pb.country_code = pa.country_code
    cross join lateral (select public.miles_between(a.lat, a.lon, b.lat, b.lon) as d) x
   where a.user_id = auth.uid() and d <= 50 and not public.is_blocked_with(b.user_id);
$$;

-- Meet-up distance (used by propose_swap / offer_gift): same country only.
create or replace function public.distance_to(p_other uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select public.miles_between(a.lat, a.lon, b.lat, b.lon)
    from public.private_locations a
    join public.profiles pa on pa.id = a.user_id,
         public.private_locations b
    join public.profiles pb on pb.id = b.user_id
   where a.user_id = auth.uid() and b.user_id = p_other and pa.country_code = pb.country_code;
$$;

-- ---------------------------------------------------------------------
-- 4. "Bring Swapfume to my country" waitlist
-- ---------------------------------------------------------------------
create table if not exists public.country_requests (
  id         bigint generated always as identity primary key,
  email      text not null check (char_length(email) between 5 and 200),
  country    text not null check (char_length(country) between 2 and 60),
  created_at timestamptz not null default now()
);
create unique index if not exists country_requests_once on public.country_requests (lower(email), lower(country));
alter table public.country_requests enable row level security;
revoke all on public.country_requests from anon, authenticated;
grant select, delete on public.country_requests to authenticated;
drop policy if exists "admins read country requests" on public.country_requests;
create policy "admins read country requests" on public.country_requests
  for select to authenticated using (public.is_admin());
drop policy if exists "admins delete country requests" on public.country_requests;
create policy "admins delete country requests" on public.country_requests
  for delete to authenticated using (public.is_admin());

-- Anyone (signed in or not) can ask. Asking twice for the same country is fine (kept once).
create or replace function public.request_country(p_email text, p_country text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_country text := trim(regexp_replace(coalesce(p_country, ''), '\s+', ' ', 'g'));
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 200 then
    raise exception 'Please enter a valid email address.';
  end if;
  if char_length(v_country) not between 2 and 60 then raise exception 'Please choose your country.'; end if;
  if (select count(*) from public.country_requests where lower(email) = v_email) >= 5 then return; end if;
  insert into public.country_requests (email, country) values (v_email, v_country)
  on conflict do nothing;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array['set_my_country(text)', 'set_my_location(text,numeric,numeric)', 'member_distances(uuid[])'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  execute 'revoke execute on function public.request_country(text,text) from public';
  execute 'grant execute on function public.request_country(text,text) to anon, authenticated';
  execute 'revoke execute on function public.distance_to(uuid) from public, anon, authenticated';
  execute 'revoke execute on function public.swaps_same_country() from public, anon, authenticated';
end $$;
