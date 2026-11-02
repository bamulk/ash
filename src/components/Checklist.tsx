"use client";

import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { Card } from "@/components/ui";

// Minimal shape — the component only needs id/label/is_done, so both
// ListingTask and BuyerTask fit and we don't need the component to know
// about either table.
type ChecklistTask = { id: string; label: string; is_done: boolean };

export default function Checklist({
  tasks,
  toggleAction,
  addAction,
  deleteAction,
}: {
  tasks: ChecklistTask[];
  toggleAction: (taskId: string, formData: FormData) => void | Promise<void>;
  addAction: (formData: FormData) => void | Promise<void>;
  deleteAction: (taskId: string) => void | Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const done = tasks.filter((t) => t.is_done).length;
  const total = tasks.length;

  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex items-baseline justify-between px-4 py-3 border-b border-border-strong">
        <h2 className="text-sm uppercase tracking-widest text-muted">Checklist</h2>
        <span className="text-sm text-muted">
          {done} / {total}
        </span>
      </div>

      <ul className="divide-y divide-border">
        {tasks.map((t) => (
          <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
            <form action={toggleAction.bind(null, t.id)} className="flex-shrink-0">
              <input type="hidden" name="is_done" value={t.is_done ? "false" : "true"} />
              <button
                type="submit"
                aria-label={t.is_done ? "Mark not done" : "Mark done"}
                className={`w-5 h-5 border flex items-center justify-center transition-colors ${
                  t.is_done
                    ? "bg-foreground border-foreground text-background"
                    : "bg-surface border-border-strong hover:border-foreground"
                }`}
              >
                {t.is_done && <Check size={13} strokeWidth={3} />}
              </button>
            </form>
            <span
              className={`flex-1 text-sm ${
                t.is_done ? "line-through text-muted" : "text-foreground"
              }`}
            >
              {t.label}
            </span>
            <form action={deleteAction.bind(null, t.id)}>
              <button
                type="submit"
                aria-label="Remove task"
                className="text-muted hover:text-brand p-1"
              >
                <X size={14} />
              </button>
            </form>
          </li>
        ))}
      </ul>

      <div className="border-t border-border-strong px-4 py-3">
        {adding ? (
          <form action={addAction} className="flex items-center gap-2">
            <input
              name="label"
              autoFocus
              placeholder="New task"
              className="flex-1 border border-border px-3 py-1.5 text-sm text-foreground bg-surface"
              onBlur={(e) => {
                if (!e.currentTarget.value.trim()) setAdding(false);
              }}
            />
            <button
              type="submit"
              className="text-sm px-3 py-1.5 bg-foreground text-background hover:bg-brand hover:text-brand-ink"
            >
              Add
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
          >
            <Plus size={14} /> Add task
          </button>
        )}
      </div>
    </Card>
  );
}
