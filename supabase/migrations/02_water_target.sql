-- Run this once in the Supabase SQL editor (schema.sql already ran).
alter table profiles add column if not exists daily_water_target_ml int not null default 3000;
