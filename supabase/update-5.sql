-- ScanSay update 5: case workflow (in progress, assigned staff), team chat, rating per aspect.
-- Run once in Supabase → SQL Editor → New query → paste → Run (safe to run again).
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
