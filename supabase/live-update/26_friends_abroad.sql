-- Swapfume live update — 025 friends and swaps across countries
-- Same as supabase/migrations/025_friends_abroad.sql.
-- Safe to run more than once. Run the files in this folder in number order.

-- =====================================================================
-- Swapfume — 025: friends and swaps across countries
-- Run AFTER 024. Safe to run more than once.
--   * Friends can be in any country (send_friend_request no longer checks).
--   * You see your friends' posts wherever they live. Discover, matches,
--     browsing and meetups stay inside your own country.
--   * Swaps, gifts and "Ask a question" may now cross borders. The app shows
--     a reminder that shipping perfume between countries has rules (customs,
--     carriers that refuse alcohol-based liquids) before anyone proposes,
--     offers or accepts. Meeting in person stays same-country only.
-- =====================================================================

-- 1. Friends in any country
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

-- 2. Friends' posts are visible across countries
create or replace function public.can_see_post(p_post bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.posts p
     where p.id = p_post and auth.uid() is not null
       and (p.author_id = auth.uid() or public.is_admin()
            or (public.is_active_member() and not p.is_hidden
                and not public.is_blocked_with(p.author_id)
                and (p.country_code = (select country_code from public.profiles where id = auth.uid())
                     or public.are_friends(p.author_id))))
  );
$$;

-- 3. Swaps and gifts may cross borders (the app reminds members about shipping rules)
drop trigger if exists swaps_same_country on public.swaps;
drop function if exists public.swaps_same_country();

-- 4. "Ask a question" about a listing in another country
create or replace function public.item_thread(p_item bigint)
returns bigint language plpgsql security definer set search_path = public as $$
declare ci public.collection_items; t bigint;
begin
  if not public.is_active_member() then raise exception 'Your account cannot do this right now.'; end if;
  select * into ci from public.collection_items where id = p_item;
  if not found or not ci.tradeable or ci.is_hidden then raise exception 'This listing is not available.'; end if;
  if ci.owner_id = auth.uid() then raise exception 'This is your own listing.'; end if;
  if public.is_blocked_with(ci.owner_id) then raise exception 'This member is not available.'; end if;
  select id into t from public.threads where kind = 'item' and item_id = p_item and user_a = auth.uid();
  if t is null then
    insert into public.threads (kind, item_id, perfume_id, user_a, user_b) values ('item', p_item, ci.perfume_id, auth.uid(), ci.owner_id)
    returning id into t;
  end if;
  return t;
end;
$$;
