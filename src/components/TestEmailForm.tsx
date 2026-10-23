"use client";

import { useActionState } from "react";
import { Mail, Check, AlertTriangle } from "lucide-react";
import { Button, Input } from "@/components/ui";

type TestResult = { ok: boolean; message?: string };

export default function TestEmailForm({
  action,
  defaultTo = "",
}: {
  action: (
    prev: TestResult | null,
    formData: FormData
  ) => Promise<TestResult>;
  defaultTo?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="flex items-center gap-2 flex-wrap">
      <Input
        type="email"
        name="to"
        required
        defaultValue={defaultTo}
        placeholder="yourself@email.com"
        className="max-w-[16rem] text-sm"
      />
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        <Mail size={14} />
        {pending ? "Sending…" : "Send test"}
      </Button>
      {state && (
        <span
          className={`text-xs inline-flex items-center gap-1 ${
            state.ok
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-rose-600 dark:text-rose-400"
          }`}
        >
          {state.ok ? <Check size={12} /> : <AlertTriangle size={12} />}
          {state.message}
        </span>
      )}
    </form>
  );
}
