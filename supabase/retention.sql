-- ScanSay: automatic deletion (GDPR). Run AFTER turning on the pg_cron extension
-- (Supabase → Database → Extensions → pg_cron). Runs every night at 03:15.
select cron.schedule('scansay-retention', '15 3 * * *', $$
  delete from feedback where created_at < now() - interval '12 months';
  delete from otps where expires_at < now() - interval '1 day';
  delete from hits where ts < now() - interval '1 day';
$$);
