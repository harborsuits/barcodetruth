-- Add index for faster user_roles lookups
create index if not exists idx_user_roles_user_id_role on user_roles(user_id, role);