/**
 * Vercel cron (daily, 10am PT). Runs three passes in order:
 *
 *   1. drip_* — anything in scheduled_emails whose send_at is <= now()
 *      and that hasn't been sent or cancelled.
 *   2. anniversary — for every transaction whose closed_date month-day
 *      matches today, queue + send one anniversary email per contact
 *      per year (dedupe_key `annv:<transaction_id>:<year>`).
 *   3. birthday — for every contact whose birthday month-day matches
 *      today, queue + send one birthday email per contact per year
 *      (dedupe_key `bday:<contact_id>:<year>`).
 *
 * Idempotent: the scheduled_emails.dedupe_key unique index means
 * re-running on the same day is safe — the second insert returns a
 * conflict and the row isn't re-sent. Opt-outs:
 *   - contacts.unsubscribed_at — kills everything (lead drip included)
 *   - contacts.auto_touches_opt_out — kills birthday/anniversary only
 *
 * Guard: either header "authorization: Bearer <CRON_SECRET>" (Vercel's
 * standard cron trigger) or any request from Vercel's internal cron
 * identity passes. Everything else is 403.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTouch, TouchKind } from "@/lib/touches";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ContactRow = {
  id: string;
  display_name: string;
  first_name: string;
  last_name: string;
  emails: string[];
  unsubscribe_token: string;
  unsubscribed_at: string | null;
  auto_touches_opt_out: boolean;
};

async function handle(req: NextRequest) {
  const expected = process.env.CRON_SECRET?.trim();
  const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!expected || auth !== expected) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const now = new Date();
  const todayIso = now.toISOString();
  const year = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const monthDay = `${mm}-${dd}`;

  const sent: { contact_id: string; kind: TouchKind; message_id: string }[] = [];
  const failed: { contact_id: string; kind: TouchKind; error: string }[] = [];

  async function trySend(contact: ContactRow, kind: TouchKind, queueRowId?: string) {
    if (contact.unsubscribed_at) {
      if (queueRowId) {
        await supabase
          .from("scheduled_emails")
          .update({ cancelled_at: todayIso, error: "contact unsubscribed" })
          .eq("id", queueRowId);
      }
      return;
    }
    try {
      const messageId = await sendTouch({
        kind,
        contact,
        unsubscribeToken: contact.unsubscribe_token,
      });
      sent.push({ contact_id: contact.id, kind, message_id: messageId });
      if (queueRowId) {
        await supabase
          .from("scheduled_emails")
          .update({ sent_at: todayIso, resend_message_id: messageId })
          .eq("id", queueRowId);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failed.push({ contact_id: contact.id, kind, error: msg });
      if (queueRowId) {
        await supabase
          .from("scheduled_emails")
          .update({ error: msg })
          .eq("id", queueRowId);
      }
    }
  }

  // -------- pass 1: due scheduled_emails (drip + anything else) --------
  const { data: due } = await supabase
    .from("scheduled_emails")
    .select("id, contact_id, kind, metadata")
    .is("sent_at", null)
    .is("cancelled_at", null)
    .lte("send_at", todayIso)
    .limit(500);

  const dueContactIds = Array.from(new Set((due ?? []).map((r) => r.contact_id)));
  const contactsById = new Map<string, ContactRow>();
  if (dueContactIds.length) {
    const { data: rows } = await supabase
      .from("contacts")
      .select(
        "id, display_name, first_name, last_name, emails, unsubscribe_token, unsubscribed_at, auto_touches_opt_out"
      )
      .in("id", dueContactIds);
    (rows ?? []).forEach((r) => contactsById.set(r.id, r as ContactRow));
  }

  for (const row of due ?? []) {
    const contact = contactsById.get(row.contact_id);
    if (!contact) continue;
    await trySend(contact, row.kind as TouchKind, row.id);
  }

  // -------- pass 2: today's anniversaries --------
  // Pull closed transactions whose month-day matches today, link to the
  // buyer-side contact (seller-side has already moved; a seller
  // anniversary doesn't make sense).
  const { data: anniversaryTx } = await supabase
    .from("transactions")
    .select("id, contact_id, closed_date, deal_type")
    .not("contact_id", "is", null)
    .not("closed_date", "is", null)
    .eq("deal_type", "buyer");

  const todayAnnivTx = (anniversaryTx ?? []).filter((t) => {
    if (!t.closed_date) return false;
    const d = t.closed_date as string; // date in 'YYYY-MM-DD'
    return d.slice(5) === monthDay && d.slice(0, 4) !== String(year);
  });

  if (todayAnnivTx.length) {
    const annivContactIds = Array.from(new Set(todayAnnivTx.map((t) => t.contact_id!)));
    const { data: annivContacts } = await supabase
      .from("contacts")
      .select(
        "id, display_name, first_name, last_name, emails, unsubscribe_token, unsubscribed_at, auto_touches_opt_out"
      )
      .in("id", annivContactIds);
    const annivById = new Map<string, ContactRow>(
      (annivContacts ?? []).map((r) => [r.id, r as ContactRow])
    );

    for (const tx of todayAnnivTx) {
      const contact = annivById.get(tx.contact_id!);
      if (!contact) continue;
      if (contact.auto_touches_opt_out || contact.unsubscribed_at) continue;
      if (!(contact.emails || []).some((e) => /@/.test(e))) continue;
      const dedupeKey = `annv:${tx.id}:${year}`;
      // Claim the touch via a unique-indexed insert; if someone else
      // already inserted (another cron run today), skip the send.
      const { data: claim } = await supabase
        .from("scheduled_emails")
        .insert({
          contact_id: contact.id,
          kind: "anniversary",
          send_at: todayIso,
          dedupe_key: dedupeKey,
          metadata: { transaction_id: tx.id, year },
        })
        .select("id")
        .maybeSingle();
      if (!claim) continue;
      await trySend(contact, "anniversary", claim.id);
    }
  }

  // -------- pass 3: today's birthdays --------
  const { data: birthdayContacts } = await supabase
    .from("contacts")
    .select(
      "id, display_name, first_name, last_name, emails, unsubscribe_token, unsubscribed_at, auto_touches_opt_out, birthday"
    )
    .not("birthday", "is", null);
  const todayBirthdays = (birthdayContacts ?? []).filter((c) => {
    if (!c.birthday) return false;
    return (c.birthday as string).slice(5) === monthDay;
  });

  for (const c of todayBirthdays) {
    const contact = c as unknown as ContactRow;
    if (contact.auto_touches_opt_out || contact.unsubscribed_at) continue;
    if (!(contact.emails || []).some((e) => /@/.test(e))) continue;
    const dedupeKey = `bday:${contact.id}:${year}`;
    const { data: claim } = await supabase
      .from("scheduled_emails")
      .insert({
        contact_id: contact.id,
        kind: "birthday",
        send_at: todayIso,
        dedupe_key: dedupeKey,
        metadata: { year },
      })
      .select("id")
      .maybeSingle();
    if (!claim) continue;
    await trySend(contact, "birthday", claim.id);
  }

  return NextResponse.json({
    ran_at: todayIso,
    sent_count: sent.length,
    failed_count: failed.length,
    sent,
    failed,
  });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

// Allow POST too so Vercel's cron (which may use either verb) and a
// one-off curl both work.
export async function POST(req: NextRequest) {
  return handle(req);
}
