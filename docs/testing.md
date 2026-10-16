# Verification

## Automated checks

Run `npm ci`, then `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

The Vitest suite includes:

- WHATWG URL normalization, significant query/path preservation, unsafe schemes and credentials.
- Versioned backup validation, ownership-field stripping, size limits and JSON round trips.
- Markdown HTML/script URL safety and suppression of Markdown tracking images.
- Note write failures, retained drafts, version conflicts and stale recovery drafts.
- Signup confirmation redirects, failed login input preservation, reset redirects and password recovery.
- Real PostgreSQL execution through PGlite: the complete migration, authenticated/anonymous roles, RLS, direct SQL isolation, composite item/tag relationships, duplicate constraints, note versions, transactional search/tag queries, reading statuses, tag/item cascades and import rollback/round trips. PGlite supplies a real PostgreSQL engine in-process. A minimal test-only `auth.uid()` reads the selected test subject. These are SQL integration tests, not a substitute for verifying the hosted PostgREST/Auth configuration.

`npm run test:db` runs only the SQL integration suite. Docker is not needed for these tests.

## Browser tests

```sh
npx playwright install chromium
npm run test:e2e
```

With no hosted configuration in the shell, Playwright starts Vite with a deterministic local API origin and intercepts the transport. The Auth response is a **test stub**, and RPCs execute against the actual migration in PGlite. The browser flow signs in, creates a tag, saves a URL, writes a note, marks it Finished, refreshes and verifies persistence, searches notes, inspects a mobile viewport, detects a duplicate canonical URL, and deletes the item. Desktop/mobile screenshots are generated under `test-results/`. This test verifies UI/SDK integration and database operations; it does not prove real email delivery or hosted session handling.

For the hosted flow, use a disposable project with the migration and a confirmed account. Export variables into the shell (the Playwright runner does not automatically read `.env`):

```sh
export VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
export VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_KEY
export E2E_EMAIL=YOUR_CONFIRMED_TEST_EMAIL
# Set E2E_PASSWORD privately in your shell, without saving it in repository files.
npm run test:e2e
```

The hosted flow is skipped unless these variables exist. It creates a uniquely named item/tag, exercises the same flow, then deletes its item. A test tag remains so a failing run is inspectable; delete test tags afterwards. Avoid using a personal library for this test. CI runs the deterministic fixture flow and reports the hosted flow as skipped. No tests contact arbitrary article websites.

## Local Supabase and deployment acceptance

Start Docker, install the Supabase CLI, run `supabase start`, `supabase db reset`, and configure the frontend with the printed local public API values. Test confirmation/reset emails in the local mail viewer. On the hosted deployment, verify email confirmation/reset, refresh-token persistence, logout/account switching, access from a second browser/device, and direct REST calls with two distinct authenticated users. Confirm that one user's item, note, tag and join records are invisible and that cross-user inserts fail.

Automatic metadata extraction is disabled; there is no parser or network fetch whose tests could substantiate SSRF safety. No metadata fixture is shown as fetched content. Enabling a future extractor requires a separate network-security test suite before shipping it.

## Verification recorded for this implementation

Lint, TypeScript, the production build, all 30 Vitest tests and the deterministic Chromium browser flow passed locally on 2026-10-16. The hosted flow was skipped because confirmed test-account credentials were unavailable. The complete migration was applied successfully through the hosted Supabase SQL editor, the local environment was configured, and the app's sign-in screen was verified in Safari. Local environment values remain outside Git. The local Supabase stack was not started. The Edge Function was not deployed or tested in Deno. Email delivery, multi-device cloud persistence, GitHub Actions execution, and live Pages deployment remain unverified.
