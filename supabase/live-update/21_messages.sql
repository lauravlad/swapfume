-- Swapfume live update — 020 messages in swaps and about listings
-- Same as supabase/migrations/020_messages.sql.
-- Safe to run more than once. Run the files in this folder in number order.

-- =====================================================================
-- Swapfume — 020: messages
-- Run AFTER 019. Safe to run more than once.
--   Two kinds of conversation, always between exactly two members:
--     * "swap": on a swap or gift, between the two people in it
--     * "item": "Ask a question" about a listing, between the asker and the owner
--   No open messages to strangers. Blocked members can't message each other.
--   A light limit stops spam (60 messages an hour). Admins can read a
--   conversation only through reports (the reporter quotes the message).
-- =====================================================================

create table if not exists public.threads (
  id               bigint generated always as identity primary key,
  kind             text not null check (kind in ('swap', 'item')),
  swap_id          bigint unique references public.swaps(id) on delete cascade,
  item_id          bigint references public.collection_items(id) on delete set null,
  perfume_id       bigint references public.perfumes(id) on delete set null,   -- what an "item" thread is about (kept if the listing is deleted)
  user_a           uuid references public.profiles(id) on delete cascade,      -- swap: proposer · item: the person asking
  user_b           uuid references public.profiles(id) on delete cascade,      -- swap: recipient · item: the owner
  created_at       timestamptz not null default now(),
  last_message_at  timestamptz,
  check (user_a is distinct from user_b)
);
create unique index if not exists threads_item_once on public.threads (item_id, user_a) where kind = 'item';
create index if not exists threads_a_idx on public.threads (user_a, last_message_at desc);
create index if not exists threads_b_idx on public.threads (user_b, last_message_at desc);

create table if not exists public.messages (
  id          bigint generated always as identity primary key,
  thread_id   bigint not null references public.threads(id) on delete cascade,
  sender_id   uuid references public.profiles(id) on delete set null,
  body        text not null check (char_length(body) between 1 and 1000),
  created_at  timestamptz not null default now()
);
create index if not exists messages_thread_idx on public.messages (thread_id, created_at);
create index if not exists messages_sender_time_idx on public.messages (sender_id, created_at);

create table if not exists public.thread_reads (
  thread_id     bigint not null references public.threads(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  last_read_at  timestamptz not null default now(),
  primary key (thread_id, user_id)
);

alter table public.threads enable row level security;
alter table public.messages enable row level security;
alter table public.thread_reads enable row level security;
revoke all on public.threads, public.messages, public.thread_reads from anon, authenticated;
grant select on public.threads, public.messages, public.thread_reads to authenticated;

create or replace function public.in_thread(p_thread bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.threads t where t.id = p_thread and auth.uid() in (t.user_a, t.user_b));
$$;

drop policy if exists "read my threads" on public.threads;
create policy "read my threads" on public.threads for select to authenticated using (auth.uid() in (user_a, user_b));
drop policy if exists "read my messages" on public.messages;
create policy "read my messages" on public.messages for select to authenticated using (public.in_thread(thread_id));
drop policy if exists "read my read marks" on public.thread_reads;
create policy "read my read marks" on public.thread_reads for select to authenticated using (user_id = auth.uid());

-- The conversation for a swap or gift (created the first time it's needed).
create or replace function public.swap_thread(p_swap bigint)
returns bigint language plpgsql security definer set search_path = public as $$
declare v public.swaps; t bigint;
begin
  select * into v from public.swaps where id = p_swap;
  if not found or auth.uid() not in (v.proposer_id, v.recipient_id) then raise exception 'Not your swap.'; end if;
  select id into t from public.threads where swap_id = p_swap;
  if t is null then
    insert into public.threads (kind, swap_id, user_a, user_b) values ('swap', p_swap, v.proposer_id, v.recipient_id)
    on conflict (swap_id) do nothing returning id into t;
    if t is null then select id into t from public.threads where swap_id = p_swap; end if;
  end if;
  return t;
end;
$$;

-- "Ask a question" about a listing: one conversation per listing and asker.
create or replace function public.item_thread(p_item bigint)
returns bigint language plpgsql security definer set search_path = public as $$
declare ci public.collection_items; t bigint;
begin
  if not public.is_active_member() then raise exception 'Your account cannot do this right now.'; end if;
  select * into ci from public.collection_items where id = p_item;
  if not found or not ci.tradeable or ci.is_hidden then raise exception 'This listing is not available.'; end if;
  if ci.owner_id = auth.uid() then raise exception 'This is your own listing.'; end if;
  if public.is_blocked_with(ci.owner_id) then raise exception 'This member is not available.'; end if;
  if (select country_code from public.profiles where id = ci.owner_id) is distinct from (select country_code from public.profiles where id = auth.uid()) then
    raise exception 'This listing is in another country.';
  end if;
  select id into t from public.threads where kind = 'item' and item_id = p_item and user_a = auth.uid();
  if t is null then
    insert into public.threads (kind, item_id, perfume_id, user_a, user_b) values ('item', p_item, ci.perfume_id, auth.uid(), ci.owner_id)
    returning id into t;
  end if;
  return t;
end;
$$;

create or replace function public.send_message(p_thread bigint, p_body text)
returns bigint language plpgsql security definer set search_path = public as $$
declare t public.threads; other uuid; v_body text := trim(coalesce(p_body, '')); m bigint;
begin
  if not public.is_active_member() then raise exception 'Your account cannot do this right now.'; end if;
  select * into t from public.threads where id = p_thread;
  if not found or auth.uid() not in (t.user_a, t.user_b) then raise exception 'Conversation not found.'; end if;
  other := case when t.user_a = auth.uid() then t.user_b else t.user_a end;
  if other is null then raise exception 'This member has left Swapfume.'; end if;
  if public.is_blocked_with(other) then raise exception 'You can''t message this member.'; end if;
  if char_length(v_body) = 0 then raise exception 'Write a message first.'; end if;
  if char_length(v_body) > 1000 then raise exception 'Messages can be up to 1,000 characters.'; end if;
  if (select count(*) from public.messages where sender_id = auth.uid() and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'That''s a lot of messages. Please wait a little.';
  end if;
  insert into public.messages (thread_id, sender_id, body) values (p_thread, auth.uid(), v_body) returning id into m;
  update public.threads set last_message_at = now() where id = p_thread;
  insert into public.thread_reads (thread_id, user_id, last_read_at) values (p_thread, auth.uid(), now())
  on conflict (thread_id, user_id) do update set last_read_at = now();
  return m;
end;
$$;

create or replace function public.mark_thread_read(p_thread bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.in_thread(p_thread) then raise exception 'Conversation not found.'; end if;
  insert into public.thread_reads (thread_id, user_id, last_read_at) values (p_thread, auth.uid(), now())
  on conflict (thread_id, user_id) do update set last_read_at = now();
end;
$$;

-- How many of my conversations have a message from the other person I haven't read.
create or replace function public.unread_threads()
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.threads t
   where auth.uid() in (t.user_a, t.user_b) and t.last_message_at is not null
     and exists (select 1 from public.messages m where m.thread_id = t.id and m.sender_id is distinct from auth.uid()
                  and m.created_at > coalesce((select r.last_read_at from public.thread_reads r where r.thread_id = t.id and r.user_id = auth.uid()), '-infinity'));
$$;

-- People you have a conversation with are visible to you (name and photo on the chat).
create or replace function public.profile_visible(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
       p_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.collection_items where owner_id = p_id)
    or exists (select 1 from public.wishlist_items where user_id = p_id)
    or exists (select 1 from public.swaps where p_id in (proposer_id, recipient_id))
    or exists (select 1 from public.reviews where p_id in (reviewer_id, reviewee_id))
    or exists (select 1 from public.perfume_reviews where user_id = p_id)
    or exists (select 1 from public.events where organizer_id = p_id)
    or exists (select 1 from public.event_attendees where user_id = p_id)
    or exists (select 1 from public.event_comments where user_id = p_id)
    or exists (select 1 from public.blocks where blocker_id = auth.uid() and blocked_id = p_id)
    or exists (select 1 from public.threads where (user_a = auth.uid() and user_b = p_id) or (user_b = auth.uid() and user_a = p_id))
  );
$$;

do $$
declare f text;
begin
  foreach f in array array['swap_thread(bigint)', 'item_thread(bigint)', 'send_message(bigint,text)', 'mark_thread_read(bigint)', 'unread_threads()', 'in_thread(bigint)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
