-- SignalHost Phase 1 commercial SECURITY DEFINER privilege hardening.
-- Keep internal/trigger helpers out of PostgREST RPC while preserving the
-- authenticated predicates referenced directly by RLS policies.

do $$
declare
  function_signature text;
begin
  foreach function_signature in array array[
    'public.set_commercial_hierarchy_updated_at()',
    'public.ensure_default_department_for_location()',
    'public.partner_role(uuid)',
    'public.organization_partner_id(uuid)',
    'public.can_access_partner(uuid)',
    'public.can_manage_partner(uuid)',
    'public.can_operate_partner(uuid)',
    'public.can_access_organization(uuid)',
    'public.can_manage_organization(uuid)',
    'public.can_operate_organization(uuid)',
    'public.department_location_id(uuid)',
    'public.department_access_mode(uuid)',
    'public.department_role(uuid)',
    'public.can_access_department(uuid)',
    'public.can_manage_department(uuid)',
    'public.can_operate_department(uuid)',
    'public.protect_organization_partner_assignment()',
    'public.protect_default_department_contract()',
    'public.user_has_location_affiliation(uuid,uuid)',
    'public.validate_staff_directory_entry_scope()',
    'public.validate_queue_member_scope()',
    'public.validate_transfer_target_scope()',
    'public.ensure_default_queue_for_department()',
    'public.protect_default_queue_contract()',
    'public.protect_transfer_target_verification()',
    'public.queue_department_id(uuid)',
    'public.can_access_queue(uuid)',
    'public.can_manage_queue(uuid)',
    'public.can_operate_queue(uuid)',
    'public.can_access_staff_directory_entry(uuid)',
    'public.can_manage_staff_directory_entry(uuid)',
    'public.normalize_telephony_provider_key(text)',
    'public.validate_telephony_account_scope()',
    'public.telephony_account_can_serve_location(uuid,uuid)',
    'public.ensure_default_telephony_account(text)',
    'public.telephony_account_provider_key(uuid)',
    'public.can_access_telephony_account(uuid)',
    'public.can_manage_telephony_account(uuid)',
    'public.validate_phone_number_telephony_account()',
    'public.validate_sip_trunk_verification()',
    'public.validate_number_route_scope()',
    'public.protect_number_route_runtime_state()',
    'public.ensure_observed_number_route()',
    'public.phone_number_location_id(uuid)',
    'public.number_route_department_id(uuid)',
    'public.number_route_phone_number_id(uuid)',
    'public.can_access_number_route(uuid)',
    'public.can_manage_number_route(uuid)'
  ]
  loop
    execute format(
      'revoke all privileges on function %s from public, anon, authenticated',
      function_signature
    );
    execute format(
      'grant execute on function %s to service_role',
      function_signature
    );
  end loop;
end;
$$;

-- These functions are called directly by RLS expressions. Authenticated users
-- may execute them, but the functions return only role/access decisions or the
-- phone-number location needed to validate a route write.
grant execute on function public.partner_role(uuid) to authenticated;
grant execute on function public.can_access_partner(uuid) to authenticated;
grant execute on function public.can_manage_partner(uuid) to authenticated;
grant execute on function public.can_operate_partner(uuid) to authenticated;
grant execute on function public.can_access_organization(uuid) to authenticated;
grant execute on function public.can_manage_organization(uuid) to authenticated;
grant execute on function public.can_operate_organization(uuid) to authenticated;
grant execute on function public.can_access_department(uuid) to authenticated;
grant execute on function public.can_manage_department(uuid) to authenticated;
grant execute on function public.can_operate_department(uuid) to authenticated;
grant execute on function public.can_access_queue(uuid) to authenticated;
grant execute on function public.can_manage_queue(uuid) to authenticated;
grant execute on function public.can_operate_queue(uuid) to authenticated;
grant execute on function public.can_access_staff_directory_entry(uuid) to authenticated;
grant execute on function public.can_manage_staff_directory_entry(uuid) to authenticated;
grant execute on function public.can_access_telephony_account(uuid) to authenticated;
grant execute on function public.can_manage_telephony_account(uuid) to authenticated;
grant execute on function public.phone_number_location_id(uuid) to authenticated;
grant execute on function public.can_access_number_route(uuid) to authenticated;
grant execute on function public.can_manage_number_route(uuid) to authenticated;

comment on function public.ensure_default_telephony_account(text) is
  'Internal compatibility helper. Direct RPC execution is denied; table triggers and service operations retain access.';