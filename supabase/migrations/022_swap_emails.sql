-- =====================================================================
-- Swapfume — 022: email when someone sends you a swap or gift
-- Run AFTER 021. Safe to run more than once.
--   * profiles.email_notifications: members can turn these emails off (on by default).
--   * swaps.notified_at: each proposal sends at most one email.
--   The swap-email Edge Function (supabase/functions/swap-email) does the sending;
--   it is called by the proposer's browser right after a proposal or gift is made.
-- =====================================================================

alter table public.profiles add column if not exists email_notifications boolean not null default true;
grant update (email_notifications) on public.profiles to authenticated;

alter table public.swaps add column if not exists notified_at timestamptz;

-- Called by the Edge Function as the proposer: claims the one email for a fresh proposal.
-- Returns the recipient's id, or nothing if there's no email to send (already sent, too old,
-- not your proposal, not waiting for an answer, or the recipient turned emails off).
create or replace function public.claim_swap_email(p_swap bigint)
returns uuid language plpgsql security definer set search_path = public as $$
declare v public.swaps;
begin
  select * into v from public.swaps where id = p_swap for update;
  if not found or v.proposer_id is distinct from auth.uid() or v.status <> 'proposed'
     or v.notified_at is not null or v.created_at < now() - interval '30 minutes' then
    return null;
  end if;
  update public.swaps set notified_at = now() where id = p_swap;
  if not coalesce((select email_notifications from public.profiles where id = v.recipient_id), false) then
    return null;
  end if;
  return v.recipient_id;
end;
$$;
revoke execute on function public.claim_swap_email(bigint) from public, anon;
grant execute on function public.claim_swap_email(bigint) to authenticated;
