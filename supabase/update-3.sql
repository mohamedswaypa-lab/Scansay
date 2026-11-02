-- ScanSay update 3: mobile notifications (the dashboard as an app on the phone).
-- Run once in Supabase → SQL Editor → New query → paste → Run (safe to run again).
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
