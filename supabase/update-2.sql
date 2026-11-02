-- ScanSay update 2: offers and negotiation. Run once in Supabase → SQL Editor (safe to run again).
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
