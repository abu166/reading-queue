# Reading Queue

A private reading library built with React, TypeScript, Vite, Tailwind, React Router hash routes, TanStack Query, and Supabase Auth/PostgreSQL. Save links, organize tags, change reading status, write private Markdown notes, search in PostgreSQL, and export/import JSON backups.

```sh
npm ci
cp .env.example .env
# Add your Supabase public URL and key; apply the migration first.
npm run dev
```

Open http://127.0.0.1:5173/reading-queue/. Without configuration the app displays setup instructions; it does not simulate a cloud library.

- [Deployment and account setup](docs/deployment.md)
- [Architecture and security boundaries](docs/architecture.md)
- [Data model, search, and backup format](docs/data-model.md)
- [Verification](docs/testing.md)

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Automatic metadata fetching is intentionally disabled: the chosen Edge runtime has no verified connection-pinning implementation here. Manual saving always works. The authenticated Edge Function returns this limitation without fetching a target. External cover images contact their host, with no referrer. No paid services are configured.

The repository includes deployment configuration, not a live deployment. Hosted persistence, confirmation email delivery, and multi-device behavior require your Supabase account configuration and verification. See deployment instructions before enabling the Pages workflow.
