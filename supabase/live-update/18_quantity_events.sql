-- Swapfume live update — 017 how many you have; community meetups
-- Same as supabase/migrations/017_quantity_events.sql.
-- Safe to run more than once. Run the files in this folder in number order.

-- =====================================================================
-- Swapfume — 017: how many you have, and community meetups
-- Run AFTER 016. Safe to run more than once.
--   1. Each listing has a quantity ("5 vials"). A proposal or gift can ask for
--      several of one listing. When a swap or gift is ACCEPTED, each side's
--      listings go down by the number shared; at 0 the listing stops being
--      open to trade. Older app versions keep working (they share 1 each).
--   2. Community meetups (events): members organize perfume get-togethers in a
--      public place — share, decant, sniff, swap. No money. Members of the same
--      country see them, say "I'm going" and comment. Admins can hide them.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Quantities
-- ---------------------------------------------------------------------
alter table public.collection_items add column if not exists quantity int not null default 1;
do $$ begin
  alter table public.collection_items add constraint collection_items_quantity_check check (quantity between 0 and 99);
exception when duplicate_object then null; end $$;
-- Members set quantity on their own listings (002 lets owners insert/update their rows).
grant update (quantity) on public.collection_items to authenticated;

alter table public.swap_items add column if not exists quantity int not null default 1;
do $$ begin
  alter table public.swap_items add constraint swap_items_quantity_check check (quantity between 1 and 99);
exception when duplicate_object then null; end $$;

-- Sets how many of each listing a just-created proposal includes (internal helper).
create or replace function public.apply_swap_quantities(p_swap bigint, p_items bigint[], p_qty int[])
returns void language plpgsql security definer set search_path = public as $$
declare i int; q int; have int;
begin
  if p_qty is null then return; end if;
  if coalesce(array_length(p_qty, 1), 0) <> coalesce(array_length(p_items, 1), 0) then
    raise exception 'Something went wrong with the amounts. Please try again.';
  end if;
  for i in 1 .. coalesce(array_length(p_items, 1), 0) loop
    q := coalesce(p_qty[i], 1);
    select quantity into have from public.collection_items where id = p_items[i];
    if q < 1 or q > 99 then raise exception 'Choose an amount between 1 and 99.'; end if;
    if have is null or q > have then raise exception 'There aren''t that many available of one of the perfumes.'; end if;
    update public.swap_items set quantity = q where swap_id = p_swap and item_id = p_items[i];
  end loop;
end;
$$;

-- Same as propose_swap / offer_gift, plus how many of each listing.
create or replace function public.propose_swap_qty(p_recipient uuid, p_my_items bigint[], p_their_items bigint[],
  p_message text, p_method text, p_my_qty int[], p_their_qty int[])
returns bigint language plpgsql security definer set search_path = public as $$
declare v bigint;
begin
  v := public.propose_swap(p_recipient, p_my_items, p_their_items, p_message, p_method);
  perform public.apply_swap_quantities(v, p_my_items, p_my_qty);
  perform public.apply_swap_quantities(v, p_their_items, p_their_qty);
  return v;
end;
$$;

create or replace function public.offer_gift_qty(p_recipient uuid, p_my_items bigint[], p_message text, p_method text, p_my_qty int[])
returns bigint language plpgsql security definer set search_path = public as $$
declare v bigint;
begin
  v := public.offer_gift(p_recipient, p_my_items, p_message, p_method);
  perform public.apply_swap_quantities(v, p_my_items, p_my_qty);
  return v;
end;
$$;

-- When a swap or gift is accepted, take the shared amounts off each listing.
create or replace function public.swaps_take_quantities()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if new.status = 'accepted' and old.status = 'proposed' then
    for r in select si.item_id, si.quantity, p.brand, p.name
               from public.swap_items si join public.perfumes p on p.id = si.perfume_id
              where si.swap_id = new.id and si.item_id is not null
              order by si.item_id loop
      update public.collection_items
         set quantity = quantity - r.quantity,
             tradeable = tradeable and quantity - r.quantity > 0
       where id = r.item_id and quantity >= r.quantity;
      if not found then
        raise exception 'Not enough left of % %: it may have been swapped already.', r.brand, r.name;
      end if;
    end loop;
  end if;
  return new;
end;
$$;
drop trigger if exists swaps_take_quantities on public.swaps;
create trigger swaps_take_quantities after update of status on public.swaps
  for each row execute function public.swaps_take_quantities();

-- A listing with none left is not open to trade.
create or replace function public.collection_items_zero_not_tradeable()
returns trigger language plpgsql as $$
begin
  if new.quantity = 0 then new.tradeable := false; end if;
  return new;
end;
$$;
drop trigger if exists collection_items_zero_not_tradeable on public.collection_items;
create trigger collection_items_zero_not_tradeable before insert or update on public.collection_items
  for each row execute function public.collection_items_zero_not_tradeable();

-- ---------------------------------------------------------------------
-- 2. Community meetups
-- ---------------------------------------------------------------------
create table if not exists public.events (
  id            bigint generated always as identity primary key,
  organizer_id  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  country_code  text not null check (country_code in ('US', 'CA', 'RO')),
  title         text not null check (char_length(title) between 3 and 100),
  description   text not null default '' check (char_length(description) <= 2000),
  city          text not null check (char_length(city) between 2 and 80),
  place         text not null check (char_length(place) between 3 and 200),
  starts_at     timestamptz not null,
  max_people    int check (max_people between 2 and 500),
  status        text not null default 'active' check (status in ('active', 'cancelled')),
  is_hidden     boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists events_country_time_idx on public.events (country_code, starts_at);

create table if not exists public.event_attendees (
  event_id   bigint not null references public.events(id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create table if not exists public.event_comments (
  id         bigint generated always as identity primary key,
  event_id   bigint not null references public.events(id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 600),
  created_at timestamptz not null default now()
);
create index if not exists event_comments_event_idx on public.event_comments (event_id, created_at);

-- Who may see an event: signed-in, not banned, not blocked with the organizer; hidden ones only
-- for the organizer and admins.
create or replace function public.can_see_event(p_event bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.events e
     where e.id = p_event and auth.uid() is not null
       and (e.organizer_id = auth.uid() or public.is_admin()
            or (public.is_active_member() and not e.is_hidden and not public.is_blocked_with(e.organizer_id)))
  );
$$;

alter table public.events enable row level security;
alter table public.event_attendees enable row level security;
alter table public.event_comments enable row level security;
revoke all on public.events, public.event_attendees, public.event_comments from anon, authenticated;
grant select on public.events, public.event_attendees, public.event_comments to authenticated;
grant delete on public.event_comments to authenticated;

drop policy if exists "see events" on public.events;
create policy "see events" on public.events for select to authenticated using (public.can_see_event(id));
drop policy if exists "see attendees" on public.event_attendees;
create policy "see attendees" on public.event_attendees for select to authenticated using (public.can_see_event(event_id));
drop policy if exists "see comments" on public.event_comments;
create policy "see comments" on public.event_comments for select to authenticated
  using (public.can_see_event(event_id) and not public.is_blocked_with(user_id));
drop policy if exists "delete own comment" on public.event_comments;
create policy "delete own comment" on public.event_comments for delete to authenticated
  using (user_id = auth.uid() or public.is_admin()
         or exists (select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid()));

-- Create or edit (organizer only). Country is the organizer's; the time must be in the future.
create or replace function public.save_event(p_id bigint, p_title text, p_description text, p_city text,
  p_place text, p_starts_at timestamptz, p_max_people int)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_cc text;
begin
  if not public.is_active_member() then raise exception 'Your account cannot do this right now.'; end if;
  if p_starts_at is null or p_starts_at < now() then raise exception 'Pick a date and time in the future.'; end if;
  if p_starts_at > now() + interval '1 year' then raise exception 'Pick a date within the next year.'; end if;
  if p_max_people is not null and (p_max_people < 2 or p_max_people > 500) then raise exception 'Maximum people must be between 2 and 500.'; end if;
  select country_code into v_cc from public.profiles where id = auth.uid();
  if p_id is null then
    if (select count(*) from public.events where organizer_id = auth.uid() and status = 'active' and starts_at > now()) >= 5 then
      raise exception 'You already have 5 upcoming events.';
    end if;
    insert into public.events (organizer_id, country_code, title, description, city, place, starts_at, max_people)
    values (auth.uid(), v_cc, trim(p_title), trim(coalesce(p_description, '')), trim(p_city), trim(p_place), p_starts_at, p_max_people)
    returning id into v_id;
    insert into public.event_attendees (event_id, user_id) values (v_id, auth.uid());
  else
    update public.events set title = trim(p_title), description = trim(coalesce(p_description, '')), city = trim(p_city),
           place = trim(p_place), starts_at = p_starts_at, max_people = p_max_people
     where id = p_id and organizer_id = auth.uid() and status = 'active'
    returning id into v_id;
    if v_id is null then raise exception 'Only the organizer can edit this event.'; end if;
  end if;
  return v_id;
end;
$$;

create or replace function public.cancel_event(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.events set status = 'cancelled' where id = p_id and organizer_id = auth.uid() and status = 'active';
  if not found then raise exception 'Only the organizer can cancel this event.'; end if;
end;
$$;

-- "I'm going" / "Not going". Same country only; respects the maximum.
create or replace function public.join_event(p_id bigint, p_going boolean)
returns void language plpgsql security definer set search_path = public as $$
declare e public.events;
begin
  if not public.is_active_member() then raise exception 'Your account cannot do this right now.'; end if;
  select * into e from public.events where id = p_id for update;
  if not found or not public.can_see_event(p_id) then raise exception 'Event not found.'; end if;
  if not p_going then
    if e.organizer_id = auth.uid() then raise exception 'You are the organizer. Cancel the event instead.'; end if;
    delete from public.event_attendees where event_id = p_id and user_id = auth.uid();
    return;
  end if;
  if e.status <> 'active' or e.starts_at < now() then raise exception 'This event is no longer open.'; end if;
  if e.country_code <> (select country_code from public.profiles where id = auth.uid()) then
    raise exception 'This event is in another country.';
  end if;
  if e.max_people is not null and (select count(*) from public.event_attendees where event_id = p_id) >= e.max_people
     and not exists (select 1 from public.event_attendees where event_id = p_id and user_id = auth.uid()) then
    raise exception 'This event is full.';
  end if;
  insert into public.event_attendees (event_id, user_id) values (p_id, auth.uid()) on conflict do nothing;
end;
$$;

create or replace function public.comment_event(p_id bigint, p_body text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_active_member() then raise exception 'Your account cannot do this right now.'; end if;
  if not public.can_see_event(p_id) then raise exception 'Event not found.'; end if;
  if char_length(trim(coalesce(p_body, ''))) = 0 then raise exception 'Write something first.'; end if;
  if (select count(*) from public.event_comments where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'That''s a lot of comments. Please wait a little.';
  end if;
  insert into public.event_comments (event_id, user_id, body) values (p_id, auth.uid(), left(trim(p_body), 600));
end;
$$;

create or replace function public.admin_set_event_hidden(p_id bigint, p_hidden boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  update public.events set is_hidden = p_hidden where id = p_id;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'propose_swap_qty(uuid,bigint[],bigint[],text,text,int[],int[])', 'offer_gift_qty(uuid,bigint[],text,text,int[])',
    'save_event(bigint,text,text,text,text,timestamptz,int)', 'cancel_event(bigint)', 'join_event(bigint,boolean)',
    'comment_event(bigint,text)', 'admin_set_event_hidden(bigint,boolean)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  execute 'revoke execute on function public.apply_swap_quantities(bigint,bigint[],int[]) from public, anon, authenticated';
  execute 'revoke execute on function public.swaps_take_quantities() from public, anon, authenticated';
  execute 'revoke execute on function public.can_see_event(bigint) from public, anon';
  execute 'grant execute on function public.can_see_event(bigint) to authenticated';
end $$;
