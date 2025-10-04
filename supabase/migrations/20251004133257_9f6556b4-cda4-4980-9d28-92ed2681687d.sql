-- Add moderator to app_role enum if not exists
do $$ begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on e.enumtypid = t.oid
    where t.typname = 'app_role' and e.enumlabel = 'moderator'
  ) then
    alter type app_role add value 'moderator';
  end if;
end $$;