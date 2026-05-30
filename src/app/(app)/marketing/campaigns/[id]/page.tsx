import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, FileText, CheckCircle2, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, LinkButton } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import DeleteButton from "@/components/DeleteButton";
import { matchContacts, describeCriteria } from "@/lib/segments";
import { formatDate } from "@/lib/format";
import type { Contact, Segment, Campaign, SegmentCriteria } from "@/lib/types";
import {
  updateCampaignStatusAction,
  deleteCampaignAction,
  logCampaignTouchesAction,
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

  const { count: touchedCount } = await supabase
    .from("campaign_contacts")
    .select("contact_id", { count: "exact", head: true })
    .eq("campaign_id", id);

  const deleteAction = deleteCampaignAction.bind(null, id);
  const logAction = logCampaignTouchesAction.bind(null, id);

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

      {segment ? (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div>
              <h2 className="text-sm font-medium">
                Target: <Link href={`/marketing/segments/${segment.id}`} className="text-brand hover:underline">{segment.name}</Link>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {describeCriteria(segment.criteria)} · {matched.length} contacts
                {touchedCount ? ` · ${touchedCount} logged as sent` : ""}
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
            {matched.map((c) => (
              <Link key={c.id} href={`/contacts/${c.id}`} className="flex items-center justify-between py-2 text-sm hover:underline">
                <span>{c.display_name}</span>
                <span className="text-xs text-slate-400">{[c.street, c.city].filter(Boolean).join(", ")}</span>
              </Link>
            ))}
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
