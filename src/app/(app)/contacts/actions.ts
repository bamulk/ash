"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchAvm, contactAddress, isRentCastConfigured } from "@/lib/rentcast";
import {
  isAnthropicConfigured,
  parseContactFromDictation,
} from "@/lib/anthropic";

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

/**
 * Fetch a fresh AVM estimate for a contact's home and store it as a
 * snapshot so we can show value-over-time. No-op (with a clear error) if
 * RENTCAST_API_KEY isn't configured or the contact has no address.
 */
export async function checkContactValueAction(contactId: string) {
  if (!isRentCastConfigured()) {
    throw new Error(
      "Set RENTCAST_API_KEY in .env.local (and Vercel) to enable home valuations."
    );
  }
  const supabase = await createClient();
  const { data: contact } = await supabase
    .from("contacts")
    .select("street, city, state, zip")
    .eq("id", contactId)
    .single();
  if (!contact) throw new Error("Contact not found");
  const address = contactAddress(contact);
  if (!address || !contact.street) {
    throw new Error("Add a street address to the contact first.");
  }

  const avm = await fetchAvm(address);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("home_valuations").insert({
    contact_id: contactId,
    address,
    estimate: avm.estimate,
    range_low: avm.rangeLow,
    range_high: avm.rangeHigh,
    source: "rentcast",
    raw: avm.raw,
    queried_by: user?.id ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/contacts/${contactId}`);
}

/**
 * Toggle a contact out of (or back into) the automatic birthday /
 * anniversary / lead-drip touches. Explicit unsubscribe still kills
 * everything regardless of this flag.
 */
export async function toggleAutoTouchesOptOutAction(contactId: string, formData: FormData) {
  const supabase = await createClient();
  const nextRaw = String(formData.get("opt_out") || "").trim();
  const next = nextRaw === "true";
  const { error } = await supabase
    .from("contacts")
    .update({ auto_touches_opt_out: next })
    .eq("id", contactId);
  if (error) throw new Error(error.message);
  revalidatePath(`/contacts/${contactId}`);
}

/**
 * Cancel a queued (not-yet-sent) automated touch for this contact.
 * Used from the contact page when Ashley wants to skip the day-7 drip
 * on a specific lead without opting the contact out of everything.
 */
export async function cancelScheduledTouchAction(contactId: string, scheduledId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("scheduled_emails")
    .update({ cancelled_at: new Date().toISOString() })
    .eq("id", scheduledId)
    .is("sent_at", null);
  if (error) throw new Error(error.message);
  revalidatePath(`/contacts/${contactId}`);
}

/**
 * Parse a free-form dictation into a Contact row and save it. Shape
 * matches React 19 useActionState: the client's DictationComposer
 * posts the transcript, we hand back a result object, and on success
 * the component navigates to the new contact's page. We do NOT redirect
 * from here because useActionState swallows thrown redirects. The
 * DictationResult type lives in src/lib/types.ts because exporting
 * types from a "use server" file breaks Next's server-action bundling.
 */
export async function parseAndCreateContactAction(
  _prev: import("@/lib/types").DictationResult | null,
  formData: FormData
): Promise<import("@/lib/types").DictationResult> {
  const transcript = String(formData.get("transcript") || "").trim();
  if (!transcript) {
    return { ok: false, message: "Say something and try again." };
  }
  if (!isAnthropicConfigured()) {
    return {
      ok: false,
      message: "Set ANTHROPIC_API_KEY in .env.local (and Vercel) to enable dictation.",
      transcript,
    };
  }

  let parsed;
  try {
    parsed = await parseContactFromDictation(transcript);
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
      transcript,
    };
  }

  const displayName =
    parsed.display_name ||
    `${parsed.first_name} ${parsed.last_name}`.trim();
  if (!displayName) {
    return {
      ok: false,
      message: "Couldn't catch a name — try again starting with the person's name.",
      transcript,
    };
  }

  // Append the raw dictation to the notes so Ashley can double-check
  // the AI didn't drop or rename anything she said. The pattern is
  // "parsed notes" + a divider + the verbatim transcript, so later
  // edits don't lose provenance.
  const notes = [
    parsed.notes?.trim() || null,
    `— Dictated ${new Date().toLocaleString("en-US", { month: "short", day: "numeric" })} —\n${transcript}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .insert({
      first_name: parsed.first_name,
      last_name: parsed.last_name,
      display_name: displayName,
      emails: parsed.emails,
      phones: parsed.phones,
      street: parsed.street,
      city: parsed.city,
      state: parsed.state,
      zip: parsed.zip,
      role: parsed.role,
      birthday: parsed.birthday,
      source: "dictation",
      notes,
    })
    .select("id, display_name")
    .single();
  if (error || !data) {
    return {
      ok: false,
      message: error?.message || "Save failed.",
      transcript,
    };
  }

  // If Ashley said buyer-side details, scaffold a buyer engagement
  // too so the dictation lands in the pipeline, not just in Contacts.
  const wantsBuyerEngagement =
    parsed.role === "buyer" ||
    parsed.role === "both" ||
    parsed.budget_max != null ||
    parsed.budget_min != null ||
    parsed.target_neighborhoods != null;

  if (wantsBuyerEngagement) {
    await supabase.from("buyer_engagements").insert({
      contact_id: data.id,
      status: "prospecting",
      budget_min: parsed.budget_min,
      budget_max: parsed.budget_max,
      target_neighborhoods: parsed.target_neighborhoods,
      notes: parsed.notes || null,
    });
  }

  revalidatePath("/contacts");
  revalidatePath("/pipeline");
  return {
    ok: true,
    contactId: data.id,
    display_name: data.display_name,
  };
}
