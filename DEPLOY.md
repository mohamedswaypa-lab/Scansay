# ScanSay på GitHub + Vercel

## 1. Ladda upp
Lägg hela mappen i ert GitHub-repo (ersätt de gamla filerna) och låt Vercel bygga om. Inga byggsteg behövs: sidan är statisk och mappen `api/` blir serverfunktioner automatiskt.

## 2. Miljövariabler i Vercel
Project → Settings → Environment Variables. Lägg in och gör sedan en ny deploy.

| Variabel | Vad | Exempel |
|---|---|---|
| `ADMIN_TOKEN` | Lösenordet till admin (lång slumpsträng) | `openssl rand -hex 24` |
| `SIGN_SECRET` | Låser signeringslänkar så pris och villkor inte kan ändras | `openssl rand -hex 32` |
| `BREVO_API_KEY` | E-post via Brevo (EU). Skapa konto på brevo.com och verifiera domänen scansay.se (SPF/DKIM) | `xkeysib-...` |
| `MAIL_FROM` | Avsändare | `ScanSay <hello@scansay.se>` |
| `ELKS_USER`, `ELKS_PASS` | Sms via 46elks (Sverige) | från 46elks.se |
| `SMS_FROM` | Avsändarnamn för sms (max 11 tecken) | `ScanSay` |
| `NOTIFY_EMAIL` | Hit skickas nya ansökningar och signerade avtal | `hello@scansay.se` |
| `SITE_URL` | Er adress | `https://scansay.se` |

## 3. Admin
Gå till `/admin/`. På den riktiga domänen loggar du in med `ADMIN_TOKEN`. Därefter kan du:
- skicka e-post och sms till företag (bekräfta konto, be om info, påminnelse)
- skicka offert och avtal för **elektronisk signering**. Kunden signerar på `/sign/`. Ett signerat exemplar med logg (namn, titel, e-post, IP, tid, avtalsversion, kontrollsumma) mejlas till kunden och till `NOTIFY_EMAIL`. **Spara de mejlen**: de är ert bevis om en betalning bestrids.

Fyll i ert org.nr, momsnummer, bankgiro och adress under Admin → Inställningar → Företagsuppgifter i avtalet.

## 4. Det här kräver mer arbete innan skarp drift
- **Riktig inloggning för kunder** (glömt lösenord skickar i dag bara bekräftelse): koppla en inloggningstjänst, t.ex. Supabase Auth eller Clerk, och en databas för konton och meddelanden. Adminens data ligger i dag i webbläsaren.
- **Kortbetalning**: `server/stripe.js` är förberedd. Flytta den till `api/` och lägg in `STRIPE_SECRET_KEY` och `STRIPE_WEBHOOK_SECRET`.
- **Verifieringskoder i feedbackformuläret**: `server/submit.js` ska på samma sätt flyttas till `api/`.

## 5. Juridik
Avtalet (`legal/contract.js`), allmänna villkor (`legal/villkor.html`), biträdesavtalet (`legal/pub-avtal.html`) samt DPIA, registerförteckning och MBL-mall (`admin/docs/`) är mallar på svenska. **Låt en svensk jurist granska dem** innan ni skickar dem till kunder, och fyll i alla [hakparenteser].
