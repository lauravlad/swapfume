-- =====================================================================
-- Swapfume — 023: Community (friends, posts, likes, comments)
-- Run AFTER 022. Safe to run more than once.
--   * friendships: a request, then the other member accepts. Same country only.
--     Blocking someone (either way) ends the friendship. Friends lists are
--     private: you only ever read rows you are part of.
--   * posts: text (+ optional photo and perfume tag), visible to signed-in
--     members in the author's country. The Feed shows you + your friends;
--     Discover shows everyone in your country. 20 posts a day.
--   * post_likes, post_comments (30 comments an hour).
--   * reports can point at a post or a comment; admins can hide posts.
--   Post photos live in the existing bottle-photos bucket, in the author's
--   own folder (create_post checks the address).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Friends
-- ---------------------------------------------------------------------
create table if not exists public.friendships (
  user_a        uuid not null references public.profiles(id) on delete cascade,  -- the smaller id
  user_b        uuid not null references public.profiles(id) on delete cascade,
  requested_by  uuid not null references public.profiles(id) on delete cascade,
  status        text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at    timestamptz not null default now(),
  accepted_at   timestamptz,
  primary key (user_a, user_b),
  check (user_a < user_b),
  check (requested_by in (user_a, user_b))
);
create index if not exists friendships_b_idx on public.friendships (user_b);
alter table public.friendships enable row level security;
revoke all on public.friendships from anon, authenticated;
grant select on public.friendships to authenticated;
drop policy if exists "read own friendships" on public.friendships;
create policy "read own friendships" on public.friendships for select to authenticated
  using (auth.uid() in (user_a, user_b));

create or replace function public.are_friends(p_other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.friendships
                  where status = 'accepted'
                    and user_a = least(auth.uid(), p_other) and user_b = greatest(auth.uid(), p_other));
$$;

-- Send a request. If they already asked you, this accepts theirs.
create or replace function public.send_friend_request(p_user uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); f public.friendships; o public.profiles;
begin
  if not public.is_active_member() then raise exception 'Your account cannot do this right now.'; end if;
  if p_user = v_me then raise exception 'You cannot add yourself.'; end if;
  select * into o from public.profiles where id = p_user;
  if not found or o.is_banned or o.adult_confirmed_at is null then raise exception 'Member not found.'; end if;
  if public.is_blocked_with(p_user) then raise exception 'You cannot add this member.'; end if;
  if o.country_code is distinct from (select country_code from public.profiles where id = v_me) then
    raise exception 'Friends are only between members in the same country.';
  end if;
  select * into f from public.friendships where user_a = least(v_me, p_user) and user_b = greatest(v_me, p_user) for update;
  if found then
    if f.status = 'accepted' then return 'friends'; end if;
    if f.requested_by = v_me then return 'sent'; end if;
    update public.friendships set status = 'accepted', accepted_at = now()
     where user_a = f.user_a and user_b = f.user_b;
    return 'friends';
  end if;
  if (select count(*) from public.friendships where requested_by = v_me and created_at > now() - interval '1 day') >= 40 then
    raise exception 'That''s a lot of friend requests today. Please try again tomorrow.';
  end if;
  insert into public.friendships (user_a, user_b, requested_by) values (least(v_me, p_user), greatest(v_me, p_user), v_me);
  return 'sent';
end;
$$;

create or replace function public.respond_friend_request(p_user uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Please sign in first.'; end if;
  if p_accept then
    if not public.is_active_member() then raise exception 'Your account cannot do this right now.'; end if;
    update public.friendships set status = 'accepted', accepted_at = now()
     where user_a = least(v_me, p_user) and user_b = greatest(v_me, p_user)
       and status = 'pending' and requested_by = p_user;
    if not found then raise exception 'That request is no longer open.'; end if;
  else
    delete from public.friendships
     where user_a = least(v_me, p_user) and user_b = greatest(v_me, p_user)
       and status = 'pending' and requested_by = p_user;
  end if;
end;
$$;

-- Unfriend, or take back a request you sent.
create or replace function public.remove_friend(p_user uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.friendships where user_a = least(auth.uid(), p_user) and user_b = greatest(auth.uid(), p_user);
$$;

-- Blocking ends the friendship (and any request), whoever blocks whom.
create or replace function public.blocks_end_friendship()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.friendships
   where user_a = least(new.blocker_id, new.blocked_id) and user_b = greatest(new.blocker_id, new.blocked_id);
  return new;
end;
$$;
drop trigger if exists blocks_end_friendship on public.blocks;
create trigger blocks_end_friendship after insert on public.blocks
  for each row execute function public.blocks_end_friendship();

-- ---------------------------------------------------------------------
-- 2. Posts, likes, comments
-- ---------------------------------------------------------------------
create table if not exists public.posts (
  id            bigint generated always as identity primary key,
  author_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  country_code  text not null,
  kind          text not null default 'thoughts' check (kind in ('sotd', 'discovery', 'haul', 'question', 'thoughts')),
  body          text not null check (char_length(body) between 1 and 1000),
  perfume_id    bigint references public.perfumes(id) on delete set null,
  photo_url     text,
  is_hidden     boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists posts_country_time_idx on public.posts (country_code, created_at desc);
create index if not exists posts_author_time_idx on public.posts (author_id, created_at desc);

create table if not exists public.post_likes (
  post_id    bigint not null references public.posts(id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists post_likes_user_idx on public.post_likes (user_id);

create table if not exists public.post_comments (
  id         bigint generated always as identity primary key,
  post_id    bigint not null references public.posts(id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 600),
  created_at timestamptz not null default now()
);
create index if not exists post_comments_post_idx on public.post_comments (post_id, created_at);

-- Who may see a post: its author and admins always; other active members in the
-- same country when it isn't hidden and nobody blocked anybody.
create or replace function public.can_see_post(p_post bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.posts p
     where p.id = p_post and auth.uid() is not null
       and (p.author_id = auth.uid() or public.is_admin()
            or (public.is_active_member() and not p.is_hidden
                and not public.is_blocked_with(p.author_id)
                and p.country_code = (select country_code from public.profiles where id = auth.uid())))
  );
$$;

alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;
revoke all on public.posts, public.post_likes, public.post_comments from anon, authenticated;
grant select on public.posts, public.post_likes, public.post_comments to authenticated;
grant delete on public.posts, public.post_comments to authenticated;

drop policy if exists "see posts" on public.posts;
create policy "see posts" on public.posts for select to authenticated using (public.can_see_post(id));
drop policy if exists "delete own post" on public.posts;
create policy "delete own post" on public.posts for delete to authenticated using (author_id = auth.uid() or public.is_admin());
drop policy if exists "see likes" on public.post_likes;
create policy "see likes" on public.post_likes for select to authenticated using (public.can_see_post(post_id));
drop policy if exists "see post comments" on public.post_comments;
create policy "see post comments" on public.post_comments for select to authenticated
  using (public.can_see_post(post_id) and not public.is_blocked_with(user_id));
drop policy if exists "delete own post comment" on public.post_comments;
create policy "delete own post comment" on public.post_comments for delete to authenticated
  using (user_id = auth.uid() or public.is_admin()
         or exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));

create or replace function public.create_post(p_kind text, p_body text, p_perfume bigint, p_photo_url text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_body text := trim(coalesce(p_body, ''));
begin
  if not public.is_active_member() then raise exception 'Your account cannot do this right now.'; end if;
  if char_length(v_body) = 0 then raise exception 'Write something first.'; end if;
  if p_kind not in ('sotd', 'discovery', 'haul', 'question', 'thoughts') then raise exception 'Pick what kind of post this is.'; end if;
  if p_perfume is not null and not exists (select 1 from public.perfumes where id = p_perfume and status = 'approved') then
    raise exception 'Pick a perfume from the catalog.';
  end if;
  -- Photos must be the author's own upload in the bottle-photos bucket.
  if p_photo_url is not null and position('/storage/v1/object/public/bottle-photos/' || auth.uid()::text || '/' in p_photo_url) = 0 then
    raise exception 'Please upload the photo again.';
  end if;
  if (select count(*) from public.posts where author_id = auth.uid() and created_at > now() - interval '1 day') >= 20 then
    raise exception 'You''ve posted a lot today. Please come back tomorrow.';
  end if;
  insert into public.posts (author_id, country_code, kind, body, perfume_id, photo_url)
  values (auth.uid(), (select country_code from public.profiles where id = auth.uid()), p_kind, left(v_body, 1000), p_perfume, p_photo_url)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.like_post(p_post bigint, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_active_member() then raise exception 'Your account cannot do this right now.'; end if;
  if not public.can_see_post(p_post) then raise exception 'Post not found.'; end if;
  if p_on then insert into public.post_likes (post_id, user_id) values (p_post, auth.uid()) on conflict do nothing;
  else delete from public.post_likes where post_id = p_post and user_id = auth.uid(); end if;
end;
$$;

create or replace function public.comment_post(p_post bigint, p_body text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_active_member() then raise exception 'Your account cannot do this right now.'; end if;
  if not public.can_see_post(p_post) then raise exception 'Post not found.'; end if;
  if char_length(trim(coalesce(p_body, ''))) = 0 then raise exception 'Write something first.'; end if;
  if (select count(*) from public.post_comments where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'That''s a lot of comments. Please wait a little.';
  end if;
  insert into public.post_comments (post_id, user_id, body) values (p_post, auth.uid(), left(trim(p_body), 600));
end;
$$;

create or replace function public.admin_set_post_hidden(p_post bigint, p_hidden boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  update public.posts set is_hidden = p_hidden where id = p_post;
end;
$$;

-- Discover: the perfumes most added to wishlists lately, in your country.
create or replace function public.trending_wishes(p_days int default 14)
returns table (perfume_id bigint, wanted bigint)
language sql stable security definer set search_path = public as $$
  select w.perfume_id, count(*) as wanted
    from public.wishlist_items w
    join public.profiles p on p.id = w.user_id
   where auth.uid() is not null and public.is_active_member()
     and w.created_at > now() - make_interval(days => least(greatest(coalesce(p_days, 14), 1), 60))
     and p.country_code = (select country_code from public.profiles where id = auth.uid())
     and not p.is_banned
   group by w.perfume_id
   order by count(*) desc, max(w.created_at) desc
   limit 8;
$$;

-- ---------------------------------------------------------------------
-- 3. Reports and profile visibility
-- ---------------------------------------------------------------------
alter table public.reports add column if not exists target_post_id bigint references public.posts(id) on delete set null;
alter table public.reports add column if not exists target_post_comment_id bigint references public.post_comments(id) on delete set null;

-- Same as 020, plus: people who post or comment, and your friends / requests.
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
    or exists (select 1 from public.posts where author_id = p_id and not is_hidden)
    or exists (select 1 from public.post_comments where user_id = p_id)
    or exists (select 1 from public.friendships where user_a = least(auth.uid(), p_id) and user_b = greatest(auth.uid(), p_id))
  );
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'are_friends(uuid)', 'send_friend_request(uuid)', 'respond_friend_request(uuid,boolean)', 'remove_friend(uuid)',
    'can_see_post(bigint)', 'create_post(text,text,bigint,text)', 'like_post(bigint,boolean)', 'comment_post(bigint,text)',
    'admin_set_post_hidden(bigint,boolean)', 'trending_wishes(int)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  execute 'revoke execute on function public.blocks_end_friendship() from public, anon, authenticated';
end $$;
