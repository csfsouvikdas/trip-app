-- Drop existing tables if they exist to apply changes cleanly
drop table if exists public.menu_plan cascade;
drop table if exists public.checklist_items cascade;
drop table if exists public.expenses cascade;
drop table if exists public.trips cascade;
drop table if exists public.profiles cascade;

-- Drop legacy triggers/functions if they exist
drop function if exists public.handle_new_user() cascade;

-- 1. Profiles Table
create table if not exists public.profiles (
  id uuid default gen_random_uuid() primary key,
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  full_name text not null,
  username text unique not null,
  email text,
  is_admin boolean not null default false,
  avatar_url text
);

-- Disable RLS for Profiles
alter table public.profiles disable row level security;

-- 2. Trips Table
create table if not exists public.trips (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  total_budget numeric(12, 2) not null default 0.00 check (total_budget >= 0),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Disable RLS for Trips
alter table public.trips disable row level security;

-- 3. Expenses Table
create table if not exists public.expenses (
  id uuid default gen_random_uuid() primary key,
  trip_id uuid references public.trips(id) on delete cascade not null,
  amount numeric(12, 2) not null check (amount >= 0),
  description text not null,
  category text not null,
  date date not null default current_date,
  created_by text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Disable RLS for Expenses
alter table public.expenses disable row level security;

-- 4. Checklist Items Table
create table if not exists public.checklist_items (
  id uuid default gen_random_uuid() primary key,
  trip_id uuid references public.trips(id) on delete cascade not null,
  task text not null,
  is_completed boolean not null default false,
  day date not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Disable RLS for Checklist Items
alter table public.checklist_items disable row level security;

-- 5. Menu Plan Table
create table if not exists public.menu_plan (
  id uuid default gen_random_uuid() primary key,
  trip_id uuid references public.trips(id) on delete cascade not null,
  meal_name text not null,
  day date not null,
  time text not null, -- e.g., 'Breakfast', 'Lunch', 'Dinner'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Disable RLS for Menu Plan
alter table public.menu_plan disable row level security;

-- Enable Supabase Realtime replication on trips, expenses, checklist_items, and menu_plan
do $$
begin
  begin
    alter publication supabase_realtime add table public.trips;
  exception when others then
  end;
  
  begin
    alter publication supabase_realtime add table public.expenses;
  exception when others then
  end;
  
  begin
    alter publication supabase_realtime add table public.checklist_items;
  exception when others then
  end;
  
  begin
    alter publication supabase_realtime add table public.menu_plan;
  exception when others then
  end;
end $$;

-- Seed Data: Insert User "souvik" as admin
insert into public.profiles (full_name, username, email, is_admin)
values ('Souvik', 'souvik', 'souvik@example.com', true)
on conflict (username) do nothing;

-- 6. Itinerary Table
create table if not exists public.itinerary (
  id uuid default gen_random_uuid() primary key,
  trip_id uuid references public.trips(id) on delete cascade not null,
  date date not null,
  location text not null,
  description text,
  image_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Disable RLS for Itinerary
alter table public.itinerary disable row level security;

-- Add itinerary to realtime publication
do $$
begin
  begin
    alter publication supabase_realtime add table public.itinerary;
  exception when others then
  end;
end $$;

