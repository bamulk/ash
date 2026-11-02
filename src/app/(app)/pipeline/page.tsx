import Link from "next/link";
import { Home as HomeIcon, Users as UsersIcon, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, LinkButton, PageHeader } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  BUYER_PIPELINE_STATUSES,
  BUYER_STATUS_LABELS,
  LISTING_PIPELINE_STATUSES,
  LISTING_STATUS_LABELS,
  type BuyerEngagement,
  type BuyerStatus,
  type Contact,
  type Listing,
  type ListingStatus,
} from "@/lib/types";
import { moveBuyerStatusAction, moveListingStatusAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const supabase = await createClient();
  const [{ data: listingRows }, { data: buyerRows }, { data: contactRows }] =
    await Promise.all([
      supabase.from("listings").select("*").order("updated_at", { ascending: false }),
      supabase
        .from("buyer_engagements")
        .select("*")
        .order("updated_at", { ascending: false }),
      supabase
        .from("contacts")
        .select("id, display_name, first_name, last_name, emails, phones"),
    ]);

  const listings = (listingRows ?? []) as Listing[];
  const buyers = (buyerRows ?? []) as BuyerEngagement[];
  const contactsById = new Map<string, Contact>(
    (contactRows ?? []).map((c) => [c.id, c as Contact])
  );

  const activeListings = listings.filter(
    (l) => l.status !== "sold" && l.status !== "withdrawn" && l.status !== "expired"
  );
  const activeBuyers = buyers.filter(
    (b) => b.status !== "closed" && b.status !== "paused"
  );
  const listingsOnMarket = activeListings
    .filter((l) => l.status === "active" || l.status === "coming_soon")
    .reduce((sum, l) => sum + Number(l.current_price ?? l.list_price ?? 0), 0);
  const buyerBudget = activeBuyers.reduce(
    (sum, b) => sum + Number(b.budget_max ?? b.preapproval_amount ?? 0),
    0
  );

  const listingsByStatus = new Map<ListingStatus, Listing[]>();
  for (const s of LISTING_PIPELINE_STATUSES) listingsByStatus.set(s, []);
  for (const l of activeListings) {
    const bucket = listingsByStatus.get(l.status as ListingStatus);
    if (bucket) bucket.push(l);
  }

  const buyersByStatus = new Map<BuyerStatus, BuyerEngagement[]>();
  for (const s of BUYER_PIPELINE_STATUSES) buyersByStatus.set(s, []);
  for (const b of activeBuyers) {
    const bucket = buyersByStatus.get(b.status as BuyerStatus);
    if (bucket) bucket.push(b);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Pipeline"
        subtitle={`${activeListings.length} active ${activeListings.length === 1 ? "listing" : "listings"} · ${activeBuyers.length} active ${activeBuyers.length === 1 ? "buyer" : "buyers"}`}
        actions={
          <>
            <LinkButton href="/pipeline/listings/new" variant="secondary" size="sm">
              <Plus size={14} /> Add listing
            </LinkButton>
            <LinkButton href="/pipeline/buyers/new" variant="secondary" size="sm">
              <Plus size={14} /> Add buyer
            </LinkButton>
          </>
        }
      />

      {/* Pipeline totals strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="eyebrow">Active listings</div>
          <div className="text-2xl font-display mt-1">{activeListings.length}</div>
        </Card>
        <Card className="p-4">
          <div className="eyebrow">On market $</div>
          <div className="text-2xl font-display mt-1">
            {listingsOnMarket > 0 ? formatCurrency(listingsOnMarket) : "—"}
          </div>
        </Card>
        <Card className="p-4">
          <div className="eyebrow">Active buyers</div>
          <div className="text-2xl font-display mt-1">{activeBuyers.length}</div>
        </Card>
        <Card className="p-4">
          <div className="eyebrow">Buyer budget</div>
          <div className="text-2xl font-display mt-1">
            {buyerBudget > 0 ? formatCurrency(buyerBudget) : "—"}
          </div>
        </Card>
      </div>

      {/* Listings pipeline */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <HomeIcon size={16} className="text-brand" />
          <h2 className="text-lg font-display">Listings</h2>
          <Link href="/pipeline/listings/new" className="ml-auto text-xs text-muted hover:text-foreground">
            + Add listing
          </Link>
        </div>
        {activeListings.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-sm text-muted">
              No active listings yet.{" "}
              <Link href="/pipeline/listings/new" className="text-brand underline">
                Add one
              </Link>
              .
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {LISTING_PIPELINE_STATUSES.map((status) => (
              <Card key={status} className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="eyebrow">{LISTING_STATUS_LABELS[status]}</span>
                  <span className="text-xs text-soft">
                    {(listingsByStatus.get(status) ?? []).length}
                  </span>
                </div>
                <div className="space-y-2">
                  {(listingsByStatus.get(status) ?? []).map((l) => (
                    <ListingCard
                      key={l.id}
                      listing={l}
                      contact={l.contact_id ? contactsById.get(l.contact_id) : undefined}
                    />
                  ))}
                  {(listingsByStatus.get(status) ?? []).length === 0 && (
                    <p className="text-xs text-soft">—</p>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Buyers pipeline */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <UsersIcon size={16} className="text-brand" />
          <h2 className="text-lg font-display">Buyers</h2>
          <Link href="/pipeline/buyers/new" className="ml-auto text-xs text-muted hover:text-foreground">
            + Add buyer
          </Link>
        </div>
        {activeBuyers.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-sm text-muted">
              No active buyer engagements yet.{" "}
              <Link href="/pipeline/buyers/new" className="text-brand underline">
                Add one
              </Link>
              .
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
            {BUYER_PIPELINE_STATUSES.map((status) => (
              <Card key={status} className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="eyebrow">{BUYER_STATUS_LABELS[status]}</span>
                  <span className="text-xs text-soft">
                    {(buyersByStatus.get(status) ?? []).length}
                  </span>
                </div>
                <div className="space-y-2">
                  {(buyersByStatus.get(status) ?? []).map((b) => (
                    <BuyerCard
                      key={b.id}
                      buyer={b}
                      contact={contactsById.get(b.contact_id)}
                    />
                  ))}
                  {(buyersByStatus.get(status) ?? []).length === 0 && (
                    <p className="text-xs text-soft">—</p>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Closed / paused tail */}
      <section className="text-sm text-muted flex flex-wrap items-center gap-x-6 gap-y-2 pt-4 border-t border-border">
        <Link href="/transactions" className="hover:text-foreground">
          Closed deals ledger →
        </Link>
        <span className="text-soft">·</span>
        <span>
          {listings.filter((l) => l.status === "sold").length} sold · {" "}
          {listings.filter((l) => l.status === "withdrawn" || l.status === "expired").length} withdrawn / expired · {" "}
          {buyers.filter((b) => b.status === "closed").length} closed-buyer engagements · {" "}
          {buyers.filter((b) => b.status === "paused").length} paused
        </span>
      </section>
    </div>
  );
}

function ListingCard({
  listing,
  contact,
}: {
  listing: Listing;
  contact: Contact | undefined;
}) {
  const nextStatuses = nextListingStatuses(listing.status as ListingStatus);
  const price = listing.current_price ?? listing.list_price;
  const priceDropped =
    listing.original_price != null &&
    listing.current_price != null &&
    Number(listing.current_price) < Number(listing.original_price);

  return (
    <div className="bg-background border border-border p-3 space-y-2">
      <Link href={`/pipeline/listings/${listing.id}`} className="block">
        <div className="text-sm font-medium leading-tight hover:underline">
          {listing.address}
        </div>
        <div className="text-xs text-muted mt-0.5">
          {[listing.city, listing.state].filter(Boolean).join(", ")}
        </div>
      </Link>
      <div className="flex items-center justify-between text-xs">
        <span className="font-display text-sm">
          {price != null ? formatCurrency(Number(price)) : "—"}
        </span>
        {priceDropped && <Badge tone="overdue">Price drop</Badge>}
      </div>
      {contact && (
        <div className="text-xs text-muted">
          <Link href={`/contacts/${contact.id}`} className="hover:underline">
            {contact.display_name}
          </Link>
        </div>
      )}
      {listing.next_action && (
        <div className="text-xs text-muted border-t border-border pt-2">
          <span className="eyebrow block mb-0.5">Next</span>
          {listing.next_action}
          {listing.next_action_date && (
            <span className="text-soft"> · {formatDate(listing.next_action_date)}</span>
          )}
        </div>
      )}
      {nextStatuses.length > 0 && (
        <form
          action={moveListingStatusAction.bind(null, listing.id)}
          className="flex items-center gap-1 flex-wrap"
        >
          {nextStatuses.map((s) => (
            <button
              key={s}
              type="submit"
              name="status"
              value={s}
              className="text-[11px] uppercase tracking-wider text-muted hover:text-foreground border border-border px-2 py-0.5"
              title={`Move to ${LISTING_STATUS_LABELS[s]}`}
            >
              → {LISTING_STATUS_LABELS[s]}
            </button>
          ))}
        </form>
      )}
    </div>
  );
}

function BuyerCard({
  buyer,
  contact,
}: {
  buyer: BuyerEngagement;
  contact: Contact | undefined;
}) {
  const nextStatuses = nextBuyerStatuses(buyer.status as BuyerStatus);
  const budget =
    buyer.budget_max != null
      ? `up to ${formatCurrency(Number(buyer.budget_max))}`
      : buyer.preapproval_amount != null
        ? `preapproved ${formatCurrency(Number(buyer.preapproval_amount))}`
        : null;

  return (
    <div className="bg-background border border-border p-3 space-y-2">
      <Link href={`/pipeline/buyers/${buyer.id}`} className="block">
        <div className="text-sm font-medium hover:underline">
          {contact?.display_name ?? "Buyer"}
        </div>
        {budget && <div className="text-xs text-muted mt-0.5">{budget}</div>}
      </Link>
      {buyer.target_neighborhoods && (
        <div className="text-xs text-muted">
          {buyer.target_neighborhoods}
        </div>
      )}
      {buyer.under_contract_address && (
        <div className="text-xs text-muted">
          <span className="eyebrow block mb-0.5">Under contract on</span>
          {buyer.under_contract_address}
          {buyer.under_contract_price != null && (
            <span className="text-soft"> · {formatCurrency(Number(buyer.under_contract_price))}</span>
          )}
        </div>
      )}
      {buyer.next_action && (
        <div className="text-xs text-muted border-t border-border pt-2">
          <span className="eyebrow block mb-0.5">Next</span>
          {buyer.next_action}
          {buyer.next_action_date && (
            <span className="text-soft"> · {formatDate(buyer.next_action_date)}</span>
          )}
        </div>
      )}
      {nextStatuses.length > 0 && (
        <form
          action={moveBuyerStatusAction.bind(null, buyer.id)}
          className="flex items-center gap-1 flex-wrap"
        >
          {nextStatuses.map((s) => (
            <button
              key={s}
              type="submit"
              name="status"
              value={s}
              className="text-[11px] uppercase tracking-wider text-muted hover:text-foreground border border-border px-2 py-0.5"
              title={`Move to ${BUYER_STATUS_LABELS[s]}`}
            >
              → {BUYER_STATUS_LABELS[s]}
            </button>
          ))}
        </form>
      )}
    </div>
  );
}

function nextListingStatuses(current: ListingStatus): ListingStatus[] {
  switch (current) {
    case "coming_soon": return ["active"];
    case "active": return ["under_contract", "withdrawn"];
    case "under_contract": return ["pending", "active"];
    case "pending": return ["sold", "active"];
    default: return [];
  }
}

function nextBuyerStatuses(current: BuyerStatus): BuyerStatus[] {
  switch (current) {
    case "prospecting": return ["touring", "paused"];
    case "touring": return ["writing_offers", "paused"];
    case "writing_offers": return ["under_contract", "touring"];
    case "under_contract": return ["pending", "touring"];
    case "pending": return ["closed", "touring"];
    default: return [];
  }
}
