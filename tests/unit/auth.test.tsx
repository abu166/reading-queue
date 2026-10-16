// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Auth } from "../../src/features/auth/Auth";
import { supabase } from "../../src/lib/supabase";
vi.mock("../../src/lib/supabase", () => ({
  callbackUrl: () => "https://reader.github.io/reading-queue/",
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
    },
  },
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it("uses the repository callback for confirmation and shows the email instruction", async () => {
  vi.mocked(supabase.auth.signUp).mockResolvedValue({ error: null } as any);
  render(<Auth onRecovered={() => {}} />);
  fireEvent.click(screen.getByText("Create an account"));
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "reader@example.test" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "long-password" },
  });
  fireEvent.click(screen.getByText("Create account"));
  await screen.findByText(
    "Check your email to confirm your account, then sign in.",
  );
  expect(supabase.auth.signUp).toHaveBeenCalledWith(
    expect.objectContaining({
      options: { emailRedirectTo: "https://reader.github.io/reading-queue/" },
    }),
  );
});
it("preserves login input and displays an actionable failure", async () => {
  vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
    error: { message: "internal" },
  } as any);
  render(<Auth onRecovered={() => {}} />);
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "reader@example.test" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "long-password" },
  });
  fireEvent.click(screen.getByText("Sign in"));
  await screen.findByText(/Unable to complete authentication/);
  expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe(
    "reader@example.test",
  );
  expect(screen.queryByText("internal")).toBeNull();
});
it("routes password resets to the base callback and completes recovery", async () => {
  vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({
    error: null,
  } as any);
  const { unmount } = render(<Auth onRecovered={() => {}} />);
  fireEvent.click(screen.getByText("Forgot password?"));
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "reader@example.test" },
  });
  fireEvent.click(screen.getByText("Send reset email"));
  await screen.findByText(/If the account exists/);
  expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
    "reader@example.test",
    { redirectTo: "https://reader.github.io/reading-queue/" },
  );
  unmount();
  vi.mocked(supabase.auth.updateUser).mockResolvedValue({ error: null } as any);
  const recovered = vi.fn();
  render(<Auth recovery onRecovered={recovered} />);
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "new-password" },
  });
  fireEvent.click(screen.getByText("Update password"));
  await screen.findByText("Password updated.");
  expect(recovered).toHaveBeenCalledOnce();
});
