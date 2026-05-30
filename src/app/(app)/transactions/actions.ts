"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function str(v: FormDataEntryValue | null): string | null {
  const s = String(v || "").trim();
  return s === "" ? null : s;
}
function num(v: FormDataEntryValue | null): number | null {
  const s = String(v || "").replace(/[$,]/g, "").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}

function dealFields(formData: FormData) {
  const deal_type = String(formData.get("deal_type") || "").trim();
  return {
    contact_id: str(formData.get("contact_id")),
    client_name: String(formData.get("client_name") || "").trim(),
    address: str(formData.get("address")),
    closed_date: str(formData.get("closed_date")),
    source_of_business: str(formData.get("source_of_business")),
    deal_type: deal_type === "" ? null : deal_type,
    sold_price: num(formData.get("sold_price")),
    commission_pct: num(formData.get("commission_pct")),
    gci: num(formData.get("gci")),
    broker_share: num(formData.get("broker_share")),
    admin_fee: num(formData.get("admin_fee")),
    agent_share: num(formData.get("agent_share")),
    notes: str(formData.get("notes")),
  };
}

export async function createTransactionAction(formData: FormData) {
  const supabase = await createClient();
  const fields = dealFields(formData);
  if (!fields.client_name) throw new Error("Client name is required");
  const { data, error } = await supabase
    .from("transactions")
    .insert(fields)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/transactions");
  redirect(`/transactions/${data.id}`);
}

export async function updateTransactionAction(id: string, formData: FormData) {
  const supabase = await createClient();
  const fields = dealFields(formData);
  if (!fields.client_name) throw new Error("Client name is required");
  const { error } = await supabase.from("transactions").update(fields).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/transactions/${id}`);
  revalidatePath("/transactions");
}

export async function deleteTransactionAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/transactions");
  redirect("/transactions");
}
