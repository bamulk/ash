import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Download,
  FileText,
  CheckCircle2,
  Send,
  Mail,
  MailX,
  MailCheck,
  AlertTriangle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, LinkButton, Field, Input, Textarea, Badge } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import DeleteButton from "@/components/DeleteButton";
import ConfirmForm from "@/components/ConfirmForm";
import TestEmailForm from "@/components/TestEmailForm";
import { matchContacts, describeCriteria } from "@/lib/segments";
import { formatDate } from "@/lib/format";
import { isResendConfigured, defaultFrom } from "@/lib/resend";
import type { Contact, Segment, Campaign, SegmentCriteria } from "@/lib/types";
import {
  updateCampaignStatusAction,
  deleteCampaignAction,
  logCampaignTouchesAction,
  updateCampaignEmailAction,
  sendCampaignEmailAction,
  sendTestEmailAction,
} from "../../actions";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  postcard: "Postcard",
  card: "Card",
  mailer: "Mailer",
  other: "Other",
};

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: campaign } = await supabase.from("campaigns").select("*").eq("id", id).single();
  if (!campaign) notFound();
  const camp = campaign as Campaign;

  const segment = camp.segment_id
    ? ((await supabase.from("segments").select("*").eq("id", camp.segment_id).single()).data as Segment | null)
    : null;

  let matched: Contact[] = [];
  if (segment) {
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
    matched = matchContacts((contacts ?? []) as Contact[], segment.criteria as SegmentCriteria, tagsByContact);
  }

  // Per-contact send outcomes for this campaign
  const { data: outcomeRows } = await supabase
    .from("campaign_contacts")
    .select("contact_id, email_status, email_sent_at, email_error")
    .eq("campaign_id", id);
  const outcomeByContact = new Map(
    (outcomeRows ?? []).map((r) => [
      r.contact_id,
      {
        email_status: r.email_status as string | null,
        email_sent_at: r.email_sent_at as string | null,
        email_error: r.email_error as string | null,
      },
    ])
  );

  const resendOn = isResendConfigured();
  const emailable = matched.filter(
    (c) => !c.unsubscribed_at && (c.emails || []).some((e) => /@/.test(e))
  );
  const unsubscribedCount = matched.filter((c) => c.unsubscribed_at).length;
  const noEmailCount = matched.filter(
    (c) => !c.unsubscribed_at && !(c.emails || []).some((e) => /@/.test(e))
  ).length;

  const deleteAction = deleteCampaignAction.bind(null, id);
  const logAction = logCampaignTouchesAction.bind(null, id);
  const updateEmail = updateCampaignEmailAction.bind(null, id);
  const sendEmail = sendCampaignEmailAction.bind(null, id);
  const sendTest = sendTestEmailAction.bind(null, id);

  // Prefill the test-send input with the signed-in user's email —
  // Ashley will almost always want to test to herself first.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const myEmail = user?.email ?? "";

  const STATUSES: Campaign["status"][] = ["planned", "in_progress", "done"];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/marketing" className="text-sm text-slate-600 dark:text-slate-400 hover:underline">
          ← Marketing
        </Link>
      </div>

      <PageHeader
        title={camp.name}
        subtitle={`${KIND_LABEL[camp.kind]}${camp.scheduled_date ? ` · ${formatDate(camp.scheduled_date)}` : ""}`}
        actions={
          segment ? (
            <>
              <LinkButton href={`/api/export/csv?segment=${segment.id}`} variant="secondary">
                <Download size={14} /> CSV
              </LinkButton>
              <LinkButton href={`/api/export/labels?segment=${segment.id}`} variant="secondary">
                <FileText size={14} /> Labels
              </LinkButton>
            </>
          ) : undefined
        }
      />

      <Card className="p-4 flex flex-wrap items-center gap-4 justify-between">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500 dark:text-slate-400">Status:</span>
          {STATUSES.map((s) => {
            const setStatus = updateCampaignStatusAction.bind(null, id, s);
            return (
              <form key={s} action={setStatus}>
                <button
                  className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    camp.status === s
                      ? "bg-brand text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {s.replace("_", " ")}
                </button>
              </form>
            );
          })}
        </div>
        <DeleteButton action={deleteAction} label="Delete campaign" confirmText={`Delete campaign “${camp.name}”?`} />
      </Card>

      {/* Email composer */}
      <Card className="p-5">
        <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-sm font-medium flex items-center gap-2">
            <Mail size={14} className="text-brand" /> Email
            {camp.email_sent_at && (
              <Badge tone="done">
                Sent {formatDate(camp.email_sent_at)}
              </Badge>
            )}
          </h2>
          {segment && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {emailable.length} reachable
              {unsubscribedCount ? ` · ${unsubscribedCount} unsubscribed` : ""}
              {noEmailCount ? ` · ${noEmailCount} no email` : ""}
            </span>
          )}
        </div>

        {!resendOn && (
          <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg p-3 mb-3">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            <span>
              Set <code className="font-mono">RESEND_API_KEY</code> and{" "}
              <code className="font-mono">RESEND_FROM_EMAIL</code> in{" "}
              <code className="font-mono">.env.local</code> (and in Vercel) to enable sending.
              The domain in the from-address must be verified at{" "}
              <a href="https://resend.com/domains" className="underline" target="_blank">resend.com/domains</a>.
            </span>
          </div>
        )}

        <form action={updateEmail} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-3">
            <Field label="Subject" hint="You can use {first_name} or {display_name} tokens.">
              <Input name="email_subject" defaultValue={camp.email_subject ?? ""} placeholder="Hi {first_name} — a quick spring update" />
            </Field>
            <Field label="From" hint="Optional override; must be a verified Resend domain.">
              <Input name="email_from" defaultValue={camp.email_from ?? ""} placeholder={resendOn ? defaultFrom() : "ashley@ashleystonehomes.com"} />
            </Field>
          </div>
          <Field label="Reply-to" hint="Replies go here instead of the From address. Leave blank for no override.">
            <Input name="email_reply_to" type="email" defaultValue={camp.email_reply_to ?? ""} placeholder="ashleystonehomes@gmail.com" />
          </Field>
          <Field label="Body" hint="Plain text or basic HTML. {first_name} is replaced per contact. Unsubscribe link is added automatically.">
            <Textarea name="email_body" rows={10} defaultValue={camp.email_body ?? ""} placeholder={"Hi {first_name},\n\nI wanted to share a quick update on the Sacramento market…\n\n— Ashley"} />
          </Field>
          <div className="flex justify-end">
            <SubmitButton variant="secondary" size="sm">Save draft</SubmitButton>
          </div>
        </form>

        {/* Test + real send are separate forms so the real-send button
            isn't nested inside the composer or the test form. Both act
            on the last SAVED subject + body — hit "Save draft" first. */}
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex items-start sm:items-center justify-between gap-2 flex-col sm:flex-row">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Preview the saved copy before mailing the full list.
            </div>
            {resendOn ? (
              <TestEmailForm action={sendTest} defaultTo={myEmail} />
            ) : (
              <span className="text-xs text-slate-400">
                Configure Resend to enable test sends
              </span>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Real send goes to every reachable contact in the segment.
            </span>
            {resendOn && camp.email_subject && camp.email_body ? (
              <ConfirmForm
                action={sendEmail}
                confirmText={`Send this email to ${emailable.length} ${emailable.length === 1 ? "contact" : "contacts"}? This cannot be undone.`}
              >
                <SubmitButton size="sm">
                  <Send size={14} />
                  Send to {emailable.length} {emailable.length === 1 ? "contact" : "contacts"}
                </SubmitButton>
              </ConfirmForm>
            ) : (
              <span className="text-xs text-slate-400">
                {resendOn ? "Add a subject and body to enable send" : "Configure Resend to enable send"}
              </span>
            )}
          </div>
        </div>
      </Card>

      {segment ? (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div>
              <h2 className="text-sm font-medium">
                Target: <Link href={`/marketing/segments/${segment.id}`} className="text-brand hover:underline">{segment.name}</Link>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {describeCriteria(segment.criteria)} · {matched.length} contacts
              </p>
            </div>
            <form action={logAction}>
              <SubmitButton variant="secondary" size="sm">
                <Send size={14} /> Mark mailing sent
              </SubmitButton>
            </form>
          </div>
          {camp.status === "done" && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mb-2">
              <CheckCircle2 size={13} /> This campaign is marked done.
            </p>
          )}
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto">
            {matched.map((c) => {
              const o = outcomeByContact.get(c.id);
              const hasEmail = (c.emails || []).some((e) => /@/.test(e));
              return (
                <Link
                  key={c.id}
                  href={`/contacts/${c.id}`}
                  className="flex items-center justify-between py-2 text-sm hover:underline gap-3"
                >
                  <span className="truncate flex-1">{c.display_name}</span>
                  <span className="text-xs text-slate-400 inline-flex items-center gap-1 whitespace-nowrap">
                    {c.unsubscribed_at ? (
                      <><MailX size={12} /> Unsubscribed</>
                    ) : !hasEmail ? (
                      <>No email</>
                    ) : o?.email_status === "sent" || o?.email_status === "delivered" ? (
                      <><MailCheck size={12} className="text-emerald-500" /> Sent {o.email_sent_at ? formatDate(o.email_sent_at) : ""}</>
                    ) : o?.email_status === "bounced" || o?.email_status === "complained" ? (
                      <><MailX size={12} className="text-rose-500" /> {o.email_error ? o.email_error.slice(0, 60) : o.email_status}</>
                    ) : (
                      <>{(c.emails || [])[0]}</>
                    )}
                  </span>
                </Link>
              );
            })}
          </div>
        </Card>
      ) : (
        <Card className="p-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No segment attached. Edit this campaign on the{" "}
            <Link href="/marketing" className="text-brand hover:underline">Marketing</Link> page to target one.
          </p>
        </Card>
      )}
    </div>
  );
}
