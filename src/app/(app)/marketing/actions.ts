"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { matchContacts } from "@/lib/segments";
import {
  appUrl,
  defaultFrom,
  isResendConfigured,
  renderTemplate,
  sendMany,
  sendOne,
  toHtmlIfPlain,
  wrapHtml,
  type ResendEmail,
} from "@/lib/resend";
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
      email_subject: str(formData.get("email_subject")) ?? null,
      email_body: str(formData.get("email_body")) ?? null,
      email_from: str(formData.get("email_from")) ?? null,
      email_reply_to: str(formData.get("email_reply_to")) ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/marketing");
  redirect(`/marketing/campaigns/${data.id}`);
}

export async function updateCampaignEmailAction(id: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("campaigns")
    .update({
      email_subject: str(formData.get("email_subject")) ?? null,
      email_body: str(formData.get("email_body")) ?? null,
      email_from: str(formData.get("email_from")) ?? null,
      email_reply_to: str(formData.get("email_reply_to")) ?? null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/marketing/campaigns/${id}`);
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

/**
 * Send a single test email of the campaign's current saved subject +
 * body to an arbitrary address, personalized with "Test" sample vars.
 * Signature matches React 19 useActionState so the client component can
 * render inline success/error feedback.
 *
 * Nothing is written to campaign_contacts and the campaign is not
 * marked done — this is iteration, not a real mailing.
 */
export async function sendTestEmailAction(
  id: string,
  _prev: { ok: boolean; message?: string } | null,
  formData: FormData
): Promise<{ ok: boolean; message?: string }> {
  if (!isResendConfigured()) {
    return { ok: false, message: "Resend not configured" };
  }
  const to = String(formData.get("to") || "").trim();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return { ok: false, message: "Enter a valid email address" };
  }
  const supabase = await createClient();
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("name, email_subject, email_body, email_from, email_reply_to")
    .eq("id", id)
    .single();
  if (!campaign) return { ok: false, message: "Campaign not found" };
  if (!campaign.email_subject || !campaign.email_body) {
    return { ok: false, message: "Save a subject and body first (hit Save draft)" };
  }

  // If the test recipient happens to be a real contact, use their real
  // unsubscribe token so the link in the test behaves like production.
  // Otherwise generate a dummy token — clicking it 404s, which is the
  // safe behavior for a stranger receiving a stray test.
  const { data: match } = await supabase
    .from("contacts")
    .select("unsubscribe_token")
    .contains("emails", [to])
    .maybeSingle();
  const unsubUrl = `${appUrl()}/unsubscribe/${match?.unsubscribe_token || "test-" + id.slice(0, 8)}`;

  const vars = { first_name: "Test", display_name: "Test Recipient", last_name: "" };
  const subject = `[TEST] ${renderTemplate(campaign.email_subject, vars)}`;
  const html = wrapHtml(
    renderTemplate(toHtmlIfPlain(campaign.email_body), vars),
    unsubUrl
  );

  try {
    const messageId = await sendOne({
      from: campaign.email_from || defaultFrom(),
      to,
      subject,
      html,
      reply_to: campaign.email_reply_to || undefined,
      tags: [
        { name: "campaign_id", value: id },
        { name: "test", value: "true" },
      ],
    });
    return { ok: true, message: `Sent to ${to} · ${messageId.slice(0, 10)}…` };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Send the campaign's composed email to every matched contact that has
 * an email address and hasn't unsubscribed. Writes per-recipient
 * delivery info into campaign_contacts and marks the campaign done.
 */
export async function sendCampaignEmailAction(id: string) {
  if (!isResendConfigured()) {
    throw new Error(
      "Set RESEND_API_KEY and RESEND_FROM_EMAIL in .env.local (and Vercel) to send email."
    );
  }
  const supabase = await createClient();

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, name, segment_id, email_subject, email_body, email_from, email_reply_to")
    .eq("id", id)
    .single();
  if (!campaign) throw new Error("Campaign not found");
  if (!campaign.segment_id) throw new Error("Attach a segment first");
  if (!campaign.email_subject || !campaign.email_body) {
    throw new Error("Add a subject and body to this campaign before sending");
  }

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

  const nowIso = new Date().toISOString();
  const base = appUrl();
  const skipped: {
    campaign_id: string;
    contact_id: string;
    status: "skipped";
    touched_at: string;
    email_status: "skipped";
    email_error: string;
  }[] = [];
  const toSend: {
    contact: Contact;
    emailAddr: string;
    unsubUrl: string;
    payload: ResendEmail;
  }[] = [];

  for (const c of matched) {
    if (c.unsubscribed_at) {
      skipped.push({
        campaign_id: id,
        contact_id: c.id,
        status: "skipped",
        touched_at: nowIso,
        email_status: "skipped",
        email_error: "Contact has unsubscribed",
      });
      continue;
    }
    const emailAddr = (c.emails || []).find((e) => /@/.test(e));
    if (!emailAddr) {
      skipped.push({
        campaign_id: id,
        contact_id: c.id,
        status: "skipped",
        touched_at: nowIso,
        email_status: "skipped",
        email_error: "No email address",
      });
      continue;
    }

    const unsubUrl = `${base}/unsubscribe/${c.unsubscribe_token}`;
    const vars = {
      display_name: c.display_name,
      first_name: c.first_name,
      last_name: c.last_name,
    };
    const subject = renderTemplate(campaign.email_subject!, vars);
    const bodyHtml = wrapHtml(
      renderTemplate(toHtmlIfPlain(campaign.email_body!), vars),
      unsubUrl
    );
    toSend.push({
      contact: c,
      emailAddr,
      unsubUrl,
      payload: {
        from: campaign.email_from || defaultFrom(),
        to: emailAddr,
        subject,
        html: bodyHtml,
        reply_to: campaign.email_reply_to || undefined,
        headers: {
          "List-Unsubscribe": `<${unsubUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
        tags: [
          { name: "campaign_id", value: id },
          { name: "campaign_name", value: campaign.name.slice(0, 100) },
        ],
      },
    });
  }

  const results = await sendMany(toSend.map((t) => t.payload));
  const sentRows = toSend.map((t, i) => ({
    campaign_id: id,
    contact_id: t.contact.id,
    status: results[i].error ? "skipped" : "sent",
    touched_at: nowIso,
    email_sent_at: results[i].error ? null : nowIso,
    email_message_id: results[i].id || null,
    email_status: results[i].error ? "bounced" : "sent",
    email_error: results[i].error || null,
  }));

  const allRows = [...skipped, ...sentRows];
  if (allRows.length) {
    const { error } = await supabase.from("campaign_contacts").upsert(allRows);
    if (error) throw new Error(error.message);
  }
  await supabase
    .from("campaigns")
    .update({ status: "done", email_sent_at: nowIso })
    .eq("id", id);
  revalidatePath(`/marketing/campaigns/${id}`);
}
