create or replace function public.prevent_duplicate_profile_phone()
returns trigger language plpgsql security definer set search_path = public as $$
declare k text;
begin
  if new.phone is null or btrim(new.phone) = '' then return new; end if;
  if tg_op = 'UPDATE' and new.phone is not distinct from old.phone then return new; end if;
  k := right(regexp_replace(new.phone, '\D', '', 'g'), 9);
  if length(k) < 9 then return new; end if;
  perform pg_advisory_xact_lock(hashtext('profile_phone:' || k));
  if exists (select 1 from public.profiles p where p.id <> new.id and p.phone is not null
             and right(regexp_replace(p.phone, '\D', '', 'g'), 9) = k) then
    raise exception 'PHONE_ALREADY_USED' using errcode = '23505';
  end if;
  return new;
end $$;
revoke all on function public.prevent_duplicate_profile_phone() from public, anon, authenticated;
drop trigger if exists profiles_unique_phone on public.profiles;
create trigger profiles_unique_phone before insert or update of phone on public.profiles
for each row execute function public.prevent_duplicate_profile_phone();