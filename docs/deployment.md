# Setup and deployment

## Local frontend

Use Node 22.12+ (Node 22 LTS is used in CI), `npm ci`, then copy `.env.example` to `.env`. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (publishable or legacy anon key), and `VITE_BASE_PATH=/reading-queue/`. Never use a secret/service-role key in any Vite variable. Run `npm run dev`, visit `http://127.0.0.1:5173/reading-queue/`.

## Supabase

1. Create a Free project at Supabase; save the database password privately. No project is provisioned by this repository.
2. Install the official Supabase CLI, then run `supabase login`, `supabase link --project-ref YOUR_PROJECT_REF`, and `supabase db push` from this directory. Alternatively execute the complete versioned migration in the dashboard SQL editor on an empty project and track that migration yourself. Do not execute partial fragments.
3. In Authentication → Providers, enable email/password and email confirmation. Set minimum password length to at least 8. Configure email templates to honor `RedirectTo` if customizing them.
4. In Authentication → URL Configuration, set Site URL to `https://USERNAME.github.io/reading-queue/`. Allow exactly that URL plus `http://localhost:5173/reading-queue/` and `http://127.0.0.1:5173/reading-queue/`. Use the base URL without a hash for confirmation/reset; application routes use `#/items/UUID` after the SDK consumes the callback.
5. Default SMTP sends only to organization team addresses and is currently limited to 2 messages/hour with best-effort delivery. For personal use, use your authorized organization email; for other recipients configure your own SMTP provider and sender/domain. Credentials belong in Supabase Auth settings, never the frontend. A provider/domain may cost money; choose and authorize that separately. Test confirmation and reset delivery before relying on the deployment.
6. Copy the project URL and public publishable/anon key from project API settings into `.env` and GitHub repository variables.
7. Optional disabled-metadata endpoint: `supabase secrets set ALLOWED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173,https://USERNAME.github.io`, then `supabase functions deploy extract-metadata`. CORS origins omit path components. The function verifies the bearer token through Auth itself (`verify_jwt=false` accommodates publishable keys). It returns unavailable and makes no target requests; there are no metadata-provider secrets. The frontend does not require this endpoint.
8. Verify policies using the tests and, before relying on cloud privacy, a disposable two-user project. Use a confirmed test account for Playwright, never production personal credentials in logs.

For local Supabase, start Docker, run `supabase start` and `supabase db reset`; copy local API URL/anon key to `.env`. Local confirmation/reset messages appear in the local mail service printed by the CLI. Use the base callback URL above.

## GitHub Pages

1. Push this repository to `USERNAME/reading-queue` when ready. No push is performed automatically by this work.
2. Set repository Actions variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. These are public configuration, not backend secrets.
3. Settings → Pages → Build and deployment → Source: GitHub Actions. The deploy workflow builds a static artifact with `/reading-queue/` base, then deploys with job-scoped `pages:write` and `id-token:write`. `contents:read` is the workflow default.
4. Enable/run “Deploy Pages” from main or manually. Confirm the Actions result and published URL; prepared workflow files do not mean the site is live.
5. Verify signup and email confirmation, sign in, save an item/tag/note, mark finished, refresh, sign out/in on another device, search note text, and export/import a backup. Test a reset link in the browser that will consume it; email security scanners can consume single-use links.

## Free-tier constraints (checked 2026-10-15)

[Supabase pricing](https://supabase.com/pricing): Free includes 500 MB database, 50,000 monthly active users, 5 GB egress, 1 GB storage and 500,000 Edge Function invocations. Two active projects; inactive projects pause after one week. No paid tier is enabled. Free backups are not a substitute for regular JSON exports. Resume paused projects in the dashboard. No uploads or realtime subscription are needed here.

[Edge limits](https://supabase.com/docs/guides/functions/limits): hosted functions have 256 MB memory, 2 seconds CPU per request, 150-second free wall-clock duration, and a 150-second idle timeout. This app does no outbound metadata fetch.

[GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits): published sites up to 1 GB; soft bandwidth limit 100 GB/month; deployments time out after 10 minutes. The 10 builds/hour soft limit does not apply to a custom Actions workflow. Public repositories can use GitHub Free Pages; private-repository Pages eligibility depends on your plan. This repository may be public while each Supabase library remains private through RLS. Actions limits depend on repository visibility and plan.

[Auth SMTP limitations](https://supabase.com/docs/guides/auth/auth-smtp) and [redirect guidance](https://supabase.com/docs/guides/auth/redirect-urls) govern email flows. Provider quotas can change; check dashboards before use. Database growth, bandwidth, custom SMTP, domain registration, private repository hosting or exceeding free allowances may require separate services or upgrades. Do not enable paid plans without authorization.

## Backup

Open Settings & backup → Export backup. Store the downloaded JSON securely. Import validates the entire file and offers keep-existing or replace-matching behavior. Test restoration in a disposable library. For more than 1,000 items/tags or 5 MiB use a direct database backup; the UI deliberately refuses oversized operations.
