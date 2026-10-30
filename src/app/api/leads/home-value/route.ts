/**
 * Public endpoint used by the "What's my home worth?" form on
 * ashleystonehomes.com. The marketing site POSTs the visitor's details
 * here with a shared secret header; this creates a Contact (tagged
 * `lead`), stores the inquiry, pulls a RentCast AVM, emails Ashley an
 * internal notice, sends the visitor an immediate welcome, and queues
 * the day-7 and day-30 drip steps.
 *
 * Env:
 *   WEBSITE_LEAD_SECRET      — must match the x-asg-secret header
 *   SUPABASE_SERVICE_ROLE_KEY — needed to insert as an unauthenticated caller
 *   RESEND_API_KEY, RESEND_FROM_EMAIL — for the welcome + notice emails
 *   RENTCAST_API_KEY         — for the AVM lookup (fails soft if missing)
 *
 * Rate-limiting is deliberately not elaborate here: the shared secret
 * blocks drive-by posts, and Vercel's platform-level DDoS protection
 * is enough for a form that will see <100 submissions a month.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAvm, isRentCastConfigured } from "@/lib/rentcast";
import {
  DRIP_SCHEDULE,
  notifyNewLead,
  sendTouch,
} from "@/lib/touches";

export const runtime = "nodejs";

type Body = {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  message?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const expected = process.env.WEBSITE_LEAD_SECRET?.trim();
  if (!expected) {
    return NextResponse.json(
      { error: "WEBSITE_LEAD_SECRET is not configured on the server." },
      { status: 500 }
    );
  }
  const got = req.headers.get("x-asg-secret")?.trim();
  if (got !== expected) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const name = (body.name || "").trim();
  const email = (body.email || "").trim().toLowerCase();
  const phone = (body.phone || "").trim();
  const address = (body.address || "").trim();
  const city = (body.city || "").trim() || null;
  const state = (body.state || "").trim() || null;
  const zip = (body.zip || "").trim() || null;
  const message = (body.message || "").trim() || null;

  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  if (!EMAIL_RE.test(email))
    return NextResponse.json({ error: "valid email required" }, { status: 400 });
  if (!address)
    return NextResponse.json({ error: "address required" }, { status: 400 });

  const [first, ...rest] = name.split(/\s+/);
  const last = rest.join(" ");

  const supabase = createAdminClient();

  // 1. Find existing contact by email, or create one. Email match wins
  //    over a name-only match — people spell their name differently.
  const { data: existing, error: findErr } = await supabase
    .from("contacts")
    .select("id, display_name, first_name, last_name, emails, unsubscribe_token")
    .contains("emails", [email])
    .maybeSingle();
  if (findErr) {
    return NextResponse.json({ error: findErr.message }, { status: 500 });
  }

  let contact: {
    id: string;
    display_name: string;
    first_name: string;
    last_name: string;
    emails: string[];
    unsubscribe_token: string;
  };
  if (existing) {
    contact = existing as typeof contact;
  } else {
    const { data: created, error: createErr } = await supabase
      .from("contacts")
      .insert({
        first_name: first || "",
        last_name: last,
        display_name: name,
        emails: [email],
        phones: phone ? [phone] : [],
        street: address,
        city,
        state,
        zip,
        source: "website",
      })
      .select("id, display_name, first_name, last_name, emails, unsubscribe_token")
      .single();
    if (createErr || !created) {
      return NextResponse.json(
        { error: createErr?.message || "create failed" },
        { status: 500 }
      );
    }
    contact = created as typeof contact;
  }

  // 2. Tag with `lead` (if not already).
  const { data: leadTag } = await supabase
    .from("tags")
    .select("id")
    .eq("name", "lead")
    .maybeSingle();
  if (leadTag) {
    await supabase
      .from("contact_tags")
      .upsert({ contact_id: contact.id, tag_id: leadTag.id });
  }

  // 3. Insert the inquiry row (we'll backfill the AVM shortly).
  const fullAddr = [address, city, state, zip].filter(Boolean).join(", ");
  const { data: inquiry, error: inqErr } = await supabase
    .from("home_value_requests")
    .insert({
      contact_id: contact.id,
      address,
      city,
      state,
      zip,
      message,
      source: "public_form",
    })
    .select("id")
    .single();
  if (inqErr || !inquiry) {
    return NextResponse.json(
      { error: inqErr?.message || "inquiry create failed" },
      { status: 500 }
    );
  }

  // 4. Pull the RentCast AVM. If it fails or isn't configured, record
  //    the error on the row so Ashley sees it rather than silently
  //    missing data; we still proceed with the drip.
  let avmSummary: { estimate: number | null; low: number | null; high: number | null; error: string | null } = {
    estimate: null,
    low: null,
    high: null,
    error: isRentCastConfigured() ? null : "RentCast not configured",
  };
  if (isRentCastConfigured()) {
    try {
      const avm = await fetchAvm(fullAddr);
      avmSummary = {
        estimate: avm.estimate,
        low: avm.rangeLow,
        high: avm.rangeHigh,
        error: null,
      };
      await supabase
        .from("home_value_requests")
        .update({
          avm_estimate: avm.estimate,
          avm_low: avm.rangeLow,
          avm_high: avm.rangeHigh,
          avm_raw: avm.raw,
          avm_fetched_at: new Date().toISOString(),
        })
        .eq("id", inquiry.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      avmSummary = { estimate: null, low: null, high: null, error: msg };
      await supabase
        .from("home_value_requests")
        .update({ avm_error: msg, avm_fetched_at: new Date().toISOString() })
        .eq("id", inquiry.id);
    }
  }

  // 5. Queue the drip steps. `drip_welcome` sends immediately below;
  //    the day-7 and day-30 steps sit in scheduled_emails until the
  //    daily cron processes them. We DON'T dedupe by contact — if
  //    someone submits again, they get a fresh drip (realistic for a
  //    seller who was browsing in May and comes back in October).
  const now = new Date();
  const laterSteps = DRIP_SCHEDULE.filter((s) => s.days > 0);
  if (laterSteps.length) {
    const rows = laterSteps.map((s) => {
      const d = new Date(now);
      d.setDate(d.getDate() + s.days);
      return {
        contact_id: contact.id,
        kind: s.kind,
        send_at: d.toISOString(),
        metadata: { home_value_request_id: inquiry.id },
      };
    });
    await supabase.from("scheduled_emails").insert(rows);
  }

  // 6. Send Ashley the internal notice + the lead the welcome. If
  //    either fails, we log and keep going — the inquiry is already
  //    stored so nothing is lost.
  await notifyNewLead({
    contactName: contact.display_name,
    contactEmail: email,
    contactPhone: phone || null,
    address: fullAddr,
    message,
    avm: avmSummary,
  }).catch((err) =>
    console.error("[lead] notifyNewLead failed:", err instanceof Error ? err.message : err)
  );

  try {
    const messageId = await sendTouch({
      kind: "drip_welcome",
      contact,
      unsubscribeToken: contact.unsubscribe_token,
    });
    await supabase.from("scheduled_emails").insert({
      contact_id: contact.id,
      kind: "drip_welcome",
      send_at: now.toISOString(),
      sent_at: now.toISOString(),
      resend_message_id: messageId,
      metadata: { home_value_request_id: inquiry.id },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[lead] welcome send failed:", msg);
    await supabase.from("scheduled_emails").insert({
      contact_id: contact.id,
      kind: "drip_welcome",
      send_at: now.toISOString(),
      error: msg,
      metadata: { home_value_request_id: inquiry.id },
    });
  }

  return NextResponse.json({ ok: true, contact_id: contact.id });
}
