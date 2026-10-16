import { useState } from "react";
import { supabase, callbackUrl } from "../../lib/supabase";
export function Auth({
  recovery = false,
  expired = false,
  onRecovered,
}: {
  recovery?: boolean;
  expired?: boolean;
  onRecovered: () => void;
}) {
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const result = recovery
        ? await supabase.auth.updateUser({ password })
        : mode === "login"
          ? await supabase.auth.signInWithPassword({ email, password })
          : mode === "signup"
            ? await supabase.auth.signUp({
                email,
                password,
                options: { emailRedirectTo: callbackUrl() },
              })
            : await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: callbackUrl(),
              });
      if (result.error) throw result.error;
      if (recovery) {
        setMessage("Password updated.");
        onRecovered();
      } else if (mode === "signup")
        setMessage("Check your email to confirm your account, then sign in.");
      else if (mode === "reset")
        setMessage(
          "If the account exists, a password reset email has been requested.",
        );
    } catch {
      setMessage(
        "Unable to complete authentication. Check your details, email confirmation, connection, and email rate limits.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth">
      <a className="brand" href="#/">
        ▤ Reading Queue
      </a>
      <div className="auth-card">
        <p className="eyebrow">YOUR PERSONAL READING SPACE</p>
        <h1>
          {recovery
            ? "Choose a new password"
            : mode === "signup"
              ? "Make room for good ideas."
              : mode === "reset"
                ? "Reset your password"
                : "Welcome back."}
        </h1>
        <p className="muted">
          Save what catches your attention. Return when you have time.
        </p>
        {expired && (
          <p role="status">
            Your session ended. Sign in again to continue. Unsaved note drafts
            remain in this tab.
          </p>
        )}
        <form onSubmit={submit}>
          {!recovery && (
            <label>
              Email
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
          )}
          {(mode !== "reset" || recovery) && (
            <label>
              Password
              <input
                type="password"
                minLength={8}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          )}
          <button className="primary" disabled={busy}>
            {busy
              ? "Please wait…"
              : recovery
                ? "Update password"
                : mode === "login"
                  ? "Sign in"
                  : mode === "signup"
                    ? "Create account"
                    : "Send reset email"}
          </button>
        </form>
        <p role="status">{message}</p>
        {!recovery && (
          <div className="auth-options">
            <button
              onClick={() => setMode(mode === "signup" ? "login" : "signup")}
            >
              {mode === "signup" ? "Sign in instead" : "Create an account"}
            </button>
            <button
              onClick={() => setMode(mode === "reset" ? "login" : "reset")}
            >
              {mode === "reset" ? "Back to sign in" : "Forgot password?"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
