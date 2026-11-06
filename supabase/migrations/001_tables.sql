-- =====================================================================
-- Swapfume perfume swap — 001: tables
-- Run this first in the Supabase SQL editor (or with `supabase db push`).
-- Plain-language summary:
--   profiles           one row per member (public info only)
--   private_addresses  shipping address; only shown to a swap partner after both accept
--   perfumes           the shared catalog (approved) + member requests (pending)
--   collection_items   bottles/samples/decants a member owns
--   wishlist_items     perfumes a member wants
--   swaps / swap_items a proposed trade and what is in it
--   reviews            1–5 stars after a completed swap
--   reports            "something is wrong" reports for the admin
-- =====================================================================

-- Turns "Maison Francis Kurkdjian" / "maison  francis-kurkdjian" into the same key,
-- so the catalog can spot duplicates.
create or replace function public.norm_text(t text)
returns text
language sql
immutable
as $$
  select regexp_replace(
           translate(lower(coalesce(t, '')),
                     'àáâãäåāçćčèéêëēėęìíîïīñńòóôõöøōùúûüūýÿžźżšśłœæ',
                     'aaaaaaaccceeeeeeeiiiiinnooooooouuuuuyyzzzssloa'),
           '[^a-z0-9]+', '', 'g');
$$;

create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null check (char_length(display_name) between 1 and 40),
  city          text not null default '' check (char_length(city) <= 80),
  country       text not null default '' check (char_length(country) <= 80),
  bio           text not null default '' check (char_length(bio) <= 500),
  is_admin      boolean not null default false,
  is_banned     boolean not null default false,
  created_at    timestamptz not null default now()
);

create table public.private_addresses (
  user_id     uuid primary key references public.profiles(id) on delete cascade default auth.uid(),
  full_name   text not null check (char_length(full_name) between 1 and 120),
  address     text not null check (char_length(address) between 5 and 500),
  updated_at  timestamptz not null default now()
);

create table public.perfumes (
  id             bigint generated always as identity primary key,
  brand          text not null check (char_length(brand) between 1 and 80),
  name           text not null check (char_length(name) between 1 and 120),
  concentration  text not null default '' check (char_length(concentration) <= 60),
  year           int check (year between 1700 and 2100),
  status         text not null default 'pending' check (status in ('approved', 'pending', 'rejected')),
  brand_name_key text generated always as (public.norm_text(brand) || '|' || public.norm_text(name)) stored,
  norm_key       text generated always as
                   (public.norm_text(brand) || '|' || public.norm_text(name) || '|' || public.norm_text(concentration)) stored,
  requested_by   uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);
-- The same brand + name + concentration can only exist once (rejected requests don't count).
create unique index perfumes_norm_key_unique on public.perfumes (norm_key) where status <> 'rejected';
create index perfumes_brand_name_key_idx on public.perfumes (brand_name_key);

create table public.collection_items (
  id           bigint generated always as identity primary key,
  owner_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  perfume_id   bigint not null references public.perfumes(id),
  size         text not null check (size in ('sample', 'decant', 'full')),
  volume_ml    numeric(6,1) check (volume_ml > 0 and volume_ml <= 1000),
  fill_pct     int not null default 100 check (fill_pct between 0 and 100),
  tradeable    boolean not null default false,
  photo_url    text,
  note         text not null default '' check (char_length(note) <= 300),
  is_hidden    boolean not null default false,   -- an admin can hide a reported listing
  created_at   timestamptz not null default now()
);
create index collection_items_owner_idx on public.collection_items (owner_id);
create index collection_items_perfume_idx on public.collection_items (perfume_id) where tradeable;

create table public.wishlist_items (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  perfume_id  bigint not null references public.perfumes(id),
  created_at  timestamptz not null default now(),
  unique (user_id, perfume_id)
);
create index wishlist_items_perfume_idx on public.wishlist_items (perfume_id);

create table public.swaps (
  id                    bigint generated always as identity primary key,
  proposer_id           uuid not null references public.profiles(id) on delete cascade,
  recipient_id          uuid not null references public.profiles(id) on delete cascade,
  status                text not null default 'proposed'
                          check (status in ('proposed', 'accepted', 'declined', 'cancelled', 'completed')),
  message               text not null default '' check (char_length(message) <= 600),
  proposer_shipped_at   timestamptz,
  recipient_shipped_at  timestamptz,
  proposer_received_at  timestamptz,   -- proposer got the recipient's package
  recipient_received_at timestamptz,   -- recipient got the proposer's package
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (proposer_id <> recipient_id)
);
create index swaps_proposer_idx on public.swaps (proposer_id);
create index swaps_recipient_idx on public.swaps (recipient_id);

create table public.swap_items (
  id            bigint generated always as identity primary key,
  swap_id       bigint not null references public.swaps(id) on delete cascade,
  item_id       bigint references public.collection_items(id) on delete set null,
  from_user_id  uuid not null references public.profiles(id) on delete cascade,
  -- snapshot, so the swap still makes sense if the listing is later edited or deleted
  perfume_id    bigint not null references public.perfumes(id),
  size          text not null,
  volume_ml     numeric(6,1)
);
create index swap_items_swap_idx on public.swap_items (swap_id);

create table public.reviews (
  id           bigint generated always as identity primary key,
  swap_id      bigint not null references public.swaps(id) on delete cascade,
  reviewer_id  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  reviewee_id  uuid not null references public.profiles(id) on delete cascade,
  rating       int not null check (rating between 1 and 5),
  comment      text not null default '' check (char_length(comment) <= 600),
  created_at   timestamptz not null default now(),
  unique (swap_id, reviewer_id),
  check (reviewer_id <> reviewee_id)
);
create index reviews_reviewee_idx on public.reviews (reviewee_id);

create table public.reports (
  id              bigint generated always as identity primary key,
  reporter_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  target_user_id  uuid references public.profiles(id) on delete cascade,
  target_item_id  bigint references public.collection_items(id) on delete set null,
  reason          text not null check (char_length(reason) between 3 and 1000),
  status          text not null default 'open' check (status in ('open', 'resolved')),
  created_at      timestamptz not null default now(),
  check (target_user_id is not null or target_item_id is not null)
);

-- When someone signs up, create their profile automatically.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)), 40)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
