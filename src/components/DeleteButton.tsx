"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui";

export default function DeleteButton({
  action,
  label = "Delete",
  confirmText = "Delete this item? This cannot be undone.",
}: {
  action: () => void | Promise<void>;
  label?: string;
  confirmText?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(confirmText)) e.preventDefault();
      }}
    >
      <Button type="submit" variant="danger" size="sm">
        <Trash2 size={14} /> {label}
      </Button>
    </form>
  );
}
