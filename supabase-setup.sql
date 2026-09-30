-- ============================================================
-- HALOGRAVE — Supabase setup
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- It creates two tables and locks them so each person can only
-- see and change their own bag and orders.
-- ============================================================

-- Each signed-in user's bag (one row per user)
create table if not exists public.carts (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  items      jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.carts enable row level security;

drop policy if exists "Read own cart"   on public.carts;
drop policy if exists "Insert own cart" on public.carts;
drop policy if exists "Update own cart" on public.carts;

create policy "Read own cart"   on public.carts for select using (auth.uid() = user_id);
create policy "Insert own cart" on public.carts for insert with check (auth.uid() = user_id);
create policy "Update own cart" on public.carts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Every order a user places
create table if not exists public.orders (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  items      jsonb not null,
  total      numeric not null,
  created_at timestamptz not null default now()
);

alter table public.orders enable row level security;

drop policy if exists "Read own orders"   on public.orders;
drop policy if exists "Insert own orders" on public.orders;

create policy "Read own orders"   on public.orders for select using (auth.uid() = user_id);
create policy "Insert own orders" on public.orders for insert with check (auth.uid() = user_id);
