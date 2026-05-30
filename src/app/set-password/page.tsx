"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui";

/** Lets a signed-in user set a new password (used after a temp-password invite). */
export default function SetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

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
            <input
              type="password"
              autoComplete="new-password"
              required
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3.5 py-3 text-base"
            />
            <input
              type="password"
              autoComplete="new-password"
              required
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
