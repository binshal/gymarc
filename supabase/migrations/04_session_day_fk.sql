-- Run once in the Supabase SQL editor.
--
-- Deleting a split day that already has workout history used to fail,
-- because workout_sessions.split_day_id had no delete rule. With
-- "set null" the history stays (day_name is stored on each session) and
-- the day can be deleted freely.

alter table workout_sessions drop constraint if exists workout_sessions_split_day_id_fkey;
alter table workout_sessions
  add constraint workout_sessions_split_day_id_fkey
  foreign key (split_day_id) references split_days(id) on delete set null;
