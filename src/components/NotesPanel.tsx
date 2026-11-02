"use client";

import { useState } from "react";
import { Card } from "@/components/ui";

export default function NotesPanel({
  initialNotes,
  action,
}: {
  initialNotes: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [savedNotes, setSavedNotes] = useState(initialNotes);
  const dirty = notes !== savedNotes;

  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex items-baseline justify-between px-4 py-3 border-b border-border-strong">
        <h2 className="text-sm uppercase tracking-widest text-muted">Notes</h2>
        {dirty && (
          <span className="text-xs text-muted">unsaved</span>
        )}
      </div>
      <form
        action={async (formData) => {
          await action(formData);
          setSavedNotes(notes);
        }}
        className="p-4 space-y-3"
      >
        <textarea
          name="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={6}
          placeholder="Prep notes, seller preferences, showing feedback, anything worth remembering…"
          className="w-full border border-border px-3 py-2 text-sm text-foreground bg-surface resize-y"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!dirty}
            className="text-sm px-4 py-2 bg-foreground text-background hover:bg-brand hover:text-brand-ink disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save notes
          </button>
        </div>
      </form>
    </Card>
  );
}
