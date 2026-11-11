-- Swapfume live update — 021 daily limit for AI photo recognition
-- Same as supabase/migrations/021_ai_photos.sql.
-- Safe to run more than once. Run the files in this folder in number order.

-- =====================================================================
-- Swapfume — 021: daily limit for "Take a photo" (AI perfume recognition)
-- Run AFTER 020. Safe to run more than once.
--   Each photo costs a few cents, so each member can identify at most 10
--   photos per 24 hours. The identify-perfumes Edge Function calls
--   use_ai_photo() as the member before asking the AI.
--   Only the time is kept (no photo, nothing about what was in it).
-- =====================================================================

create table if not exists public.ai_photo_uses (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists ai_photo_uses_user_time on public.ai_photo_uses (user_id, created_at);
alter table public.ai_photo_uses enable row level security;
revoke all on public.ai_photo_uses from anon, authenticated;

create or replace function public.use_ai_photo()
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_active_member() then raise exception 'Your account cannot do this right now.'; end if;
  if (select count(*) from public.ai_photo_uses where user_id = auth.uid() and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'You''ve used your 10 photos for today. Paste a list instead, or try again tomorrow.';
  end if;
  insert into public.ai_photo_uses (user_id) values (auth.uid());
  delete from public.ai_photo_uses where created_at < now() - interval '7 days';
end;
$$;
revoke execute on function public.use_ai_photo() from public, anon;
grant execute on function public.use_ai_photo() to authenticated;
