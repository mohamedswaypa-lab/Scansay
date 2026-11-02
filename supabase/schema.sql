-- ScanSay database (Supabase, region: EU North / Stockholm).
-- Run once: Supabase → SQL Editor → paste everything → Run.
-- All tables have Row Level Security ON and no policies: only the server (service key) can read or write.
-- The browser never talks to the database directly.

create extension if not exists pgcrypto;

-- Customer companies
create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  org text,
  ind text not null default 'hotel',
  city text,
  email text,
  phone text,
  plan text,
  seats int not null default 3,
  places int,
  mods jsonb not null default '{"staff":false,"ai":true}',
  locked boolean not null default false,
  billing jsonb not null default '{}',     -- plan, price, interval, method, stripe ids, status
  state jsonb not null default '{}'        -- dashboard: groups, sections, places, alarms, staff, settings
);

-- People who can log in to a company dashboard (linked to Supabase Auth users)
create table if not exists members (
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  role text not null default 'Ägare',      -- Ägare, Gruppadmin, Handläggare, Läsare
  name text,
  email text,
  created_at timestamptz not null default now(),
  primary key (user_id, account_id)
);

-- Every printed QR code points to one place
create table if not exists codes (
  code text primary key,
  account_id uuid not null references accounts(id) on delete cascade,
  group_id text, group_name text, company text, ind text,
  sec_key text, sec_name text, place text,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
create index if not exists codes_account on codes(account_id);

-- Messages from guests (verified with a one-time code)
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  account_id uuid not null references accounts(id) on delete cascade,
  code text, group_id text, sec_key text, sec_name text, place text,
  type text not null default 'c',          -- c complaint, p praise, i idea
  topic text, rating int, quick text,
  urgent boolean not null default false,
  message text, name text,
  via text,                                -- email or sms
  contact text,                            -- only used to send the reply; never shown to staff
  contact_key text,                        -- hash, for "one message per person, place and day"
  image text,                              -- small JPEG as data URL (optional)
  status text not null default 'new',      -- new, prog, fix
  fixed_at timestamptz,
  replies jsonb not null default '[]'
);
create index if not exists feedback_account on feedback(account_id, created_at desc);
create index if not exists feedback_dupe on feedback(contact_key, code, created_at desc);

-- One-time codes (10 minutes, max 5 tries, single use)
create table if not exists otps (
  id text primary key,
  hash text not null,
  contact_key text not null,
  method text not null,
  contact text not null,
  code text,
  tries int not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- Rate limits
create table if not exists hits (
  bucket text not null,
  ts timestamptz not null default now()
);
create index if not exists hits_bucket on hits(bucket, ts desc);

-- Applications from the website
create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  data jsonb not null,
  status text not null default 'new'
);

-- Signed agreements (evidence if a payment is disputed)
create table if not exists signatures (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  ref text, company text, org text, name text, title text, email text,
  ip text, user_agent text, version text, hash text, data jsonb
);

-- The admin console's working data (one row)
create table if not exists admin_state (
  id int primary key default 1,
  doc jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- Stripe webhook events already handled
create table if not exists stripe_events (
  id text primary key,
  created_at timestamptz not null default now()
);

alter table accounts enable row level security;
alter table members enable row level security;
alter table codes enable row level security;
alter table feedback enable row level security;
alter table otps enable row level security;
alter table hits enable row level security;
alter table applications enable row level security;
alter table signatures enable row level security;
alter table admin_state enable row level security;
alter table stripe_events enable row level security;

-- Offers and negotiation
create table if not exists offers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  app_id uuid references applications(id) on delete cascade,
  version int not null default 1,
  data jsonb not null,            -- the offer: package, price, period, payment, places, agents, modules
  note text,                      -- your message to the customer
  status text not null default 'sent',   -- sent, changes, signed, declined, superseded
  reply jsonb,                    -- the customer's answer (message, wished price) or the signature record
  replied_at timestamptz
);
create index if not exists offers_app on offers(app_id, created_at desc);
alter table offers enable row level security;

-- Retention (GDPR): after this, turn on pg_cron and run supabase/retention.sql
