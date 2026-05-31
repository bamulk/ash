import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, Phone, MapPin, Plus, X, Home, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader, Badge, Input, Button } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import DeleteButton from "@/components/DeleteButton";
import ContactForm from "@/components/ContactForm";
import { formatRole, formatCurrency, formatDate, todayISO } from "@/lib/format";
import type { Contact, Tag, Transaction, Reminder, HomeValuation } from "@/lib/types";
import { isRentCastConfigured } from "@/lib/rentcast";
import {
  updateContactAction,
  deleteContactAction,
  addTagAction,
  removeTagAction,
  checkContactValueAction,
} from "../actions";
import { createReminderAction, toggleReminderAction } from "../../reminders/actions";

export const dynamic = "force-dynamic";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: contact } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", id)
    .single();
  if (!contact) notFound();
  const c = contact as Contact;

  const [{ data: linkRows }, { data: txns }, { data: reminders }, { data: campRows }, { data: valRows }] =
    await Promise.all([
      supabase.from("contact_tags").select("tag_id, tags(id, name, color)").eq("contact_id", id),
      supabase.from("transactions").select("*").eq("contact_id", id).order("closed_date", { ascending: false }),
      supabase.from("reminders").select("*").eq("contact_id", id).order("due_date"),
      supabase
        .from("campaign_contacts")
        .select("touched_at, status, campaigns(id, name, scheduled_date, kind)")
        .eq("contact_id", id),
      supabase
        .from("home_valuations")
        .select("*")
        .eq("contact_id", id)
        .order("queried_at", { ascending: false }),
    ]);

  const tags = (linkRows ?? [])
    .map((r) => (r as unknown as { tags: Tag }).tags)
    .filter(Boolean) as Tag[];
  const transactions = (txns ?? []) as Transaction[];
  const rems = (reminders ?? []) as Reminder[];
  const valuations = (valRows ?? []) as HomeValuation[];
  const latestVal = valuations[0];
  const rentcastOn = isRentCastConfigured();
  const campaigns = (campRows ?? []) as unknown as {
    touched_at: string | null;
    status: string;
    campaigns: { id: string; name: string; scheduled_date: string | null; kind: string } | null;
  }[];

  const updateAction = updateContactAction.bind(null, id);
  const deleteAction = deleteContactAction.bind(null, id);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/contacts" className="text-sm text-slate-600 dark:text-slate-400 hover:underline">
          ← All contacts
        </Link>
      </div>

      <PageHeader
        title={c.display_name}
        subtitle={[c.city, c.state].filter(Boolean).join(", ") || undefined}
        actions={<DeleteButton action={deleteAction} label="Delete contact" confirmText={`Delete ${c.display_name}? This cannot be undone.`} />}
      />

      {/* Quick facts */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-600 dark:text-slate-400">
        {c.role && <Badge tone={c.role}>{formatRole(c.role)}</Badge>}
        {c.emails?.map((e) => (
          <a key={e} href={`mailto:${e}`} className="inline-flex items-center gap-1 hover:underline">
            <Mail size={14} /> {e}
          </a>
        ))}
        {c.phones?.map((p) => (
          <a key={p} href={`tel:${p}`} className="inline-flex items-center gap-1 hover:underline">
            <Phone size={14} /> {p}
          </a>
        ))}
        {(c.street || c.city) && (
          <span className="inline-flex items-center gap-1">
            <MapPin size={14} /> {[c.street, c.city, c.state, c.zip].filter(Boolean).join(", ")}
          </span>
        )}
      </div>

      {/* Tags */}
      <Card className="p-4">
        <h2 className="text-sm font-medium mb-3">Tags</h2>
        <div className="flex flex-wrap items-center gap-2">
          {tags.length === 0 && <span className="text-sm text-slate-400">No tags yet.</span>}
          {tags.map((t) => {
            const remove = removeTagAction.bind(null, id, t.id);
            return (
              <span key={t.id} className="inline-flex items-center gap-1">
                <Badge tone="planned">{t.name}</Badge>
                <form action={remove}>
                  <button className="text-slate-400 hover:text-rose-600" aria-label={`Remove ${t.name}`}>
                    <X size={13} />
                  </button>
                </form>
              </span>
            );
          })}
        </div>
        <form action={addTagAction.bind(null, id)} className="mt-3 flex gap-2">
          <Input name="tag" placeholder="Add a tag (e.g. Past client, VIP)" className="max-w-xs" />
          <Button type="submit" variant="secondary" size="sm">
            <Plus size={14} /> Add
          </Button>
        </form>
      </Card>

      {/* Transactions */}
      <Card className="p-4">
        <h2 className="text-sm font-medium mb-3">Deals ({transactions.length})</h2>
        {transactions.length === 0 ? (
          <p className="text-sm text-slate-400">No deals linked to this contact.</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {transactions.map((t) => (
              <Link
                key={t.id}
                href={`/transactions/${t.id}`}
                className="flex items-center justify-between py-2 text-sm hover:underline"
              >
                <span>
                  {t.address || t.client_name}{" "}
                  <span className="text-slate-400">· {formatDate(t.closed_date)}</span>
                </span>
                <span className="font-medium">{formatCurrency(t.sold_price)}</span>
              </Link>
            ))}
          </div>
        )}
      </Card>

      {/* Home value (RentCast AVM) */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <h2 className="text-sm font-medium flex items-center gap-2">
            <Home size={14} className="text-brand" /> Home value
          </h2>
          {c.street ? (
            <form action={checkContactValueAction.bind(null, id)}>
              <SubmitButton variant="secondary" size="sm" disabled={!rentcastOn}>
                {latestVal ? "Refresh value" : "Check value"}
              </SubmitButton>
            </form>
          ) : (
            <span className="text-xs text-slate-400">Add a street address to check value</span>
          )}
        </div>

        {!rentcastOn && (
          <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg p-3 mb-3">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            <span>
              Set <code className="font-mono">RENTCAST_API_KEY</code> in <code className="font-mono">.env.local</code> (and Vercel) to enable RentCast valuations. Free tier covers 50 checks/mo.
            </span>
          </div>
        )}

        {latestVal ? (
          <div className="space-y-2">
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-2xl font-semibold">{formatCurrency(latestVal.estimate)}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {latestVal.range_low != null && latestVal.range_high != null
                  ? `range ${formatCurrency(latestVal.range_low)} – ${formatCurrency(latestVal.range_high)}`
                  : ""}{" "}
                · as of {formatDate(latestVal.queried_at)}
              </span>
            </div>
            {valuations.length > 1 && (
              <details className="text-xs text-slate-500 dark:text-slate-400">
                <summary className="cursor-pointer">History ({valuations.length - 1} earlier)</summary>
                <div className="mt-2 space-y-1">
                  {valuations.slice(1).map((v) => (
                    <div key={v.id} className="flex justify-between">
                      <span>{formatDate(v.queried_at)}</span>
                      <span>{formatCurrency(v.estimate)}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        ) : (
          rentcastOn && (
            <p className="text-sm text-slate-400">
              No value snapshot yet. Click {c.street ? "“Check value”" : "Check value"} to fetch an estimate from RentCast.
            </p>
          )
        )}
      </Card>

      {/* Reminders */}
      <Card className="p-4">
        <h2 className="text-sm font-medium mb-3">Reminders</h2>
        <div className="space-y-2">
          {rems.length === 0 && <p className="text-sm text-slate-400">No reminders.</p>}
          {rems.map((r) => {
            const toggle = toggleReminderAction.bind(null, r.id);
            return (
              <div key={r.id} className="flex items-center gap-2 text-sm">
                <form action={toggle}>
                  <button
                    className={`w-4 h-4 rounded border ${r.is_done ? "bg-brand border-brand" : "border-slate-300 dark:border-slate-600"}`}
                    aria-label="Toggle done"
                  />
                </form>
                <span className={r.is_done ? "line-through text-slate-400" : ""}>
                  {r.title} <span className="text-slate-400">· {formatDate(r.due_date)}</span>
                </span>
              </div>
            );
          })}
        </div>
        <form action={createReminderAction} className="mt-3 grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
          <input type="hidden" name="contact_id" value={id} />
          <input type="hidden" name="kind" value="follow_up" />
          <Input name="title" placeholder="Quick follow-up…" />
          <Input type="date" name="due_date" defaultValue={todayISO()} />
          <SubmitButton variant="secondary" size="sm">
            <Plus size={14} /> Add
          </SubmitButton>
        </form>
      </Card>

      {/* Campaign history */}
      {campaigns.length > 0 && (
        <Card className="p-4">
          <h2 className="text-sm font-medium mb-3">Marketing touches</h2>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {campaigns.map((cc, i) => (
              <div key={i} className="flex items-center justify-between py-2 text-sm">
                <Link href={`/marketing/campaigns/${cc.campaigns?.id}`} className="hover:underline">
                  {cc.campaigns?.name ?? "Campaign"}
                </Link>
                <span className="text-slate-400">
                  {cc.status}
                  {cc.touched_at ? ` · ${formatDate(cc.touched_at)}` : ""}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Edit */}
      <div>
        <h2 className="text-sm font-medium mb-3 text-slate-700 dark:text-slate-300">Edit details</h2>
        <ContactForm action={updateAction} contact={c} submitLabel="Save changes" />
      </div>
    </div>
  );
}
