"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Home } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui";

/**
 * Sign-in page. Public sign-up is disabled — accounts are created by an
 * admin on the Team page. Anyone who needs access asks an admin.
 */
export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand rounded-full opacity-10 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent rounded-full opacity-10 blur-3xl" />
      </div>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white dark:bg-slate-900/90 backdrop-blur-sm p-8 rounded-2xl shadow-xl shadow-slate-900/5 border border-slate-200 dark:border-slate-700/70 space-y-5"
      >
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl bg-brand text-white inline-flex items-center justify-center">
            <Home size={22} />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Ashley Stone Homes
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Welcome back
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3.5 py-3 text-base text-slate-900 dark:text-slate-100"
          />
          <input
            type="password"
            autoComplete="current-password"
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3.5 py-3 text-base text-slate-900 dark:text-slate-100"
          />
        </div>

        {error && (
          <p className="text-red-600 text-sm bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <Button disabled={loading} className="w-full">
          {loading ? "…" : "Sign in"}
        </Button>

        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
          Access is by invitation. Need an account? Ask an admin to add you.
        </p>
      </form>
    </div>
  );
}
