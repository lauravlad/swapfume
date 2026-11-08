-- Swapfume live update — 014 do not keep dates of birth
-- Same as supabase/migrations/014_forget_birthdate.sql.
-- Safe to run more than once. Run the files in this folder in number order.

-- 014: Don't keep members' dates of birth.
-- The Privacy Policy promises we keep only the fact that a member confirmed 18+, not their birthday.
-- Until now the birthdate typed at sign-up stayed in auth.users.raw_user_meta_data.
-- 1) Before a new login row is saved: check 18+, then replace the birthdate with {"adult_ok": true}.
-- 2) handle_new_user() accepts that flag.
-- 3) Remove the birthdate from everyone who already signed up.
-- Safe to run more than once.

create or replace function public.forget_birthdate_on_signup()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_birth date;
begin
  if new.raw_user_meta_data ? 'birthdate' then
    begin
      v_birth := nullif(trim(new.raw_user_meta_data ->> 'birthdate'), '')::date;
    exception when others then
      v_birth := null;
    end;
    if v_birth is not null and not public.is_adult_birthdate(v_birth) then
      raise exception 'You must be 18 or older to join Swapfume.';
    end if;
    new.raw_user_meta_data := (new.raw_user_meta_data - 'birthdate')
      || case when v_birth is not null then '{"adult_ok": true}'::jsonb else '{}'::jsonb end;
  end if;
  return new;
end;
$$;

drop trigger if exists before_auth_user_created on auth.users;
create trigger before_auth_user_created
  before insert on auth.users
  for each row execute function public.forget_birthdate_on_signup();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_birth date;
  v_adult boolean;
begin
  begin
    v_birth := nullif(trim(new.raw_user_meta_data ->> 'birthdate'), '')::date;
  exception when others then
    v_birth := null;
  end;
  if v_birth is not null and not public.is_adult_birthdate(v_birth) then
    raise exception 'You must be 18 or older to join Swapfume.';
  end if;
  v_adult := v_birth is not null or coalesce((new.raw_user_meta_data ->> 'adult_ok')::boolean, false);
  insert into public.profiles (id, display_name, adult_confirmed_at)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)), 40),
    case when v_adult then now() end
  );
  return new;
end;
$$;

revoke execute on function public.forget_birthdate_on_signup() from public, anon, authenticated;

-- Existing members: drop the stored birthdate (their 18+ confirmation is already on their profile).
update auth.users
   set raw_user_meta_data = (raw_user_meta_data - 'birthdate') || '{"adult_ok": true}'::jsonb
 where raw_user_meta_data ? 'birthdate';
