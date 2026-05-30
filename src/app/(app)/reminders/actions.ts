"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function str(v: FormDataEntryValue | null): string | null {
  const s = String(v || "").trim();
  return s === "" ? null : s;
}

export async function createReminderAction(formData: FormData) {
  const supabase = await createClient();
  const title = String(formData.get("title") || "").trim();
  const due_date = String(formData.get("due_date") || "").trim();
  if (!title || !due_date) throw new Error("Title and due date are required");
  const row = {
    title,
    due_date,
    kind: String(formData.get("kind") || "task"),
    contact_id: str(formData.get("contact_id")),
    transaction_id: str(formData.get("transaction_id")),
    recurrence: String(formData.get("recurrence") || "none"),
    notes: str(formData.get("notes")),
  };
  const { error } = await supabase.from("reminders").insert(row);
  if (error) throw new Error(error.message);
  revalidatePath("/reminders");
  if (row.contact_id) revalidatePath(`/contacts/${row.contact_id}`);
}

export async function toggleReminderAction(id: string) {
  const supabase = await createClient();
  const { data: r } = await supabase
    .from("reminders")
    .select("id, is_done, recurrence, due_date")
    .eq("id", id)
    .single();
  if (!r) return;

  if (!r.is_done && r.recurrence === "annual") {
    // Completing a recurring reminder rolls it to next year instead of closing it.
    const d = new Date(`${r.due_date}T00:00:00`);
    d.setFullYear(d.getFullYear() + 1);
    const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    await supabase.from("reminders").update({ due_date: next }).eq("id", id);
  } else {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase
      .from("reminders")
      .update({
        is_done: !r.is_done,
        completed_at: r.is_done ? null : new Date().toISOString(),
        completed_by: r.is_done ? null : user?.id ?? null,
      })
      .eq("id", id);
  }
  revalidatePath("/reminders");
  revalidatePath("/");
}

export async function snoozeReminderAction(id: string, days: number) {
  const supabase = await createClient();
  const { data: r } = await supabase
    .from("reminders")
    .select("due_date")
    .eq("id", id)
    .single();
  if (!r) return;
  const base = new Date(`${r.due_date}T00:00:00`);
  const now = new Date();
  const from = base > now ? base : now;
  from.setDate(from.getDate() + days);
  const next = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-${String(from.getDate()).padStart(2, "0")}`;
  await supabase.from("reminders").update({ due_date: next, is_done: false }).eq("id", id);
  revalidatePath("/reminders");
  revalidatePath("/");
}

export async function deleteReminderAction(id: string) {
  const supabase = await createClient();
  await supabase.from("reminders").delete().eq("id", id);
  revalidatePath("/reminders");
}
