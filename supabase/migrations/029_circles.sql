-- =====================================================================
-- Swapfume — 029: pass-arounds and sample giveaways ("circles")
-- Run AFTER 028. Safe to run more than once.
--   * Pass-around: a host sends one bottle on a journey. Members join; when the host starts it,
--     the route is fixed in joining order and ends back with the host. Each person takes the
--     agreed small amount, then posts it on. Only the person holding the bottle sees ONE address:
--     the next person's (circle_next_address), never the whole list.
--   * Giveaway: a host offers free samples. Members enter until the closing time; the draw picks
--     winners at random. The host then sends each winner a gift through the usual gift flow.
--   * Everything is changed through the functions below (no direct writes), and each step
--     notifies the right people (kinds added to notifications).
-- =====================================================================

create table if not exists public.circles (
  id           bigint generated always as identity primary key,
  host_id      uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind         text not null check (kind in ('passaround', 'giveaway')),
  country_code text not null,
  title        text not null check (char_length(title) between 3 and 100),
  description  text not null default '' check (char_length(description) <= 1500),
  perfume_id   bigint not null references public.perfumes(id),
  size         text not null default 'sample' check (size in ('sample', 'decant', 'full')),
  amount       text not null default '' check (char_length(amount) <= 60),   -- e.g. "take up to 2 ml", "2 ml sample"
  spots        int not null check (spots between 1 and 50),                    -- pass-around: people; giveaway: prizes
  ends_at      timestamptz,                                                    -- giveaway: entries close
  status       text not null default 'open' check (status in ('open', 'running', 'done', 'cancelled')),
  current_pos  int,                                                            -- pass-around: who holds the bottle (0 = host)
  is_hidden    boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists circles_country_time_idx on public.circles (country_code, created_at desc);
create index if not exists circles_host_idx on public.circles (host_id);

create table if not exists public.circle_members (
  circle_id    bigint not null references public.circles(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  joined_at    timestamptz not null default now(),
  position     int,              -- pass-around route, set at start (host = 0)
  received_at  timestamptz,
  sent_at      timestamptz,
  won          boolean not null default false,
  primary key (circle_id, user_id)
);
create index if not exists circle_members_user_idx on public.circle_members (user_id);

alter table public.circles enable row level security;
alter table public.circle_members enable row level security;
revoke all on public.circles, public.circle_members from anon, authenticated;
grant select on public.circles, public.circle_members to authenticated;

create or replace function public.can_see_circle(p_circle bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.circles c
    where c.id = p_circle and auth.uid() is not null
      and (c.host_id = auth.uid()
           or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
           or exists (select 1 from public.circle_members m where m.circle_id = c.id and m.user_id = auth.uid())
           or (public.is_active_member() and not c.is_hidden and not public.is_blocked_with(c.host_id)
               and c.country_code = (select country_code from public.profiles where id = auth.uid()))));
$$;
drop policy if exists "see circles" on public.circles;
create policy "see circles" on public.circles for select to authenticated using (public.can_see_circle(id));
drop policy if exists "see circle members" on public.circle_members;
create policy "see circle members" on public.circle_members for select to authenticated using (public.can_see_circle(circle_id));

-- notifications: link to a circle, and the new kinds
alter table public.notifications add column if not exists circle_id bigint references public.circles(id) on delete cascade;
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'message', 'comment', 'also_commented', 'like', 'friend_request', 'friend_accept',
  'swap_proposal', 'gift', 'swap_accepted', 'swap_declined', 'swap_cancelled',
  'swap_shipped', 'swap_received', 'swap_completed', 'review',
  'meetup_join', 'meetup_comment', 'meetup_cancelled',
  'circle_join', 'circle_started', 'circle_turn', 'circle_moved', 'circle_won', 'circle_cancelled'));

create or replace function public.notify_circle(p_user uuid, p_actor uuid, p_kind text, p_circle bigint, p_detail text default '')
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.notify(p_user, p_actor, p_kind, null, null, null, null, p_detail);
  update public.notifications set circle_id = p_circle
   where id = (select max(id) from public.notifications where user_id = p_user and kind = p_kind and circle_id is null);
end; $$;
revoke execute on function public.notify_circle(uuid, uuid, text, bigint, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
create or replace function public.create_circle(p_kind text, p_title text, p_description text, p_perfume bigint,
  p_size text, p_amount text, p_spots int, p_ends_at timestamptz default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_cc text;
begin
  if not public.is_active_member() then raise exception 'Your account cannot do this right now.'; end if;
  if p_kind not in ('passaround', 'giveaway') then raise exception 'Choose a pass-around or a giveaway.'; end if;
  if not exists (select 1 from public.perfumes where id = p_perfume and status = 'approved') then raise exception 'Pick a perfume from the catalog.'; end if;
  if p_kind = 'passaround' and (p_spots is null or p_spots not between 2 and 20) then raise exception 'A pass-around is for 2 to 20 people.'; end if;
  if p_kind = 'giveaway' and (p_spots is null or p_spots not between 1 and 50) then raise exception 'Give away 1 to 50 samples.'; end if;
  if p_kind = 'giveaway' and (p_ends_at is null or p_ends_at < now() + interval '1 hour' or p_ends_at > now() + interval '30 days') then
    raise exception 'Entries should close between 1 hour and 30 days from now.';
  end if;
  if (select count(*) from public.circles where host_id = auth.uid() and status in ('open', 'running')) >= 3 then
    raise exception 'You already host 3 pass-arounds or giveaways. Finish one first.';
  end if;
  select country_code into v_cc from public.profiles where id = auth.uid();
  insert into public.circles (host_id, kind, country_code, title, description, perfume_id, size, amount, spots, ends_at)
  values (auth.uid(), p_kind, coalesce(v_cc, 'US'), trim(p_title), trim(coalesce(p_description, '')), p_perfume,
          coalesce(p_size, 'sample'), trim(coalesce(p_amount, '')), p_spots, case when p_kind = 'giveaway' then p_ends_at end)
  returning id into v_id;
  return v_id;
end; $$;

create or replace function public.join_circle(p_circle bigint, p_going boolean)
returns void language plpgsql security definer set search_path = public as $$
declare c public.circles; n int;
begin
  select * into c from public.circles where id = p_circle for update;
  if not found or not public.can_see_circle(p_circle) then raise exception 'Not found.'; end if;
  if not p_going then
    if c.status <> 'open' then raise exception 'It has already started, so you can''t leave now. Message the host.'; end if;
    delete from public.circle_members where circle_id = c.id and user_id = auth.uid();
    return;
  end if;
  if not public.is_active_member() then raise exception 'Your account cannot do this right now.'; end if;
  if c.host_id = auth.uid() then raise exception 'You are the host.'; end if;
  if c.status <> 'open' or (c.ends_at is not null and c.ends_at < now()) then raise exception 'This is closed now.'; end if;
  if c.country_code <> (select country_code from public.profiles where id = auth.uid()) then raise exception 'This is in another country.'; end if;
  if public.is_blocked_with(c.host_id) then raise exception 'Not available.'; end if;
  if exists (select 1 from public.circle_members where circle_id = c.id and user_id = auth.uid()) then return; end if;
  select count(*) into n from public.circle_members where circle_id = c.id;
  if c.kind = 'passaround' and n >= c.spots then raise exception 'This pass-around is full.'; end if;
  if c.kind = 'giveaway' and n >= 1000 then raise exception 'This giveaway has all the entries it can take.'; end if;
  if c.kind = 'passaround' and not exists (select 1 from public.private_addresses where user_id = auth.uid()) then
    raise exception 'Add your shipping address under Me first, so the bottle can reach you.';
  end if;
  insert into public.circle_members (circle_id, user_id) values (c.id, auth.uid());
  perform public.notify_circle(c.host_id, auth.uid(), 'circle_join', c.id, c.title);
end; $$;

-- Pass-around: fix the route in joining order (host = 0) and start; the host ships first.
create or replace function public.start_passaround(p_circle bigint)
returns void language plpgsql security definer set search_path = public as $$
declare c public.circles; r record; i int := 0;
begin
  select * into c from public.circles where id = p_circle for update;
  if not found or c.host_id <> auth.uid() then raise exception 'Only the host can start it.'; end if;
  if c.kind <> 'passaround' or c.status <> 'open' then raise exception 'This can''t be started now.'; end if;
  if not exists (select 1 from public.circle_members where circle_id = c.id) then raise exception 'Wait until someone joins.'; end if;
  insert into public.circle_members (circle_id, user_id, position) values (c.id, c.host_id, 0)
  on conflict (circle_id, user_id) do update set position = 0;
  for r in select user_id from public.circle_members where circle_id = c.id and user_id <> c.host_id order by joined_at loop
    i := i + 1;
    update public.circle_members set position = i where circle_id = c.id and user_id = r.user_id;
    perform public.notify_circle(r.user_id, c.host_id, 'circle_started', c.id, c.title);
  end loop;
  update public.circles set status = 'running', current_pos = 0 where id = c.id;
end; $$;

-- Whose turn is next after a position (the last one sends it home to the host).
create or replace function public.circle_next_pos(p_circle bigint, p_pos int)
returns int language sql stable security definer set search_path = public as $$
  select coalesce((select min(position) from public.circle_members where circle_id = p_circle and position > p_pos), 0);
$$;

-- The holder's one address: the next person on the route.
create or replace function public.circle_next_address(p_circle bigint)
returns table (display_name text, full_name text, address text) language plpgsql stable security definer set search_path = public as $$
declare c public.circles; v_next uuid;
begin
  select * into c from public.circles where id = p_circle;
  if not found or c.status <> 'running' then return; end if;
  if not exists (select 1 from public.circle_members where circle_id = c.id and user_id = auth.uid() and position = c.current_pos) then return; end if;
  select user_id into v_next from public.circle_members where circle_id = c.id and position = public.circle_next_pos(c.id, c.current_pos);
  return query select p.display_name, a.full_name, a.address from public.profiles p
    left join public.private_addresses a on a.user_id = p.id where p.id = v_next;
end; $$;

create or replace function public.circle_sent(p_circle bigint)
returns void language plpgsql security definer set search_path = public as $$
declare c public.circles; v_next uuid;
begin
  select * into c from public.circles where id = p_circle for update;
  if not found or c.status <> 'running' then raise exception 'This isn''t running.'; end if;
  if not exists (select 1 from public.circle_members where circle_id = c.id and user_id = auth.uid() and position = c.current_pos) then
    raise exception 'It isn''t your turn to send it.';
  end if;
  update public.circle_members set sent_at = now() where circle_id = c.id and user_id = auth.uid();
  select user_id into v_next from public.circle_members where circle_id = c.id and position = public.circle_next_pos(c.id, c.current_pos);
  perform public.notify_circle(v_next, auth.uid(), 'circle_turn', c.id, c.title);
end; $$;

create or replace function public.circle_received(p_circle bigint)
returns void language plpgsql security definer set search_path = public as $$
declare c public.circles; v_pos int; v_from uuid;
begin
  select * into c from public.circles where id = p_circle for update;
  if not found or c.status <> 'running' then raise exception 'This isn''t running.'; end if;
  select position into v_pos from public.circle_members where circle_id = c.id and user_id = auth.uid();
  if v_pos is null or v_pos <> public.circle_next_pos(c.id, c.current_pos) then raise exception 'It isn''t coming to you yet.'; end if;
  select user_id into v_from from public.circle_members where circle_id = c.id and position = c.current_pos;
  if not exists (select 1 from public.circle_members where circle_id = c.id and position = c.current_pos and sent_at is not null) then
    raise exception 'It hasn''t been sent to you yet.';
  end if;
  update public.circle_members set received_at = now(), sent_at = case when v_pos = 0 then sent_at else null end
   where circle_id = c.id and user_id = auth.uid();
  update public.circles set current_pos = v_pos, status = case when v_pos = 0 then 'done' else status end where id = c.id;
  if v_pos <> 0 then perform public.notify_circle(c.host_id, auth.uid(), 'circle_moved', c.id, c.title); end if;
end; $$;

-- Giveaway: draw winners at random (host; any time once someone entered).
create or replace function public.draw_giveaway(p_circle bigint)
returns int language plpgsql security definer set search_path = public as $$
declare c public.circles; r record; n int := 0;
begin
  select * into c from public.circles where id = p_circle for update;
  if not found or c.host_id <> auth.uid() then raise exception 'Only the host can draw.'; end if;
  if c.kind <> 'giveaway' or c.status <> 'open' then raise exception 'This can''t be drawn now.'; end if;
  for r in select m.user_id from public.circle_members m join public.profiles p on p.id = m.user_id
           where m.circle_id = c.id and not p.is_banned and not public.is_blocked_with(m.user_id)
           order by random() limit c.spots loop
    update public.circle_members set won = true where circle_id = c.id and user_id = r.user_id;
    perform public.notify_circle(r.user_id, c.host_id, 'circle_won', c.id, c.title);
    n := n + 1;
  end loop;
  if n = 0 then raise exception 'Nobody has entered yet.'; end if;
  update public.circles set status = 'done' where id = c.id;
  return n;
end; $$;

create or replace function public.cancel_circle(p_circle bigint)
returns void language plpgsql security definer set search_path = public as $$
declare c public.circles; r record;
begin
  select * into c from public.circles where id = p_circle for update;
  if not found or c.host_id <> auth.uid() then raise exception 'Only the host can cancel it.'; end if;
  if c.status not in ('open', 'running') then return; end if;
  update public.circles set status = 'cancelled' where id = c.id;
  for r in select user_id from public.circle_members where circle_id = c.id and user_id <> c.host_id loop
    perform public.notify_circle(r.user_id, c.host_id, 'circle_cancelled', c.id, c.title);
  end loop;
end; $$;

create or replace function public.admin_set_circle_hidden(p_circle bigint, p_hidden boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then raise exception 'Admins only.'; end if;
  update public.circles set is_hidden = p_hidden where id = p_circle;
end; $$;

do $$
declare f text;
begin
  foreach f in array array['create_circle(text, text, text, bigint, text, text, int, timestamptz)', 'join_circle(bigint, boolean)',
    'start_passaround(bigint)', 'circle_next_address(bigint)', 'circle_sent(bigint)', 'circle_received(bigint)',
    'draw_giveaway(bigint)', 'cancel_circle(bigint)', 'admin_set_circle_hidden(bigint, boolean)', 'can_see_circle(bigint)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  execute 'revoke execute on function public.circle_next_pos(bigint, int) from public, anon, authenticated';
end $$;
