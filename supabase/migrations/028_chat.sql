-- =====================================================================
-- Swapfume — 028: real-time chat with photos and "Seen"
-- Run AFTER 027. Safe to run more than once.
--   * messages.photo_url: a photo in a message (fill level, packaging...). Must be a photo the
--     sender uploaded to the bottle-photos bucket under their own folder. Text is optional then.
--   * send_message(thread, body, photo): replaces the two-argument version.
--   * Both people in a conversation can see each other's "read up to" time, for "Seen".
--   * messages and thread_reads are published to Supabase Realtime, so new messages and "Seen"
--     arrive instantly (Realtime still applies the row-level security rules above).
-- =====================================================================

alter table public.messages add column if not exists photo_url text;
alter table public.messages drop constraint if exists messages_body_check;
alter table public.messages drop constraint if exists messages_body_or_photo;
alter table public.messages add constraint messages_body_or_photo
  check (char_length(body) <= 1000 and (char_length(body) >= 1 or photo_url is not null));

drop function if exists public.send_message(bigint, text);
create or replace function public.send_message(p_thread bigint, p_body text, p_photo_url text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare t public.threads; other uuid; v_body text := trim(coalesce(p_body, '')); v_photo text := nullif(trim(coalesce(p_photo_url, '')), ''); m bigint;
begin
  if not public.is_active_member() then raise exception 'Your account cannot do this right now.'; end if;
  select * into t from public.threads where id = p_thread;
  if not found or auth.uid() not in (t.user_a, t.user_b) then raise exception 'Conversation not found.'; end if;
  other := case when t.user_a = auth.uid() then t.user_b else t.user_a end;
  if other is null then raise exception 'This member has left Swapfume.'; end if;
  if public.is_blocked_with(other) then raise exception 'You can''t message this member.'; end if;
  if char_length(v_body) = 0 and v_photo is null then raise exception 'Write a message first.'; end if;
  if char_length(v_body) > 1000 then raise exception 'Messages can be up to 1,000 characters.'; end if;
  if v_photo is not null and position('/storage/v1/object/public/bottle-photos/' || auth.uid()::text || '/' in v_photo) = 0 then
    raise exception 'That photo can''t be sent.';
  end if;
  if (select count(*) from public.messages where sender_id = auth.uid() and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'That''s a lot of messages. Please wait a little.';
  end if;
  if v_photo is not null and (select count(*) from public.messages where sender_id = auth.uid() and photo_url is not null and created_at > now() - interval '1 day') >= 30 then
    raise exception 'That''s a lot of photos today. Please try again tomorrow.';
  end if;
  insert into public.messages (thread_id, sender_id, body, photo_url) values (p_thread, auth.uid(), v_body, v_photo) returning id into m;
  update public.threads set last_message_at = now() where id = p_thread;
  insert into public.thread_reads (thread_id, user_id, last_read_at) values (p_thread, auth.uid(), now())
  on conflict (thread_id, user_id) do update set last_read_at = now();
  return m;
end;
$$;
revoke execute on function public.send_message(bigint, text, text) from public, anon;
grant execute on function public.send_message(bigint, text, text) to authenticated;

-- "Seen": both people in a conversation may read each other's read marks for it.
drop policy if exists "read my read marks" on public.thread_reads;
drop policy if exists "read read marks in my threads" on public.thread_reads;
create policy "read read marks in my threads" on public.thread_reads for select to authenticated using (public.in_thread(thread_id));

-- Realtime: new messages and read marks arrive instantly.
do $$
declare tb text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach tb in array array['messages', 'thread_reads'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = tb) then
        execute format('alter publication supabase_realtime add table public.%I', tb);
      end if;
    end loop;
  end if;
end $$;
