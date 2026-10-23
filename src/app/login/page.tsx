"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
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
    <div className="min-h-screen flex items-center justify-center p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-surface border border-border-strong p-10 space-y-6"
      >
        <div className="flex items-center gap-3 pb-5 border-b border-border">
          <Image
            src="/logo.png"
            alt="Ashley Stone Homes"
            width={48}
            height={48}
            priority
            className="w-12 h-12 object-contain bg-[#fbfbf9] p-[3px] border border-border"
          />
          <div className="leading-tight">
            <div className="font-display text-xl font-medium text-foreground">
              Ashley Stone
            </div>
            <div className="eyebrow mt-0.5">Real Estate Group</div>
          </div>
        </div>

        <div className="space-y-3">
          <input
            id="login-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="username webauthn"
            required
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-border px-3.5 py-3 text-base text-foreground bg-surface"
          />
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password webauthn"
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-border px-3.5 py-3 text-base text-foreground bg-surface"
          />
        </div>

        {error && (
          <p className="text-brand text-sm bg-surface border border-brand px-3 py-2">
            {error}
          </p>
        )}

        <Button disabled={loading} className="w-full">
          {loading ? "…" : "Sign in"}
        </Button>

        <p className="text-center text-xs text-soft">
          Access is by invitation. Need an account? Ask an admin to add you.
        </p>
      </form>
    </div>
  );
}
