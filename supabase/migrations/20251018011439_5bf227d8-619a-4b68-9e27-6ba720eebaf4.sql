-- Grant execute permission on refresh functions to authenticated users
GRANT EXECUTE ON FUNCTION admin_refresh_coverage() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_refresh_coverage() TO anon;

-- Trigger the refresh
SELECT admin_refresh_coverage();