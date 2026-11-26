-- Swapfume live update — 034 wishlist alerts
-- Same as supabase/migrations/034_wishlist_alerts.sql.
-- Safe to run more than once. Run the files in this folder in number order.

-- =====================================================================
-- Swapfume — 034: wishlist alerts
-- Run AFTER 033. Safe to run more than once.
--   When a perfume becomes available to swap (listed as tradeable, switched to tradeable, or
--   back in stock), the members who have it on their wishlist hear about it ("wish_listed").
--   Who: same country as the person listing it, or their friends (perfume is hard to mail
--   abroad); never the owner, never between people who blocked each other, never banned or
--   unconfirmed members, and only if they leave profiles.wish_alerts on.
--   How often: at most one alert per member per perfume every 7 days.
-- =====================================================================

alter table public.profiles add column if not exists wish_alerts boolean not null default true;
grant update (wish_alerts) on public.profiles to authenticated;

alter table public.notifications add column if not exists perfume_id bigint references public.perfumes(id) on delete cascade;
alter table public.notifications add column if not exists item_id bigint references public.collection_items(id) on delete set null;
create index if not exists notifications_wish_idx on public.notifications (user_id, perfume_id, created_at desc) where kind = 'wish_listed';

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'message', 'comment', 'also_commented', 'like', 'friend_request', 'friend_accept',
  'swap_proposal', 'gift', 'swap_accepted', 'swap_declined', 'swap_cancelled',
  'swap_shipped', 'swap_received', 'swap_completed', 'review',
  'meetup_join', 'meetup_comment', 'meetup_cancelled',
  'circle_join', 'circle_started', 'circle_turn', 'circle_moved', 'circle_won', 'circle_cancelled',
  'invite_joined', 'reply', 'mention', 'claim_opened', 'claim_resolved', 'wish_listed'));

create or replace function public.trg_wish_listed() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_owner public.profiles;
  v_detail text;
  v_now_open boolean := new.tradeable and not new.is_hidden and coalesce(new.quantity, 1) > 0;
  v_was_open boolean := false;
  r record;
begin
  if tg_op = 'UPDATE' then
    v_was_open := old.tradeable and not old.is_hidden and coalesce(old.quantity, 1) > 0;
  end if;
  if not v_now_open or v_was_open then return new; end if;   -- only the moment it becomes available

  select * into v_owner from public.profiles where id = new.owner_id;
  if not found or v_owner.is_banned then return new; end if;
  v_detail := case new.size when 'full' then 'Full bottle' when 'decant' then 'Decant' else 'Sample' end
              || coalesce(' · ' || trim_scale(new.volume_ml)::text || ' ml', '');

  for r in
    select w.user_id from public.wishlist_items w
    join public.profiles p on p.id = w.user_id
    where w.perfume_id = new.perfume_id
      and w.user_id <> new.owner_id
      and p.wish_alerts and not p.is_banned and p.adult_confirmed_at is not null
      and (p.country_code = v_owner.country_code
           or exists (select 1 from public.friendships f where f.status = 'accepted'
                      and f.user_a = least(w.user_id, new.owner_id) and f.user_b = greatest(w.user_id, new.owner_id)))
      and not exists (select 1 from public.notifications n where n.user_id = w.user_id and n.kind = 'wish_listed'
                      and n.perfume_id = new.perfume_id and n.created_at > now() - interval '7 days')
    limit 500
  loop
    perform public.notify(r.user_id, new.owner_id, 'wish_listed', null, null, null, null, v_detail);
    update public.notifications set perfume_id = new.perfume_id, item_id = new.id
     where id = (select max(id) from public.notifications where user_id = r.user_id and kind = 'wish_listed' and perfume_id is null);
  end loop;
  return new;
end; $$;

drop trigger if exists wish_listed on public.collection_items;
create trigger wish_listed after insert or update of tradeable, is_hidden, quantity on public.collection_items
  for each row execute function public.trg_wish_listed();
