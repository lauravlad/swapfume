-- =====================================================================
-- Swapfume — 027: notifications
-- Run AFTER 026. Safe to run more than once.
--   * notifications: one row per thing a member should hear about. Filled ONLY by the
--     triggers below (members can't insert), so nothing depends on the app remembering.
--   * Triggers: new message, comment on your post (and on posts you commented on), like,
--     friend request / accepted, new swap or gift, swap accepted/declined/cancelled/
--     shipped/received/completed, review, meetup join / comment / cancelled.
--   * profiles.email_activity: emails about this activity (on by default), at most one email
--     every 30 minutes per member (profiles.activity_emailed_at). Likes are never emailed.
--   * claim_activity_emails(): called by the activity-email Edge Function as the member who
--     just did something; returns who should get an email now and marks it sent.
-- =====================================================================

create table if not exists public.notifications (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,   -- who hears about it
  actor_id    uuid references public.profiles(id) on delete cascade,            -- who did it
  kind        text not null check (kind in (
                'message', 'comment', 'also_commented', 'like',
                'friend_request', 'friend_accept',
                'swap_proposal', 'gift', 'swap_accepted', 'swap_declined', 'swap_cancelled',
                'swap_shipped', 'swap_received', 'swap_completed', 'review',
                'meetup_join', 'meetup_comment', 'meetup_cancelled')),
  post_id     bigint references public.posts(id) on delete cascade,
  swap_id     bigint references public.swaps(id) on delete cascade,
  thread_id   bigint references public.threads(id) on delete cascade,
  event_id    bigint references public.events(id) on delete cascade,
  detail      text not null default '' check (char_length(detail) <= 160),   -- a short preview
  read_at     timestamptz,
  emailed_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_user_time_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx on public.notifications (user_id) where read_at is null;
create index if not exists notifications_actor_time_idx on public.notifications (actor_id, created_at desc);

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select, delete on public.notifications to authenticated;
drop policy if exists "read own notifications" on public.notifications;
create policy "read own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists "delete own notifications" on public.notifications;
create policy "delete own notifications" on public.notifications for delete to authenticated using (user_id = auth.uid());

alter table public.profiles add column if not exists email_activity boolean not null default true;
alter table public.profiles add column if not exists activity_emailed_at timestamptz;
grant update (email_activity) on public.profiles to authenticated;

-- ---------------------------------------------------------------------
-- The one place notifications are written. Skips: nobody to tell, telling yourself,
-- and people who blocked each other. Likes only ever notify once per person per post;
-- messages keep one unread notification per conversation (the newest).
create or replace function public.notify(
  p_user uuid, p_actor uuid, p_kind text,
  p_post bigint default null, p_swap bigint default null, p_thread bigint default null,
  p_event bigint default null, p_detail text default '')
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user is null or p_user = p_actor then return; end if;
  if p_actor is not null and exists (select 1 from public.blocks
      where (blocker_id = p_user and blocked_id = p_actor) or (blocker_id = p_actor and blocked_id = p_user)) then
    return;
  end if;
  if p_kind = 'like' and exists (select 1 from public.notifications
      where user_id = p_user and actor_id = p_actor and kind = 'like' and post_id = p_post) then
    return;
  end if;
  -- a mention adds nothing if this person was just told about the same post by the same member
  if p_kind = 'mention' and exists (select 1 from public.notifications
      where user_id = p_user and actor_id = p_actor and post_id = p_post and created_at > now() - interval '1 minute') then
    return;
  end if;
  if p_kind = 'message' then
    delete from public.notifications where user_id = p_user and kind = 'message' and thread_id = p_thread and read_at is null;
  end if;
  insert into public.notifications (user_id, actor_id, kind, post_id, swap_id, thread_id, event_id, detail)
  values (p_user, p_actor, p_kind, p_post, p_swap, p_thread, p_event, left(coalesce(p_detail, ''), 160));
end;
$$;
revoke execute on function public.notify(uuid, uuid, text, bigint, bigint, bigint, bigint, text) from public, anon, authenticated;

-- ---------- messages ----------
create or replace function public.trg_notify_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare t public.threads;
begin
  select * into t from public.threads where id = new.thread_id;
  if not found then return new; end if;
  perform public.notify(case when new.sender_id = t.user_a then t.user_b else t.user_a end,
                        new.sender_id, 'message', null, t.swap_id, t.id, null,
                        case when coalesce(new.body, '') = '' then '📷 Photo' else new.body end);
  return new;
end; $$;
drop trigger if exists notify_message on public.messages;
create trigger notify_message after insert on public.messages for each row execute function public.trg_notify_message();

-- ---------- posts: comments and likes ----------
create or replace function public.trg_notify_post_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_author uuid; r record;
begin
  select author_id into v_author from public.posts where id = new.post_id;
  perform public.notify(v_author, new.user_id, 'comment', new.post_id, null, null, null, new.body);
  -- everyone else who commented on this post before
  for r in select distinct user_id from public.post_comments
           where post_id = new.post_id and user_id is distinct from new.user_id and user_id is distinct from v_author loop
    perform public.notify(r.user_id, new.user_id, 'also_commented', new.post_id, null, null, null, new.body);
  end loop;
  return new;
end; $$;
drop trigger if exists notify_post_comment on public.post_comments;
create trigger notify_post_comment after insert on public.post_comments for each row execute function public.trg_notify_post_comment();

create or replace function public.trg_notify_post_like() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify((select author_id from public.posts where id = new.post_id), new.user_id, 'like', new.post_id);
  return new;
end; $$;
drop trigger if exists notify_post_like on public.post_likes;
create trigger notify_post_like after insert on public.post_likes for each row execute function public.trg_notify_post_like();

-- ---------- friends ----------
create or replace function public.trg_notify_friendship() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_other uuid := case when new.requested_by = new.user_a then new.user_b else new.user_a end;
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    perform public.notify(v_other, new.requested_by, 'friend_request');
  elsif tg_op = 'UPDATE' and new.status = 'accepted' and old.status is distinct from 'accepted' then
    perform public.notify(new.requested_by, v_other, 'friend_accept');
  end if;
  return new;
end; $$;
drop trigger if exists notify_friendship on public.friendships;
create trigger notify_friendship after insert or update on public.friendships for each row execute function public.trg_notify_friendship();

-- ---------- swaps and gifts ----------
create or replace function public.trg_notify_swap() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := coalesce(auth.uid(), new.proposer_id);
  v_other uuid := case when v_actor = new.proposer_id then new.recipient_id else new.proposer_id end;
begin
  if tg_op = 'INSERT' then
    perform public.notify(new.recipient_id, new.proposer_id, case when new.is_gift then 'gift' else 'swap_proposal' end, null, new.id);
    return new;
  end if;
  if new.status is distinct from old.status then
    if new.status in ('accepted', 'declined', 'cancelled', 'completed') then
      perform public.notify(v_other, v_actor, 'swap_' || new.status, null, new.id);
    end if;
  elsif (new.proposer_shipped_at is not null and old.proposer_shipped_at is null)
     or (new.recipient_shipped_at is not null and old.recipient_shipped_at is null) then
    perform public.notify(v_other, v_actor, 'swap_shipped', null, new.id);
  elsif (new.proposer_received_at is not null and old.proposer_received_at is null)
     or (new.recipient_received_at is not null and old.recipient_received_at is null) then
    perform public.notify(v_other, v_actor, 'swap_received', null, new.id);
  end if;
  return new;
end; $$;
drop trigger if exists notify_swap on public.swaps;
create trigger notify_swap after insert or update on public.swaps for each row execute function public.trg_notify_swap();

create or replace function public.trg_notify_review() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify(new.reviewee_id, new.reviewer_id, 'review', null, new.swap_id, null, null, new.rating || '★ ' || new.comment);
  return new;
end; $$;
drop trigger if exists notify_review on public.reviews;
create trigger notify_review after insert on public.reviews for each row execute function public.trg_notify_review();

-- ---------- meetups ----------
create or replace function public.trg_notify_event_join() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify((select organizer_id from public.events where id = new.event_id), new.user_id, 'meetup_join', null, null, null, new.event_id);
  return new;
end; $$;
drop trigger if exists notify_event_join on public.event_attendees;
create trigger notify_event_join after insert on public.event_attendees for each row execute function public.trg_notify_event_join();

create or replace function public.trg_notify_event_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select organizer_id as uid from public.events where id = new.event_id
           union select user_id from public.event_attendees where event_id = new.event_id loop
    perform public.notify(r.uid, new.user_id, 'meetup_comment', null, null, null, new.event_id, new.body);
  end loop;
  return new;
end; $$;
drop trigger if exists notify_event_comment on public.event_comments;
create trigger notify_event_comment after insert on public.event_comments for each row execute function public.trg_notify_event_comment();

create or replace function public.trg_notify_event_cancel() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    for r in select user_id from public.event_attendees where event_id = new.id loop
      perform public.notify(r.user_id, new.organizer_id, 'meetup_cancelled', null, null, null, new.id, new.title);
    end loop;
  end if;
  return new;
end; $$;
drop trigger if exists notify_event_cancel on public.events;
create trigger notify_event_cancel after update on public.events for each row execute function public.trg_notify_event_cancel();

-- ---------------------------------------------------------------------
-- Reading: mark one or all as read; count unread.
create or replace function public.mark_notifications_read(p_id bigint default null)
returns void language sql security definer set search_path = public as $$
  update public.notifications set read_at = now()
  where user_id = auth.uid() and read_at is null and (p_id is null or id = p_id);
$$;
revoke execute on function public.mark_notifications_read(bigint) from public, anon;
grant execute on function public.mark_notifications_read(bigint) to authenticated;

create or replace function public.unread_notifications()
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.notifications where user_id = auth.uid() and read_at is null;
$$;
revoke execute on function public.unread_notifications() from public, anon;
grant execute on function public.unread_notifications() to authenticated;

-- ---------------------------------------------------------------------
-- Emails. Called by the activity-email Edge Function AS the member who just acted.
-- Picks the people that member notified in the last 15 minutes who: still have it unread,
-- want activity emails, aren't banned, and haven't had an activity email in 30 minutes.
-- Marks all their unread, un-emailed notifications as emailed and returns their ids.
-- New proposals and gifts are left out (the swap-email function already sends those),
-- and likes are never emailed.
create or replace function public.claim_activity_emails()
returns setof uuid language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    select distinct n.user_id from public.notifications n
    join public.profiles p on p.id = n.user_id
    where n.actor_id = auth.uid() and n.created_at > now() - interval '15 minutes'
      and n.read_at is null and n.emailed_at is null
      and n.kind not in ('like', 'swap_proposal', 'gift')
      and p.email_activity and not coalesce(p.is_banned, false)
      and (p.activity_emailed_at is null or p.activity_emailed_at < now() - interval '30 minutes')
  loop
    update public.profiles set activity_emailed_at = now() where id = r.user_id;
    update public.notifications set emailed_at = now()
      where user_id = r.user_id and read_at is null and emailed_at is null and kind not in ('like', 'swap_proposal', 'gift');
    return next r.user_id;
  end loop;
end; $$;
revoke execute on function public.claim_activity_emails() from public, anon;
grant execute on function public.claim_activity_emails() to authenticated;

-- Live updates for the bell (used by the app when Realtime is on for this table).
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
