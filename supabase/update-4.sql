-- ScanSay update 4: parent and daughter companies, roles with sections, guest replies.
-- Run once in Supabase → SQL Editor → New query → paste → Run (safe to run again).
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
