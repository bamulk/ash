"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function list(v: FormDataEntryValue | null): string[] {
  return String(v || "")
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function str(v: FormDataEntryValue | null): string | null {
  const s = String(v || "").trim();
  return s === "" ? null : s;
}

function contactFields(formData: FormData) {
  const first = String(formData.get("first_name") || "").trim();
  const last = String(formData.get("last_name") || "").trim();
  const display =
    String(formData.get("display_name") || "").trim() ||
    `${first} ${last}`.trim();
  const roleRaw = String(formData.get("role") || "").trim();
  return {
    first_name: first,
    last_name: last,
    display_name: display,
    emails: list(formData.get("emails")),
    phones: list(formData.get("phones")),
    street: str(formData.get("street")),
    city: str(formData.get("city")),
    state: str(formData.get("state")),
    zip: str(formData.get("zip")),
    role: roleRaw === "" ? null : roleRaw,
    birthday: str(formData.get("birthday")),
    notes: str(formData.get("notes")),
  };
}

export async function createContactAction(formData: FormData) {
  const supabase = await createClient();
  const fields = contactFields(formData);
  if (!fields.display_name) throw new Error("Name is required");
  const { data, error } = await supabase
    .from("contacts")
    .insert(fields)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/contacts");
  redirect(`/contacts/${data.id}`);
}

export async function updateContactAction(id: string, formData: FormData) {
  const supabase = await createClient();
  const fields = contactFields(formData);
  if (!fields.display_name) throw new Error("Name is required");
  const { error } = await supabase.from("contacts").update(fields).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/contacts/${id}`);
  revalidatePath("/contacts");
}

export async function deleteContactAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/contacts");
  redirect("/contacts");
}

export async function addTagAction(contactId: string, formData: FormData) {
  const supabase = await createClient();
  const name = String(formData.get("tag") || "").trim();
  if (!name) return;
  // Find or create the tag.
  let { data: tag } = await supabase
    .from("tags")
    .select("id")
    .ilike("name", name)
    .maybeSingle();
  if (!tag) {
    const { data: created, error } = await supabase
      .from("tags")
      .insert({ name })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    tag = created;
  }
  await supabase
    .from("contact_tags")
    .upsert({ contact_id: contactId, tag_id: tag.id });
  revalidatePath(`/contacts/${contactId}`);
}

export async function removeTagAction(contactId: string, tagId: string) {
  const supabase = await createClient();
  await supabase
    .from("contact_tags")
    .delete()
    .eq("contact_id", contactId)
    .eq("tag_id", tagId);
  revalidatePath(`/contacts/${contactId}`);
}
