"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { matchContacts } from "@/lib/segments";
import type { Contact, SegmentCriteria } from "@/lib/types";

function str(v: FormDataEntryValue | null): string | undefined {
  const s = String(v || "").trim();
  return s === "" ? undefined : s;
}

function criteriaFromForm(formData: FormData): SegmentCriteria {
  const crit: SegmentCriteria = {};
  const role = str(formData.get("role"));
  if (role) crit.role = role as SegmentCriteria["role"];
  const city = str(formData.get("city"));
  if (city) crit.city = city;
  const state = str(formData.get("state"));
  if (state) crit.state = state;
  const zip = str(formData.get("zip"));
  if (zip) crit.zip = zip;
  const tag = str(formData.get("tag_id"));
  if (tag) crit.tag_id = tag;
  if (formData.get("has_email")) crit.has_email = true;
  if (formData.get("has_phone")) crit.has_phone = true;
  const search = str(formData.get("search"));
  if (search) crit.search = search;
  return crit;
}

export async function createSegmentAction(formData: FormData) {
  const supabase = await createClient();
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Segment name is required");
  const { error } = await supabase.from("segments").insert({
    name,
    description: str(formData.get("description")) ?? null,
    criteria: criteriaFromForm(formData),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/marketing");
}

export async function updateSegmentAction(id: string, formData: FormData) {
  const supabase = await createClient();
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Segment name is required");
  const { error } = await supabase
    .from("segments")
    .update({
      name,
      description: str(formData.get("description")) ?? null,
      criteria: criteriaFromForm(formData),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/marketing/segments/${id}`);
  revalidatePath("/marketing");
}

export async function deleteSegmentAction(id: string) {
  const supabase = await createClient();
  await supabase.from("segments").delete().eq("id", id);
  revalidatePath("/marketing");
  redirect("/marketing");
}

export async function createCampaignAction(formData: FormData) {
  const supabase = await createClient();
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Campaign name is required");
  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      name,
      kind: String(formData.get("kind") || "postcard"),
      segment_id: str(formData.get("segment_id")) ?? null,
      scheduled_date: str(formData.get("scheduled_date")) ?? null,
      notes: str(formData.get("notes")) ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/marketing");
  redirect(`/marketing/campaigns/${data.id}`);
}

export async function updateCampaignStatusAction(id: string, status: string) {
  const supabase = await createClient();
  await supabase.from("campaigns").update({ status }).eq("id", id);
  revalidatePath(`/marketing/campaigns/${id}`);
  revalidatePath("/marketing");
}

export async function deleteCampaignAction(id: string) {
  const supabase = await createClient();
  await supabase.from("campaigns").delete().eq("id", id);
  revalidatePath("/marketing");
  redirect("/marketing");
}

/**
 * Snapshot the campaign's segment into campaign_contacts and mark every
 * matched contact as "sent" (touched now). This records the mailing so it
 * shows up in each contact's history.
 */
export async function logCampaignTouchesAction(id: string) {
  const supabase = await createClient();
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, segment_id")
    .eq("id", id)
    .single();
  if (!campaign?.segment_id) throw new Error("Attach a segment first");

  const { data: segment } = await supabase
    .from("segments")
    .select("criteria")
    .eq("id", campaign.segment_id)
    .single();

  const [{ data: contacts }, { data: links }] = await Promise.all([
    supabase.from("contacts").select("*").order("display_name"),
    supabase.from("contact_tags").select("contact_id, tag_id"),
  ]);
  const tagsByContact = new Map<string, Set<string>>();
  for (const l of links ?? []) {
    const s = tagsByContact.get(l.contact_id) ?? new Set<string>();
    s.add(l.tag_id);
    tagsByContact.set(l.contact_id, s);
  }
  const matched = matchContacts(
    (contacts ?? []) as Contact[],
    (segment?.criteria ?? {}) as SegmentCriteria,
    tagsByContact
  );
  const now = new Date().toISOString();
  const rows = matched.map((c) => ({
    campaign_id: id,
    contact_id: c.id,
    status: "sent",
    touched_at: now,
  }));
  if (rows.length) {
    const { error } = await supabase.from("campaign_contacts").upsert(rows);
    if (error) throw new Error(error.message);
  }
  await supabase.from("campaigns").update({ status: "done" }).eq("id", id);
  revalidatePath(`/marketing/campaigns/${id}`);
}
