-- Run once in the Supabase SQL editor.
--
-- Problem: profiles is readable by every logged-in user (needed for the
-- feed to show usernames), which also exposed recovery_code. And users
-- could update their own row, including is_admin.
--
-- Fix: column-level privileges. Only safe columns are readable, and only
-- two columns are writable by the app. The server (service role) is not
-- affected, so signup, reset and the admin page keep working.

revoke select on profiles from anon, authenticated;
grant select (id, username, is_admin, units, daily_water_target_ml, created_at)
  on profiles to authenticated;

revoke update on profiles from anon, authenticated;
grant update (units, daily_water_target_ml) on profiles to authenticated;

-- Make yourself the first admin (replace with your username):
-- update profiles set is_admin = true where username = 'your_username';
