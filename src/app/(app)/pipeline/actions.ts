"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { BuyerStatus, ListingStatus } from "@/lib/types";

function str(v: FormDataEntryValue | null): string | null {
  const s = String(v || "").trim();
  return s === "" ? null : s;
}
function num(v: FormDataEntryValue | null): number | null {
  const s = String(v || "").trim();
  if (s === "") return null;
  const n = Number(s.replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : null;
}

// --------------------------- listings ---------------------------

function listingFields(formData: FormData) {
  return {
    contact_id: str(formData.get("contact_id")),
    address: String(formData.get("address") || "").trim(),
    city: str(formData.get("city")),
    state: str(formData.get("state")),
    zip: str(formData.get("zip")),
    mls_number: str(formData.get("mls_number")),
    status: (str(formData.get("status")) || "coming_soon") as ListingStatus,
    list_date: str(formData.get("list_date")),
    list_price: num(formData.get("list_price")),
    current_price: num(formData.get("current_price")),
    original_price: num(formData.get("original_price")),
    contract_date: str(formData.get("contract_date")),
    est_close_date: str(formData.get("est_close_date")),
    sold_date: str(formData.get("sold_date")),
    sold_price: num(formData.get("sold_price")),
    bedrooms: num(formData.get("bedrooms")),
    bathrooms: num(formData.get("bathrooms")),
    sqft: num(formData.get("sqft")),
    lot_size: str(formData.get("lot_size")),
    notes: str(formData.get("notes")),
    next_action: str(formData.get("next_action")),
    next_action_date: str(formData.get("next_action_date")),
  };
}

export async function createListingAction(formData: FormData) {
  const supabase = await createClient();
  const fields = listingFields(formData);
  if (!fields.address) throw new Error("Address is required");
  // Default current_price to list_price if not set — keeps the "has there been a price drop?" math simple.
  if (fields.current_price == null && fields.list_price != null) {
    fields.current_price = fields.list_price;
  }
  if (fields.original_price == null && fields.list_price != null) {
    fields.original_price = fields.list_price;
  }
  const { data, error } = await supabase.from("listings").insert(fields).select("id").single();
  if (error) throw new Error(error.message);
  revalidatePath("/pipeline");
  redirect(`/pipeline/listings/${data.id}`);
}

export async function updateListingAction(id: string, formData: FormData) {
  const supabase = await createClient();
  const fields = listingFields(formData);
  if (!fields.address) throw new Error("Address is required");
  const { error } = await supabase.from("listings").update(fields).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/pipeline/listings/${id}`);
  revalidatePath("/pipeline");
}

/**
 * One-click status change from a Kanban row — tiny form with just the
 * next status; keeps us from forcing Ashley into the full edit page.
 */
export async function moveListingStatusAction(id: string, formData: FormData) {
  const supabase = await createClient();
  const next = String(formData.get("status") || "").trim() as ListingStatus;
  if (!next) return;
  const patch: Record<string, unknown> = { status: next };
  // Convenience auto-fills for the state transition dates.
  if (next === "under_contract") patch.contract_date = new Date().toISOString().slice(0, 10);
  if (next === "sold") patch.sold_date = new Date().toISOString().slice(0, 10);
  const { error } = await supabase.from("listings").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/pipeline");
  revalidatePath(`/pipeline/listings/${id}`);
}

export async function deleteListingAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("listings").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/pipeline");
  redirect("/pipeline");
}

// --------------------------- buyers ---------------------------

function buyerFields(formData: FormData) {
  return {
    contact_id: str(formData.get("contact_id")),
    status: (str(formData.get("status")) || "prospecting") as BuyerStatus,
    budget_min: num(formData.get("budget_min")),
    budget_max: num(formData.get("budget_max")),
    preapproval_lender: str(formData.get("preapproval_lender")),
    preapproval_amount: num(formData.get("preapproval_amount")),
    preapproval_expires: str(formData.get("preapproval_expires")),
    target_neighborhoods: str(formData.get("target_neighborhoods")),
    must_haves: str(formData.get("must_haves")),
    property_type: str(formData.get("property_type")),
    min_beds: num(formData.get("min_beds")),
    min_baths: num(formData.get("min_baths")),
    notes: str(formData.get("notes")),
    next_action: str(formData.get("next_action")),
    next_action_date: str(formData.get("next_action_date")),
    under_contract_address: str(formData.get("under_contract_address")),
    under_contract_price: num(formData.get("under_contract_price")),
    est_close_date: str(formData.get("est_close_date")),
  };
}

export async function createBuyerAction(formData: FormData) {
  const supabase = await createClient();
  const fields = buyerFields(formData);
  if (!fields.contact_id) throw new Error("Buyer contact is required");
  const insertable = { ...fields, contact_id: fields.contact_id! };
  const { data, error } = await supabase
    .from("buyer_engagements")
    .insert(insertable)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/pipeline");
  redirect(`/pipeline/buyers/${data.id}`);
}

export async function updateBuyerAction(id: string, formData: FormData) {
  const supabase = await createClient();
  const fields = buyerFields(formData);
  if (!fields.contact_id) throw new Error("Buyer contact is required");
  const { error } = await supabase
    .from("buyer_engagements")
    .update({ ...fields, contact_id: fields.contact_id! })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/pipeline/buyers/${id}`);
  revalidatePath("/pipeline");
}

export async function moveBuyerStatusAction(id: string, formData: FormData) {
  const supabase = await createClient();
  const next = String(formData.get("status") || "").trim() as BuyerStatus;
  if (!next) return;
  const { error } = await supabase
    .from("buyer_engagements")
    .update({ status: next })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/pipeline");
  revalidatePath(`/pipeline/buyers/${id}`);
}

export async function deleteBuyerAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("buyer_engagements").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/pipeline");
  redirect("/pipeline");
}

// --------------------------- showings ---------------------------

export async function addShowingAction(engagementId: string, formData: FormData) {
  const supabase = await createClient();
  const address = String(formData.get("address") || "").trim();
  if (!address) return;
  const shown_on = str(formData.get("shown_on")) || new Date().toISOString().slice(0, 10);
  const ratingRaw = str(formData.get("rating"));
  const rating = ratingRaw ? Math.max(1, Math.min(5, Number(ratingRaw))) : null;
  const notes = str(formData.get("notes"));
  const { error } = await supabase.from("buyer_showings").insert({
    engagement_id: engagementId,
    address,
    shown_on,
    rating,
    notes,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/pipeline/buyers/${engagementId}`);
}

export async function deleteShowingAction(engagementId: string, showingId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("buyer_showings").delete().eq("id", showingId);
  if (error) throw new Error(error.message);
  revalidatePath(`/pipeline/buyers/${engagementId}`);
}

// --------------------------- listing checklist ---------------------------

export async function toggleListingTaskAction(
  listingId: string,
  taskId: string,
  formData: FormData
) {
  const supabase = await createClient();
  const nextDone = String(formData.get("is_done") || "").trim() === "true";
  const { error } = await supabase
    .from("listing_tasks")
    .update({
      is_done: nextDone,
      done_at: nextDone ? new Date().toISOString() : null,
    })
    .eq("id", taskId);
  if (error) throw new Error(error.message);
  revalidatePath(`/pipeline/listings/${listingId}`);
}

export async function addListingTaskAction(listingId: string, formData: FormData) {
  const label = String(formData.get("label") || "").trim();
  if (!label) return;
  const supabase = await createClient();
  // Append to the end — read the current max position so new items sort last.
  const { data: last } = await supabase
    .from("listing_tasks")
    .select("position")
    .eq("listing_id", listingId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPos = (last?.position ?? 0) + 10;
  const { error } = await supabase
    .from("listing_tasks")
    .insert({ listing_id: listingId, label, position: nextPos });
  if (error) throw new Error(error.message);
  revalidatePath(`/pipeline/listings/${listingId}`);
}

export async function deleteListingTaskAction(listingId: string, taskId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("listing_tasks").delete().eq("id", taskId);
  if (error) throw new Error(error.message);
  revalidatePath(`/pipeline/listings/${listingId}`);
}
