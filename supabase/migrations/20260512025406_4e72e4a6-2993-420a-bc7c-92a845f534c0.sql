do $$
declare
  fn text;
begin
  for fn in
    select format('%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid))
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'is_platform_admin','organization_role','can_access_organization',
        'can_manage_organization','can_operate_organization','location_organization_id',
        'can_access_location','can_manage_location','can_operate_location',
        'call_location_id','order_location_id','menu_category_location_id'
      )
  loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated, service_role', fn);
  end loop;
end $$;