-- =====================================================================
-- Swapfume — 030: interest groups
-- Run AFTER 029. Safe to run more than once.
--   * groups: open to every active member in any country (like a club you can walk into).
--     Eight starter groups come with Swapfume; members can start up to 2 of their own.
--   * group_members: who joined (role 'admin' for the person who started it).
--   * posts.group_id: a post made inside a group. Group posts show in that group, not in the
--     Feed/Discover. Anyone who can see the group can read them; only members can post.
--   * create_post(kind, body, perfume, photo, group) replaces the four-argument version.
-- =====================================================================

create table if not exists public.groups (
  id           bigint generated always as identity primary key,
  slug         text unique,
  name         text not null check (char_length(name) between 3 and 60),
  description  text not null default '' check (char_length(description) <= 500),
  emoji        text not null default '🫧' check (char_length(emoji) between 1 and 8),
  created_by   uuid references public.profiles(id) on delete set null,
  is_official  boolean not null default false,
  is_hidden    boolean not null default false,
  created_at   timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id   bigint not null references public.groups(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       text not null default 'member' check (role in ('member', 'admin')),
  joined_at  timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists group_members_user_idx on public.group_members (user_id);

alter table public.posts add column if not exists group_id bigint references public.groups(id) on delete cascade;
create index if not exists posts_group_time_idx on public.posts (group_id, created_at desc) where group_id is not null;

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
revoke all on public.groups, public.group_members from anon, authenticated;
grant select on public.groups, public.group_members to authenticated;
drop policy if exists "see groups" on public.groups;
create policy "see groups" on public.groups for select to authenticated
  using (not is_hidden or public.is_admin() or created_by = auth.uid());
drop policy if exists "see group members" on public.group_members;
create policy "see group members" on public.group_members for select to authenticated using (auth.uid() is not null);

insert into public.groups (slug, name, description, emoji, is_official) values
  ('niche', 'Niche houses', 'Le Labo, Byredo, MFK, Diptyque, Frédéric Malle and the small independent houses.', '🕯️', true),
  ('oud', 'Ouds & ambers', 'Middle Eastern perfumery, attars, ouds, ambers and resins.', '🪔', true),
  ('vintage', 'Vintage & classics', 'Old formulations, discontinued treasures and the great classics.', '🎞️', true),
  ('designer', 'Designer favourites', 'Dior, Chanel, YSL, Armani and every department-store love.', '💄', true),
  ('fresh', 'Fresh & green', 'Citrus, colognes, aquatics, greens and tea.', '🍋', true),
  ('gourmand', 'Gourmands', 'Vanilla, tonka, caramel, coffee: perfumes good enough to eat.', '🍮', true),
  ('decanting', 'Decanters'' corner', 'Tips on decanting, vials, labels and packing that arrives safely.', '🧪', true),
  ('beginners', 'Beginners welcome', 'New to perfume? Ask anything. No question is silly here.', '🌱', true)
on conflict (slug) do nothing;

-- Group posts: visible to any active member (not blocked) as long as the group isn't hidden.
create or replace function public.can_see_post(p_post bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.posts p
     where p.id = p_post and auth.uid() is not null
       and (p.author_id = auth.uid() or public.is_admin()
            or (public.is_active_member() and not p.is_hidden
                and not public.is_blocked_with(p.author_id)
                and (case when p.group_id is not null
                          then exists (select 1 from public.groups g where g.id = p.group_id and not g.is_hidden)
                          else (p.country_code = (select country_code from public.profiles where id = auth.uid())
                                or public.are_friends(p.author_id)) end)))
  );
$$;

drop function if exists public.create_post(text, text, bigint, text);
create or replace function public.create_post(p_kind text, p_body text, p_perfume bigint, p_photo_url text, p_group bigint default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_body text := trim(coalesce(p_body, ''));
begin
  if not public.is_active_member() then raise exception 'Your account cannot do this right now.'; end if;
  if char_length(v_body) = 0 then raise exception 'Write something first.'; end if;
  if p_kind not in ('sotd', 'discovery', 'haul', 'question', 'thoughts') then raise exception 'Pick what kind of post this is.'; end if;
  if p_perfume is not null and not exists (select 1 from public.perfumes where id = p_perfume and status = 'approved') then
    raise exception 'Pick a perfume from the catalog.';
  end if;
  if p_photo_url is not null and position('/storage/v1/object/public/bottle-photos/' || auth.uid()::text || '/' in p_photo_url) = 0 then
    raise exception 'Please upload the photo again.';
  end if;
  if p_group is not null and not exists (select 1 from public.group_members m join public.groups g on g.id = m.group_id
                                         where m.group_id = p_group and m.user_id = auth.uid() and not g.is_hidden) then
    raise exception 'Join the group to post in it.';
  end if;
  if (select count(*) from public.posts where author_id = auth.uid() and created_at > now() - interval '1 day') >= 20 then
    raise exception 'You''ve posted a lot today. Please come back tomorrow.';
  end if;
  insert into public.posts (author_id, country_code, kind, body, perfume_id, photo_url, group_id)
  values (auth.uid(), (select country_code from public.profiles where id = auth.uid()), p_kind, left(v_body, 1000), p_perfume, p_photo_url, p_group)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.join_group(p_group bigint, p_join boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not p_join then delete from public.group_members where group_id = p_group and user_id = auth.uid(); return; end if;
  if not public.is_active_member() then raise exception 'Your account cannot do this right now.'; end if;
  if not exists (select 1 from public.groups where id = p_group and not is_hidden) then raise exception 'Group not found.'; end if;
  if (select count(*) from public.group_members where user_id = auth.uid()) >= 30 then raise exception 'You can be in up to 30 groups.'; end if;
  insert into public.group_members (group_id, user_id) values (p_group, auth.uid()) on conflict do nothing;
end; $$;

create or replace function public.create_group(p_name text, p_description text, p_emoji text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_name text := trim(coalesce(p_name, ''));
begin
  if not public.is_active_member() then raise exception 'Your account cannot do this right now.'; end if;
  if char_length(v_name) < 3 then raise exception 'Give the group a name.'; end if;
  if exists (select 1 from public.groups where lower(name) = lower(v_name)) then raise exception 'There''s already a group with that name. Join it instead!'; end if;
  if (select count(*) from public.groups where created_by = auth.uid()) >= 2 then raise exception 'You can start up to 2 groups.'; end if;
  insert into public.groups (name, description, emoji, created_by)
  values (left(v_name, 60), left(trim(coalesce(p_description, '')), 500), coalesce(nullif(left(trim(p_emoji), 8), ''), '🫧'), auth.uid())
  returning id into v_id;
  insert into public.group_members (group_id, user_id, role) values (v_id, auth.uid(), 'admin');
  return v_id;
end; $$;

create or replace function public.admin_set_group_hidden(p_group bigint, p_hidden boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  update public.groups set is_hidden = p_hidden where id = p_group;
end; $$;

do $$
declare f text;
begin
  foreach f in array array['create_post(text, text, bigint, text, bigint)', 'join_group(bigint, boolean)',
    'create_group(text, text, text)', 'admin_set_group_hidden(bigint, boolean)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
