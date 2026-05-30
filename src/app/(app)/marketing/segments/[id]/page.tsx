import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, FileText, Mail, Phone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, Badge, LinkButton } from "@/components/ui";
import DeleteButton from "@/components/DeleteButton";
import SegmentForm from "@/components/SegmentForm";
import { matchContacts, describeCriteria } from "@/lib/segments";
import { formatRole } from "@/lib/format";
import type { Contact, Segment, Tag, SegmentCriteria } from "@/lib/types";
import { updateSegmentAction, deleteSegmentAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function SegmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: segment } = await supabase.from("segments").select("*").eq("id", id).single();
  if (!segment) notFound();
  const seg = segment as Segment;

  const [{ data: contacts }, { data: tags }, { data: links }] = await Promise.all([
    supabase.from("contacts").select("*").order("display_name"),
    supabase.from("tags").select("id, name, color").order("name"),
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
    seg.criteria as SegmentCriteria,
    tagsByContact
  );
  const tagsById = new Map((tags ?? []).map((t) => [t.id, t.name]));

  const updateAction = updateSegmentAction.bind(null, id);
  const deleteAction = deleteSegmentAction.bind(null, id);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/marketing" className="text-sm text-slate-600 dark:text-slate-400 hover:underline">
          ← Marketing
        </Link>
      </div>

      <PageHeader
        title={seg.name}
        subtitle={describeCriteria(seg.criteria, seg.criteria.tag_id ? tagsById.get(seg.criteria.tag_id) : undefined)}
        actions={
          <>
            <LinkButton href={`/api/export/csv?segment=${id}`} variant="secondary">
              <Download size={14} /> CSV
            </LinkButton>
            <LinkButton href={`/api/export/labels?segment=${id}`} variant="secondary">
              <FileText size={14} /> Labels
            </LinkButton>
          </>
        }
      />

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium">
            <Badge tone="planned">{matched.length}</Badge> matching contacts
          </h2>
        </div>
        {matched.length === 0 ? (
          <p className="text-sm text-slate-400">No contacts match these filters.</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[28rem] overflow-y-auto">
            {matched.map((c) => (
              <Link
                key={c.id}
                href={`/contacts/${c.id}`}
                className="flex items-center justify-between py-2 text-sm hover:underline"
              >
                <span className="flex items-center gap-2">
                  {c.display_name}
                  {c.role && <Badge tone={c.role}>{formatRole(c.role)}</Badge>}
                </span>
                <span className="text-xs text-slate-400 flex items-center gap-3">
                  {[c.city, c.state].filter(Boolean).join(", ")}
                  {c.emails?.[0] && <Mail size={12} />}
                  {c.phones?.[0] && <Phone size={12} />}
                </span>
              </Link>
            ))}
          </div>
        )}
      </Card>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300">Edit segment</h2>
          <DeleteButton action={deleteAction} label="Delete segment" confirmText={`Delete segment “${seg.name}”?`} />
        </div>
        <SegmentForm action={updateAction} segment={seg} tags={(tags ?? []) as Tag[]} submitLabel="Save changes" />
      </div>
    </div>
  );
}
