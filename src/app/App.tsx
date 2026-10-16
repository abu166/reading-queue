import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { configured } from "../lib/supabase";
import { Auth } from "../features/auth/Auth";
import { useAuth } from "../features/auth/useAuth";
const Library = lazy(() =>
  import("../features/library/Library").then((m) => ({ default: m.Library })),
);
const Detail = lazy(() =>
  import("../features/items/Detail").then((m) => ({ default: m.Detail })),
);
const client = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 15000, refetchOnWindowFocus: true },
  },
});
export function App() {
  const { session, loading, recovery, expired, completeRecovery } =
    useAuth(client);
  if (!configured)
    return (
      <main className="setup">
        <div className="brand">▤ Reading Queue</div>
        <h1>A home for your next good read.</h1>
        <p>Connect your Supabase project to start your private library.</p>
        <p>
          Copy <code>.env.example</code> to <code>.env</code>, add your public
          project URL and key, then restart the app.
        </p>
        <p>
          See <code>docs/deployment.md</code> for database and authentication
          setup.
        </p>
      </main>
    );
  if (loading)
    return (
      <main className="setup" role="status">
        Opening your reading space…
      </main>
    );
  return (
    <QueryClientProvider client={client}>
      <HashRouter>
        {!session || recovery ? (
          <Auth
            recovery={recovery}
            expired={expired}
            onRecovered={completeRecovery}
          />
        ) : (
          <Suspense
            fallback={
              <main className="detail" role="status">
                Opening your library…
              </main>
            }
          >
            <Routes>
              <Route path="/" element={<Library />} />
              <Route
                path="/items/:id"
                element={<Detail userId={session.user.id} />}
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        )}
      </HashRouter>
    </QueryClientProvider>
  );
}
