import Link from "next/link";
import { Megaphone, Filter, Plus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, Badge, Field, Input, Select } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import { matchContacts, describeCriteria } from "@/lib/segments";
import { formatDate } from "@/lib/format";
import type { Contact, Segment, Campaign, SegmentCriteria } from "@/lib/types";
import { createSegmentAction, createCampaignAction } from "./actions";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  postcard: "Postcard",
  card: "Card",
  mailer: "Mailer",
  other: "Other",
};

export default async function MarketingPage() {
  const supabase = await createClient();
  const [{ data: segments }, { data: campaigns }, { data: contacts }, { data: tags }, { data: links }] =
    await Promise.all([
      supabase.from("segments").select("*").order("created_at", { ascending: false }),
      supabase.from("campaigns").select("*").order("created_at", { ascending: false }),
      supabase.from("contacts").select("*"),
      supabase.from("tags").select("id, name, color").order("name"),
      supabase.from("contact_tags").select("contact_id, tag_id"),
    ]);

  const tagsByContact = new Map<string, Set<string>>();
  for (const l of links ?? []) {
    const s = tagsByContact.get(l.contact_id) ?? new Set<string>();
    s.add(l.tag_id);
    tagsByContact.set(l.contact_id, s);
  }
  const allContacts = (contacts ?? []) as Contact[];
  const tagsById = new Map((tags ?? []).map((t) => [t.id, t.name]));

  const segCount = (c: SegmentCriteria) => matchContacts(allContacts, c, tagsByContact).length;
  const segById = new Map((segments ?? []).map((s) => [s.id, s as Segment]));

  return (
    <div className="space-y-8">
      <PageHeader title="Marketing" subtitle="Build mailing segments and track campaigns" />

      {/* Segments */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Filter size={15} /> Segments
        </h2>

        {(segments ?? []).length > 0 && (
          <Card className="divide-y divide-slate-100 dark:divide-slate-800">
            {(segments ?? []).map((s) => (
              <Link
                key={s.id}
                href={`/marketing/segments/${s.id}`}
                className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                <div>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {describeCriteria(
                      (s as Segment).criteria,
                      (s as Segment).criteria.tag_id
                        ? tagsById.get((s as Segment).criteria.tag_id!)
                        : undefined
                    )}
                  </div>
                </div>
                <Badge tone="planned">
                  <Users size={12} className="mr-1" /> {segCount((s as Segment).criteria)}
                </Badge>
              </Link>
            ))}
          </Card>
        )}

        <Card className="p-5">
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Plus size={14} /> New segment
          </h3>
          <form action={createSegmentAction} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Name">
                <Input name="name" required placeholder="e.g. Past sellers in Sacramento" />
              </Field>
              <Field label="Description">
                <Input name="description" />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Role">
                <Select name="role" defaultValue="">
                  <option value="">Any</option>
                  <option value="buyer">Buyer</option>
                  <option value="seller">Seller</option>
                  <option value="both">Buyer &amp; Seller</option>
                </Select>
              </Field>
              <Field label="City">
                <Input name="city" placeholder="Any" />
              </Field>
              <Field label="ZIP starts with">
                <Input name="zip" placeholder="Any" />
              </Field>
              <Field label="Tag">
                <Select name="tag_id" defaultValue="">
                  <option value="">Any</option>
                  {(tags ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="flex items-center justify-between">
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" name="has_email" /> Only contacts with email
              </label>
              <SubmitButton variant="secondary" size="sm">
                Create segment
              </SubmitButton>
            </div>
          </form>
        </Card>
      </section>

      {/* Campaigns */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Megaphone size={15} /> Campaigns
        </h2>

        {(campaigns ?? []).length > 0 && (
          <Card className="divide-y divide-slate-100 dark:divide-slate-800">
            {(campaigns ?? []).map((c) => {
              const seg = (c as Campaign).segment_id ? segById.get((c as Campaign).segment_id!) : null;
              return (
                <Link
                  key={c.id}
                  href={`/marketing/campaigns/${c.id}`}
                  className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {c.name}
                      <span className="text-xs text-slate-400">{KIND_LABEL[(c as Campaign).kind]}</span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {seg ? seg.name : "No segment"}
                      {(c as Campaign).scheduled_date ? ` · ${formatDate((c as Campaign).scheduled_date)}` : ""}
                    </div>
                  </div>
                  <Badge tone={(c as Campaign).status}>{(c as Campaign).status.replace("_", " ")}</Badge>
                </Link>
              );
            })}
          </Card>
        )}

        <Card className="p-5">
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Plus size={14} /> New campaign
          </h3>
          <form action={createCampaignAction} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Name">
                <Input name="name" required placeholder="e.g. 2026 Holiday cards" />
              </Field>
              <Field label="Type">
                <Select name="kind" defaultValue="postcard">
                  <option value="postcard">Postcard</option>
                  <option value="card">Card</option>
                  <option value="mailer">Mailer</option>
                  <option value="other">Other</option>
                </Select>
              </Field>
              <Field label="Target segment">
                <Select name="segment_id" defaultValue="">
                  <option value="">— None —</option>
                  {(segments ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Scheduled date">
                <Input type="date" name="scheduled_date" />
              </Field>
            </div>
            <div className="flex justify-end">
              <SubmitButton variant="secondary" size="sm">
                Create campaign
              </SubmitButton>
            </div>
          </form>
        </Card>
      </section>
    </div>
  );
}
