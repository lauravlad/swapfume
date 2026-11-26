-- Swapfume live update — 032 richer posts: photos, polls, edits, replies, mentions, saved, search
-- Same as supabase/migrations/032_posts_plus.sql.
-- Safe to run more than once. Run the files in this folder in number order.

-- =====================================================================
-- Swapfume — 032: richer posts
-- Run AFTER 031. Safe to run more than once.
--   * Up to 4 photos per post (photo_url stays the first; posts.photos holds up to 3 more).
--   * Polls: 2–4 options on a post; one vote per member (changeable). Who voted what is private;
--     poll_counts() gives the totals and your own vote.
--   * Editing your own post (posts.edited_at shows "edited").
--   * Replies to comments (post_comments.parent_id, one level deep).
--   * @mentions in posts and comments notify the person, when they're your friend or already
--     part of that conversation (so a mention can't be used to ping strangers).
--   * Saved posts (private to you), pinned announcements (admins), people search.
-- =====================================================================

alter table public.posts add column if not exists photos text[] not null default '{}';
alter table public.posts add column if not exists poll text[];
alter table public.posts add column if not exists edited_at timestamptz;
alter table public.posts add column if not exists is_pinned boolean not null default false;
alter table public.posts drop constraint if exists posts_photos_max;
alter table public.posts add constraint posts_photos_max check (coalesce(array_length(photos, 1), 0) <= 3);
alter table public.posts drop constraint if exists posts_poll_size;
alter table public.posts add constraint posts_poll_size check (poll is null or array_length(poll, 1) between 2 and 4);
alter table public.post_comments add column if not exists parent_id bigint references public.post_comments(id) on delete cascade;

create table if not exists public.poll_votes (
  post_id    bigint not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  choice     int not null check (choice between 0 and 3),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create table if not exists public.saved_posts (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  post_id    bigint not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
alter table public.poll_votes enable row level security;
alter table public.saved_posts enable row level security;
revoke all on public.poll_votes, public.saved_posts from anon, authenticated;
grant select on public.poll_votes to authenticated;
grant select, insert, delete on public.saved_posts to authenticated;
drop policy if exists "my poll votes" on public.poll_votes;
create policy "my poll votes" on public.poll_votes for select to authenticated using (user_id = auth.uid());
drop policy if exists "my saved posts" on public.saved_posts;
create policy "my saved posts" on public.saved_posts for select to authenticated using (user_id = auth.uid());
drop policy if exists "save posts" on public.saved_posts;
create policy "save posts" on public.saved_posts for insert to authenticated with check (user_id = auth.uid() and public.can_see_post(post_id));
drop policy if exists "unsave posts" on public.saved_posts;
create policy "unsave posts" on public.saved_posts for delete to authenticated using (user_id = auth.uid());

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'message', 'comment', 'also_commented', 'like', 'friend_request', 'friend_accept',
  'swap_proposal', 'gift', 'swap_accepted', 'swap_declined', 'swap_cancelled',
  'swap_shipped', 'swap_received', 'swap_completed', 'review',
  'meetup_join', 'meetup_comment', 'meetup_cancelled',
  'circle_join', 'circle_started', 'circle_turn', 'circle_moved', 'circle_won', 'circle_cancelled',
  'invite_joined', 'reply', 'mention'));

-- @mentions: "@Name" matches the first word of a display name, among the writer's friends and
-- the people already in this post's conversation. Each person is told once per post or comment.
create or replace function public.notify_mentions(p_post bigint, p_text text)
returns void language plpgsql security definer set search_path = public as $$
declare r record; v_names text[];
begin
  select array_agg(distinct lower(m[1])) into v_names from regexp_matches(coalesce(p_text, ''), '@([[:alpha:]][[:alnum:]_''-]{1,39})', 'g') as m;
  if v_names is null then return; end if;
  for r in
    select distinct p.id from public.profiles p
    where lower(split_part(trim(p.display_name), ' ', 1)) = any (v_names) and p.id <> auth.uid() and not p.is_banned
      and (public.are_friends(p.id)
           or p.id = (select author_id from public.posts where id = p_post)
           or exists (select 1 from public.post_comments c where c.post_id = p_post and c.user_id = p.id))
    limit 10
  loop
    perform public.notify(r.id, auth.uid(), 'mention', p_post, null, null, null, left(p_text, 160));
  end loop;
end; $$;
revoke execute on function public.notify_mentions(bigint, text) from public, anon, authenticated;

-- ---------- posts ----------
drop function if exists public.create_post(text, text, bigint, text, bigint);
create or replace function public.create_post(p_kind text, p_body text, p_perfume bigint, p_photo_url text,
  p_group bigint default null, p_photos text[] default '{}', p_poll text[] default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_body text := trim(coalesce(p_body, '')); v_ph text; v_poll text[];
begin
  if not public.is_active_member() then raise exception 'Your account cannot do this right now.'; end if;
  if char_length(v_body) = 0 then raise exception 'Write something first.'; end if;
  if p_kind not in ('sotd', 'discovery', 'haul', 'question', 'thoughts') then raise exception 'Pick what kind of post this is.'; end if;
  if p_perfume is not null and not exists (select 1 from public.perfumes where id = p_perfume and status = 'approved') then
    raise exception 'Pick a perfume from the catalog.';
  end if;
  foreach v_ph in array (coalesce(array[p_photo_url], '{}') || coalesce(p_photos, '{}')) loop
    if v_ph is not null and position('/storage/v1/object/public/bottle-photos/' || auth.uid()::text || '/' in v_ph) = 0 then
      raise exception 'Please upload the photo again.';
    end if;
  end loop;
  if coalesce(array_length(p_photos, 1), 0) > 3 then raise exception 'Up to 4 photos per post.'; end if;
  if p_poll is not null then
    select array_agg(left(trim(o), 80)) into v_poll from unnest(p_poll) o where trim(o) <> '';
    if coalesce(array_length(v_poll, 1), 0) not between 2 and 4 then raise exception 'A poll needs 2 to 4 options.'; end if;
  end if;
  if p_group is not null and not exists (select 1 from public.group_members m join public.groups g on g.id = m.group_id
                                         where m.group_id = p_group and m.user_id = auth.uid() and not g.is_hidden) then
    raise exception 'Join the group to post in it.';
  end if;
  if (select count(*) from public.posts where author_id = auth.uid() and created_at > now() - interval '1 day') >= 20 then
    raise exception 'You''ve posted a lot today. Please come back tomorrow.';
  end if;
  insert into public.posts (author_id, country_code, kind, body, perfume_id, photo_url, group_id, photos, poll)
  values (auth.uid(), (select country_code from public.profiles where id = auth.uid()), p_kind, left(v_body, 1000), p_perfume,
          p_photo_url, p_group, coalesce(p_photos, '{}'), v_poll)
  returning id into v_id;
  perform public.notify_mentions(v_id, v_body);
  return v_id;
end;
$$;

create or replace function public.edit_post(p_post bigint, p_body text)
returns void language plpgsql security definer set search_path = public as $$
declare v_body text := trim(coalesce(p_body, ''));
begin
  if not exists (select 1 from public.posts where id = p_post and author_id = auth.uid()) then raise exception 'You can only edit your own posts.'; end if;
  if char_length(v_body) = 0 then raise exception 'Write something first.'; end if;
  update public.posts set body = left(v_body, 1000), edited_at = now() where id = p_post;
end; $$;

create or replace function public.pin_post(p_post bigint, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  update public.posts set is_pinned = p_on where id = p_post;
end; $$;

create or replace function public.vote_poll(p_post bigint, p_choice int)
returns void language plpgsql security definer set search_path = public as $$
declare v_poll text[];
begin
  if not public.is_active_member() then raise exception 'Your account cannot do this right now.'; end if;
  if not public.can_see_post(p_post) then raise exception 'Post not found.'; end if;
  select poll into v_poll from public.posts where id = p_post;
  if v_poll is null or p_choice < 0 or p_choice >= array_length(v_poll, 1) then raise exception 'That isn''t an option.'; end if;
  insert into public.poll_votes (post_id, user_id, choice) values (p_post, auth.uid(), p_choice)
  on conflict (post_id, user_id) do update set choice = excluded.choice, created_at = now();
end; $$;

-- Totals for the polls on these posts, plus your own vote.
create or replace function public.poll_counts(p_posts bigint[])
returns table (post_id bigint, choice int, votes bigint, mine boolean)
language sql stable security definer set search_path = public as $$
  select v.post_id, v.choice, count(*), bool_or(v.user_id = auth.uid())
  from public.poll_votes v where v.post_id = any (p_posts) and public.can_see_post(v.post_id)
  group by v.post_id, v.choice;
$$;

-- ---------- comments with replies and mentions ----------
drop function if exists public.comment_post(bigint, text);
create or replace function public.comment_post(p_post bigint, p_body text, p_parent bigint default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_parent bigint := p_parent;
begin
  if not public.is_active_member() then raise exception 'Your account cannot do this right now.'; end if;
  if not public.can_see_post(p_post) then raise exception 'Post not found.'; end if;
  if char_length(trim(coalesce(p_body, ''))) = 0 then raise exception 'Write something first.'; end if;
  if (select count(*) from public.post_comments where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'That''s a lot of comments. Please wait a little.';
  end if;
  if v_parent is not null then
    -- one level deep: a reply to a reply hangs under the same top comment
    select coalesce(parent_id, id) into v_parent from public.post_comments where id = v_parent and post_id = p_post;
    if v_parent is null then raise exception 'That comment is gone.'; end if;
  end if;
  insert into public.post_comments (post_id, user_id, body, parent_id) values (p_post, auth.uid(), left(trim(p_body), 600), v_parent);
  perform public.notify_mentions(p_post, p_body);
end;
$$;

-- Comment notifications, now aware of replies (replaces the 027 version).
create or replace function public.trg_notify_post_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_author uuid; v_parent_author uuid; r record;
begin
  select author_id into v_author from public.posts where id = new.post_id;
  if new.parent_id is not null then
    select user_id into v_parent_author from public.post_comments where id = new.parent_id;
    perform public.notify(v_parent_author, new.user_id, 'reply', new.post_id, null, null, null, new.body);
  end if;
  if v_author is distinct from v_parent_author then
    perform public.notify(v_author, new.user_id, 'comment', new.post_id, null, null, null, new.body);
  end if;
  for r in select distinct user_id from public.post_comments
           where post_id = new.post_id and user_id is distinct from new.user_id
             and user_id is distinct from v_author and user_id is distinct from v_parent_author loop
    perform public.notify(r.user_id, new.user_id, 'also_commented', new.post_id, null, null, null, new.body);
  end loop;
  return new;
end; $$;

-- ---------- people search ----------
create or replace function public.search_people(p_q text)
returns table (id uuid, display_name text, city text, country text, country_code text, avatar_url text)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.city, p.country, p.country_code, p.avatar_url from public.profiles p
  where char_length(trim(coalesce(p_q, ''))) >= 2 and p.display_name ilike '%' || replace(replace(trim(p_q), '%', ''), '_', '') || '%'
    and not p.is_banned and p.adult_confirmed_at is not null and p.id <> auth.uid() and not public.is_blocked_with(p.id)
  order by p.display_name limit 20;
$$;

do $$
declare f text;
begin
  foreach f in array array['create_post(text, text, bigint, text, bigint, text[], text[])', 'edit_post(bigint, text)', 'pin_post(bigint, boolean)',
    'vote_poll(bigint, int)', 'poll_counts(bigint[])', 'comment_post(bigint, text, bigint)', 'search_people(text)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
