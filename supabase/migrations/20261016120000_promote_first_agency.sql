create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, role)
  values (new.id, 'client');
  return new;
end;
$$;

create policy "select entitlements of owned or agency sites"
  on public.entitlements for select
  using (public.is_agency() or public.owns_site(site_id));

create policy "select submissions of owned or agency sites"
  on public.form_submissions for select
  using (public.is_agency() or public.owns_site(site_id));

\set agency_user_id 'REPLACE_WITH_USER_UUID'

update public.profiles
set role = 'agency'
where user_id = :'agency_user_id';