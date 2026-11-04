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

create table if not exists push_subs (
  endpoint text primary key,                 -- the phone's push address (from Apple/Google/Mozilla)
  p256dh text not null,                      -- the phone's public key, used to encrypt the message
  auth text not null,
  account_id uuid not null references accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  level text not null default 'c',           -- urgent | c (complaints + urgent) | all
  secs jsonb not null default '[]',          -- only these sections (empty = all); urgent always comes
  device text,
  created_at timestamptz not null default now()
);
create index if not exists push_subs_acc on push_subs(account_id);
create index if not exists push_subs_user on push_subs(user_id);
alter table push_subs enable row level security;

-- Review invitations (sent with the reply that closes a case) and clicks
alter table feedback add column if not exists review_invited_at timestamptz;
alter table feedback add column if not exists review_clicked_at timestamptz;
alter table accounts add column if not exists kind text not null default 'site';          -- site = one company/hotel, group = parent company
alter table accounts add column if not exists parent_id uuid references accounts(id) on delete set null;
alter table accounts add column if not exists max_children int not null default 0;          -- how many daughter companies the parent may create
create index if not exists accounts_parent on accounts(parent_id);
alter table members add column if not exists secs jsonb not null default '[]';             -- Medarbetare: only these sections
alter table accounts add column if not exists roles jsonb not null default '{}';              -- logins per role, e.g. {"Gruppadmin":1,"Handläggare":3,"Medarbetare":10,"Läsare":2}

-- Messages between ScanSay (admin) and a company
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  account_id uuid not null references accounts(id) on delete cascade,
  thread uuid not null,
  subject text,
  sender text not null,                      -- admin | company
  by_name text,
  body text not null,
  read_admin boolean not null default false,
  read_company boolean not null default false
);
create index if not exists messages_acc on messages(account_id, created_at desc);
alter table messages enable row level security;

-- Anonymous monthly numbers that stay after the messages are deleted
create table if not exists stats_monthly (
  account_id uuid not null references accounts(id) on delete cascade,
  month date not null,
  type text not null,
  n int not null default 0,
  rating_sum int not null default 0,
  rated int not null default 0,
  fixed int not null default 0,
  primary key (account_id, month, type)
);
alter table stats_monthly enable row level security;
alter table feedback add column if not exists prog_at timestamptz;          -- when the case was moved to "Pågående"
alter table feedback add column if not exists fixed_by text;                -- who closed it
alter table feedback add column if not exists assigned_to uuid;             -- staff member (Medarbetare) the case was sent to
alter table feedback add column if not exists assigned_name text;
alter table feedback add column if not exists assigned_at timestamptz;
alter table feedback add column if not exists task_done_at timestamptz;     -- when the staff member pressed "Klart"
alter table feedback add column if not exists aspects jsonb;                -- e.g. {"Renlighet":4,"Personal":5}

-- Team chat inside a company (and between a parent company and its hotel managers)
create table if not exists chat (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  account_id uuid not null references accounts(id) on delete cascade,
  channel text not null,                     -- team | dm:<user>|<user> | koncern | kdm:<user>|<user>
  user_id uuid,
  by_name text,
  body text not null
);
create index if not exists chat_acc on chat(account_id, channel, created_at desc);
alter table chat enable row level security;
