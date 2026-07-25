# Dart Bingo

Realtime multiplayer dart-bingo drankspel. React + Vite, Supabase (Postgres + Realtime + Auth) als backend, gehost op Vercel.

## Lokaal draaien

```bash
npm install
cp .env.local.example .env.local   # als je die nog niet hebt; vul VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in
npm run dev
```

## Eenmalige Supabase-setup

Draai `supabase/setup.sql` één keer in de Supabase SQL-editor van dit project
(https://supabase.com/dashboard/project/jpxvpnvxljhvlfrcszhy/sql/new). Dat script:

- hasht bestaande/nieuwe sessie-wachtwoorden en verplaatst de check server-side (RPC's)
- voegt `host_last_seen` toe aan `bingo_sessions` (voor de host-afwezig-fallback)
- zet een `profiles`-tabel + trigger op voor echte accounts (e-mail + wachtwoord via Supabase Auth)

Na het draaien: registreer één account via de "🔐 Account"-knop in de lobby, en maak
jezelf admin met:

```sql
update profiles set is_admin = true where email = 'jij@voorbeeld.nl';
```

Ga daarna naar `/admin` om alle accounts te zien en wachtwoorden te resetten.

## Deployen (Vercel)

Environment variables die in het Vercel-project moeten staan:

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — client-side, veilig om publiek te zijn
- `SUPABASE_SERVICE_ROLE_KEY` — **alleen** voor de serverless functies onder `api/admin/*`, nooit client-side gebruiken

`vercel.json` bouwt met `npm run build` en serveert `dist/`.

## Projectstructuur

- `src/App.jsx` — de hele game (lobby, setup, speelscherm, winnaarscherm)
- `src/auth/`, `src/admin/` — accounts + adminpaneel (los van de gameplay)
- `api/admin/*` — serverless functies die de Supabase service-role key gebruiken
- `supabase/setup.sql` — eenmalig te draaien database-migratie
