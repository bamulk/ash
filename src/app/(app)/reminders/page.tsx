import Link from "next/link";
import { Plus, Clock, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, Field, Input, Select, Badge, EmptyState } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import { formatDate, todayISO } from "@/lib/format";
import type { Reminder } from "@/lib/types";
import {
  createReminderAction,
  toggleReminderAction,
  snoozeReminderAction,
  deleteReminderAction,
} from "./actions";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  follow_up: "Follow-up",
  anniversary: "Anniversary",
  birthday: "Birthday",
  task: "Task",
};

type Row = Reminder & { contacts: { display_name: string } | null };

function ReminderItem({ r }: { r: Row }) {
  const toggle = toggleReminderAction.bind(null, r.id);
  const snooze = snoozeReminderAction.bind(null, r.id, 7);
  const del = deleteReminderAction.bind(null, r.id);
  return (
    <div className="flex items-center gap-3 p-3 text-sm">
      <form action={toggle}>
        <button
          className={`w-5 h-5 rounded border flex items-center justify-center ${
            r.is_done ? "bg-brand border-brand text-white" : "border-slate-300 dark:border-slate-600"
          }`}
          aria-label="Toggle done"
        >
          {r.is_done ? "✓" : ""}
        </button>
      </form>
      <div className="flex-1 min-w-0">
        <div className={`flex items-center gap-2 flex-wrap ${r.is_done ? "line-through text-slate-400" : ""}`}>
          <span className="font-medium">{r.title}</span>
          <Badge tone="planned">{KIND_LABEL[r.kind]}</Badge>
          {r.recurrence === "annual" && <span className="text-xs text-slate-400">annual</span>}
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {formatDate(r.due_date)}
          {r.contacts && (
            <>
              {" · "}
              <Link href={`/contacts/${r.contact_id}`} className="hover:underline">
                {r.contacts.display_name}
              </Link>
            </>
          )}
        </div>
      </div>
      {!r.is_done && (
        <form action={snooze}>
          <button className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 inline-flex items-center gap-1 text-xs">
            <Clock size={13} /> +1wk
          </button>
        </form>
      )}
      <form action={del}>
        <button className="text-slate-300 hover:text-rose-600" aria-label="Delete">
          <Trash2 size={14} />
        </button>
      </form>
    </div>
  );
}

function Section({ title, rows, tone }: { title: string; rows: Row[]; tone?: string }) {
  if (rows.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold flex items-center gap-2">
        {title} <Badge tone={tone ?? "planned"}>{rows.length}</Badge>
      </h2>
      <Card className="divide-y divide-slate-100 dark:divide-slate-800">
        {rows.map((r) => (
          <ReminderItem key={r.id} r={r} />
        ))}
      </Card>
    </section>
  );
}

export default async function RemindersPage() {
  const supabase = await createClient();
  const today = todayISO();
  const [{ data: reminders }, { data: contacts }] = await Promise.all([
    supabase
      .from("reminders")
      .select("*, contacts(display_name)")
      .order("due_date"),
    supabase.from("contacts").select("id, display_name").order("display_name"),
  ]);

  const all = (reminders ?? []) as Row[];
  const open = all.filter((r) => !r.is_done);
  const overdue = open.filter((r) => r.due_date < today);
  const dueToday = open.filter((r) => r.due_date === today);
  const upcoming = open.filter((r) => r.due_date > today);
  const done = all.filter((r) => r.is_done).slice(0, 25);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reminders"
        subtitle={`${open.length} open · ${overdue.length} overdue`}
      />

      <Card className="p-5">
        <h2 className="text-sm font-medium mb-3 flex items-center gap-2">
          <Plus size={14} /> New reminder
        </h2>
        <form action={createReminderAction} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Field label="Title">
              <Input name="title" required placeholder="e.g. Call about refinance" />
            </Field>
          </div>
          <Field label="Due date">
            <Input type="date" name="due_date" defaultValue={today} required />
          </Field>
          <Field label="Type">
            <Select name="kind" defaultValue="follow_up">
              <option value="follow_up">Follow-up</option>
              <option value="task">Task</option>
              <option value="anniversary">Anniversary</option>
              <option value="birthday">Birthday</option>
            </Select>
          </Field>
          <Field label="Contact (optional)">
            <Select name="contact_id" defaultValue="">
              <option value="">—</option>
              {(contacts ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.display_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Repeat">
            <Select name="recurrence" defaultValue="none">
              <option value="none">One-time</option>
              <option value="annual">Annually</option>
            </Select>
          </Field>
          <div className="sm:col-span-2 flex justify-end">
            <SubmitButton>Add reminder</SubmitButton>
          </div>
        </form>
      </Card>

      {open.length === 0 && done.length === 0 ? (
        <EmptyState title="No reminders yet" description="Add a follow-up above, or create one from a contact's page." />
      ) : (
        <>
          <Section title="Overdue" rows={overdue} tone="overdue" />
          <Section title="Today" rows={dueToday} tone="in_progress" />
          <Section title="Upcoming" rows={upcoming} />
          <Section title="Recently done" rows={done} tone="done" />
        </>
      )}
    </div>
  );
}
