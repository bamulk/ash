"use client";

import type { ReactNode } from "react";

/**
 * Wrap a server-action form in a confirm() prompt. Lets us gate
 * irreversible-ish actions (sending email, deleting records) without
 * building a modal.
 */
export default function ConfirmForm({
  action,
  confirmText,
  className,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  confirmText: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <form
      action={action}
      className={className}
      onSubmit={(e) => {
        if (!confirm(confirmText)) e.preventDefault();
      }}
    >
      {children}
    </form>
  );
}
