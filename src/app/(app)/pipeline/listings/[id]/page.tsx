import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge, PageHeader } from "@/components/ui";
import DeleteButton from "@/components/DeleteButton";
import ListingForm from "../_ListingForm";
import Checklist from "@/components/Checklist";
import NotesPanel from "@/components/NotesPanel";
import {
  addListingTaskAction,
  deleteListingAction,
  deleteListingTaskAction,
  toggleListingTaskAction,
  updateListingAction,
  updateListingNotesAction,
} from "../../actions";
import {
  LISTING_STATUS_LABELS,
  type Contact,
  type Listing,
  type ListingStatus,
  type ListingTask,
} from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: listing }, { data: contacts }, { data: tasks }] = await Promise.all([
    supabase.from("listings").select("*").eq("id", id).single(),
    supabase.from("contacts").select("id, display_name, role, emails, phones").order("display_name"),
    supabase
      .from("listing_tasks")
      .select("*")
      .eq("listing_id", id)
      .order("position", { ascending: true }),
  ]);
  if (!listing) notFound();
  const l = listing as Listing;
  const seller = l.contact_id
    ? ((contacts ?? []).find((c) => c.id === l.contact_id) as Contact | undefined)
    : undefined;

  const update = updateListingAction.bind(null, id);
  const del = deleteListingAction.bind(null, id);
  const toggleTask = toggleListingTaskAction.bind(null, id);
  const addTask = addListingTaskAction.bind(null, id);
  const deleteTask = deleteListingTaskAction.bind(null, id);
  const saveNotes = updateListingNotesAction.bind(null, id);
  // Days-on-market is computed server-side on request; a wall-clock read
  // in a Server Component is fine and this value just lives on screen.
  const nowMs = new Date().getTime();
  const daysOnMarket = l.list_date
    ? Math.floor((nowMs - new Date(l.list_date).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/pipeline" className="text-sm text-muted hover:text-foreground">
          ← Pipeline
        </Link>
      </div>

      <PageHeader
        title={l.address}
        subtitle={[l.city, l.state].filter(Boolean).join(", ") || undefined}
        actions={
          <DeleteButton
            action={del}
            label="Delete listing"
            confirmText={`Delete the listing at ${l.address}? This cannot be undone.`}
          />
        }
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <Badge tone="planned">{LISTING_STATUS_LABELS[l.status as ListingStatus]}</Badge>
        {l.current_price != null && (
          <span className="font-display text-lg">
            {formatCurrency(Number(l.current_price))}
          </span>
        )}
        {daysOnMarket != null && (
          <span className="text-muted">{daysOnMarket} day{daysOnMarket === 1 ? "" : "s"} on market</span>
        )}
        {seller && (
          <span className="text-muted">
            Seller:{" "}
            <Link href={`/contacts/${seller.id}`} className="hover:underline">
              {seller.display_name}
            </Link>
          </span>
        )}
        {l.mls_number && <span className="text-muted">MLS #{l.mls_number}</span>}
        {l.est_close_date && (
          <span className="text-muted">Est. close {formatDate(l.est_close_date)}</span>
        )}
      </div>

      <Checklist
        tasks={(tasks ?? []) as ListingTask[]}
        toggleAction={toggleTask}
        addAction={addTask}
        deleteAction={deleteTask}
      />

      <NotesPanel initialNotes={l.notes ?? ""} action={saveNotes} />

      <ListingForm
        action={update}
        listing={l}
        contacts={contacts ?? []}
        submitLabel="Save changes"
      />
    </div>
  );
}
