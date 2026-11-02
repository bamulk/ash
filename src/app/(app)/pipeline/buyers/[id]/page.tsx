import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, Star, X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, Field, Input, PageHeader, Textarea } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import DeleteButton from "@/components/DeleteButton";
import BuyerForm from "../_BuyerForm";
import NotesPanel from "@/components/NotesPanel";
import {
  addShowingAction,
  deleteBuyerAction,
  deleteShowingAction,
  updateBuyerAction,
  updateBuyerNotesAction,
} from "../../actions";
import {
  BUYER_STATUS_LABELS,
  type BuyerEngagement,
  type BuyerShowing,
  type BuyerStatus,
  type Contact,
} from "@/lib/types";
import { formatCurrency, formatDate, todayISO } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function BuyerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: buyer }, { data: contacts }, { data: showingRows }] = await Promise.all([
    supabase.from("buyer_engagements").select("*").eq("id", id).single(),
    supabase.from("contacts").select("id, display_name, role, emails, phones").order("display_name"),
    supabase
      .from("buyer_showings")
      .select("*")
      .eq("engagement_id", id)
      .order("shown_on", { ascending: false }),
  ]);
  if (!buyer) notFound();
  const b = buyer as BuyerEngagement;
  const buyerContact = (contacts ?? []).find((c) => c.id === b.contact_id) as
    | Contact
    | undefined;
  const showings = (showingRows ?? []) as BuyerShowing[];

  const update = updateBuyerAction.bind(null, id);
  const del = deleteBuyerAction.bind(null, id);
  const addShowing = addShowingAction.bind(null, id);
  const saveNotes = updateBuyerNotesAction.bind(null, id);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/pipeline" className="text-sm text-muted hover:text-foreground">
          ← Pipeline
        </Link>
      </div>

      <PageHeader
        title={buyerContact?.display_name ?? "Buyer engagement"}
        subtitle={b.target_neighborhoods ?? undefined}
        actions={
          <DeleteButton
            action={del}
            label="Delete engagement"
            confirmText={`Delete the buyer engagement for ${buyerContact?.display_name ?? "this buyer"}? This cannot be undone.`}
          />
        }
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <Badge tone="planned">{BUYER_STATUS_LABELS[b.status as BuyerStatus]}</Badge>
        {b.budget_max != null && (
          <span className="font-display text-lg">up to {formatCurrency(Number(b.budget_max))}</span>
        )}
        {b.preapproval_amount != null && (
          <span className="text-muted">
            Preapproved {formatCurrency(Number(b.preapproval_amount))}
            {b.preapproval_lender ? ` · ${b.preapproval_lender}` : ""}
          </span>
        )}
        {b.preapproval_expires && (
          <span className="text-muted">Expires {formatDate(b.preapproval_expires)}</span>
        )}
      </div>

      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg">Showings</h2>
          <span className="text-xs text-soft">{showings.length} logged</span>
        </div>
        {showings.length === 0 ? (
          <p className="text-sm text-muted">No showings logged yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {showings.map((s) => (
              <div key={s.id} className="py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{s.address}</div>
                  <div className="text-xs text-muted mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>{formatDate(s.shown_on)}</span>
                    {s.rating != null && (
                      <span className="inline-flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            size={12}
                            className={
                              i < (s.rating ?? 0)
                                ? "text-brand fill-brand"
                                : "text-border"
                            }
                            strokeWidth={1.5}
                          />
                        ))}
                      </span>
                    )}
                  </div>
                  {s.notes && (
                    <p className="text-sm text-muted mt-1 whitespace-pre-wrap">{s.notes}</p>
                  )}
                </div>
                <form action={deleteShowingAction.bind(null, id, s.id)}>
                  <button className="text-soft hover:text-brand" aria-label="Remove showing">
                    <X size={14} />
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
        <form action={addShowing} className="space-y-3 border-t border-border pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_120px] gap-3">
            <Field label="Property address">
              <Input name="address" required placeholder="1234 K Street" />
            </Field>
            <Field label="Shown on">
              <Input type="date" name="shown_on" defaultValue={todayISO()} />
            </Field>
            <Field label="Rating">
              <Input name="rating" type="number" min={1} max={5} placeholder="1–5" />
            </Field>
          </div>
          <Field label="Notes">
            <Textarea name="notes" rows={2} placeholder="What they loved, what put them off…" />
          </Field>
          <div className="flex justify-end">
            <SubmitButton variant="secondary" size="sm">
              <Plus size={14} /> Log showing
            </SubmitButton>
          </div>
        </form>
      </Card>

      <NotesPanel initialNotes={b.notes ?? ""} action={saveNotes} />

      <BuyerForm action={update} buyer={b} contacts={contacts ?? []} submitLabel="Save changes" />
    </div>
  );
}
