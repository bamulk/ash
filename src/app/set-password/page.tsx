"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui";

/** Lets a signed-in user set a new password (used after a temp-password invite). */
export default function SetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  // Tell Apple/Chrome/etc. which account the new password belongs to so
  // the password manager updates the right saved credential instead of
  // creating a duplicate.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setEmail(data.user.email);
    });
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white dark:bg-slate-900/90 p-8 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700/70 space-y-5"
      >
        <h1 className="text-xl font-semibold tracking-tight">Set a new password</h1>

        {done ? (
          <div className="space-y-4">
            <p className="text-sm text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg px-3 py-2">
              Password updated.
            </p>
            <Link href="/" className="text-sm text-brand underline">
              Go to dashboard →
            </Link>
          </div>
        ) : (
          <>
            {/* Hidden, prefilled, read-only "username" field so password
                managers (Apple Passwords, 1Password, iCloud Keychain,
                Chrome) attach the new password to the right account. */}
            <input
              type="email"
              name="username"
              autoComplete="username"
              value={email}
              readOnly
              hidden
              tabIndex={-1}
            />
            <input
              id="new-password"
              name="new-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              // Apple-specific hint for iCloud Keychain's strong-password
              // generator. Lowercase via spread so TypeScript doesn't
              // complain about the non-standard attribute.
              {...{ passwordrules: "minlength: 8; allowed: ascii;" }}
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3.5 py-3 text-base"
            />
            <input
              id="confirm-password"
              name="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="Confirm password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3.5 py-3 text-base"
            />
            {error && (
              <p className="text-red-600 text-sm bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <Button disabled={loading} className="w-full">
              {loading ? "…" : "Update password"}
            </Button>
          </>
        )}
      </form>
    </div>
  );
}
