-- ScanSay: automatic deletion (GDPR). Run AFTER turning on the pg_cron extension
-- (Supabase → Database → Extensions → pg_cron). Runs every night at 03:15. Safe to run again (it replaces the job).
-- Guest messages are kept for the period each company chose under GDPR in the dashboard (6, 12, 18 or 24 months, default 12).
-- Before deleting, the numbers are added to stats_monthly (no text, no contact details).
select cron.schedule('scansay-retention', '15 3 * * *', $$
  with old as (
    select f.* from feedback f join accounts a on a.id = f.account_id
    where f.created_at < now() - make_interval(months => coalesce(nullif(a.state->>'retention','')::int, 12))
  )
  insert into stats_monthly (account_id, month, type, n, rating_sum, rated, fixed)
    select account_id, date_trunc('month', created_at)::date, type, count(*), coalesce(sum(rating),0), count(rating), count(*) filter (where status = 'fix')
    from old group by 1, 2, 3
  on conflict (account_id, month, type) do update set n = stats_monthly.n + excluded.n, rating_sum = stats_monthly.rating_sum + excluded.rating_sum,
    rated = stats_monthly.rated + excluded.rated, fixed = stats_monthly.fixed + excluded.fixed;
  delete from feedback f using accounts a where a.id = f.account_id
    and f.created_at < now() - make_interval(months => coalesce(nullif(a.state->>'retention','')::int, 12));
  delete from otps where expires_at < now() - interval '1 day';
  delete from hits where ts < now() - interval '1 day';
  delete from messages where created_at < now() - interval '24 months';
$$);
