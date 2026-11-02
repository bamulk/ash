import Link from "next/link";
import {
  Users,
  DollarSign,
  Home as HomeIcon,
  KanbanSquare,
  TrendingDown,
  TrendingUp,
  Percent,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, LinkButton } from "@/components/ui";
import { formatCurrency, formatCurrencyShort, formatDate } from "@/lib/format";
import type { Contact, Transaction } from "@/lib/types";
import { getPmmsRates } from "@/lib/freddie-pmms";

export const dynamic = "force-dynamic";

function RateBlock({
  label,
  curr,
  prev,
}: {
  label: string;
  curr: { rate: number } | null;
  prev: { rate: number } | null;
}) {
  const delta = curr && prev ? curr.rate - prev.rate : null;
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className="font-display text-2xl mt-1 flex items-baseline gap-2">
        {curr ? `${curr.rate.toFixed(2)}%` : "—"}
        {delta != null && Math.abs(delta) > 0.0001 && (
          <span
            className={`inline-flex items-center text-xs font-medium ${
              delta > 0 ? "text-brand" : "text-accent"
            }`}
          >
            {delta > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(delta).toFixed(2)}
          </span>
        )}
      </div>
    </div>
  );
}

function StatCard({
  href,
  label,
  value,
  sub,
  icon: Icon,
}: {
  href: string;
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <Link href={href} className="block">
      <Card className="p-5 hover:bg-sand transition-colors h-full">
        <div className="flex items-center justify-between">
          <span className="eyebrow">{label}</span>
          <Icon size={14} className="text-brand" />
        </div>
        <div className="font-display text-2xl sm:text-3xl mt-3 tabular-nums leading-tight">
          {value}
        </div>
        {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
      </Card>
    </Link>
  );
}

type PipelineRow = {
  key: string;
  href: string;
  title: string;
  nextAction: string;
  nextActionDate: string;
  tag: "listing" | "buyer";
};

function NextActionRow({ row }: { row: PipelineRow }) {
  return (
    <Link
      href={row.href}
      className="group flex items-start justify-between gap-4 py-3 border-b border-border last:border-b-0 hover:bg-sand -mx-5 px-5"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="eyebrow">
            {row.tag === "listing" ? "Listing" : "Buyer"}
          </span>
          <span className="text-sm font-medium truncate">{row.title}</span>
        </div>
        <div className="text-sm text-muted mt-0.5">{row.nextAction}</div>
      </div>
      <div className="text-xs text-muted whitespace-nowrap pt-0.5">
        {formatDate(row.nextActionDate)}
      </div>
    </Link>
  );
}

export default async function Dashboard() {
  const supabase = await createClient();
  const now = new Date();
  const year = now.getFullYear();
  const today = now.toISOString().slice(0, 10);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user?.id
    ? await supabase.from("profiles").select("full_name").eq("id", user.id).single()
    : { data: null };
  const firstName = (profile?.full_name || "").split(" ")[0] || "there";

  const [
    { data: contacts },
    { data: txns },
    { data: listingRows },
    { data: buyerRows },
    rates,
  ] = await Promise.all([
    supabase.from("contacts").select("id, display_name, role"),
    supabase.from("transactions").select("*"),
    supabase
      .from("listings")
      .select("id, address, status, next_action, next_action_date, current_price, list_price")
      .in("status", ["coming_soon", "active", "under_contract", "pending"]),
    supabase
      .from("buyer_engagements")
      .select("id, contact_id, status, next_action, next_action_date, budget_max, preapproval_amount")
      .in("status", [
        "prospecting",
        "touring",
        "writing_offers",
        "under_contract",
        "pending",
      ]),
    getPmmsRates(),
  ]);

  const allContacts = (contacts ?? []) as Pick<Contact, "id" | "display_name" | "role">[];
  const buyerContactIds = new Set((buyerRows ?? []).map((b) => b.contact_id));
  const buyerContactNames = new Map(
    allContacts
      .filter((c) => buyerContactIds.has(c.id))
      .map((c) => [c.id, c.display_name])
  );

  const buyers = allContacts.filter((c) => c.role === "buyer" || c.role === "both").length;
  const sellers = allContacts.filter((c) => c.role === "seller" || c.role === "both").length;

  const allTxns = (txns ?? []) as Transaction[];
  const ytd = allTxns.filter((t) => t.closed_date?.startsWith(String(year)));
  const ytdVolume = ytd.reduce((a, t) => a + (t.sold_price || 0), 0);
  const ytdGci = ytd.reduce((a, t) => a + (t.gci || 0), 0);

  const activeListings = listingRows ?? [];
  const activeBuyers = buyerRows ?? [];
  const listingsOnMarket = activeListings
    .filter((l) => l.status === "coming_soon" || l.status === "active")
    .reduce((s, l) => s + Number(l.current_price ?? l.list_price ?? 0), 0);

  // Everything with a scheduled next action — sorted earliest first,
  // keep the first dozen so overdue items don't push today's work off.
  const nextActions: PipelineRow[] = [
    ...activeListings
      .filter((l) => l.next_action && l.next_action_date)
      .map(
        (l): PipelineRow => ({
          key: `l:${l.id}`,
          href: `/pipeline/listings/${l.id}`,
          title: l.address,
          nextAction: l.next_action as string,
          nextActionDate: l.next_action_date as string,
          tag: "listing",
        })
      ),
    ...activeBuyers
      .filter((b) => b.next_action && b.next_action_date)
      .map(
        (b): PipelineRow => ({
          key: `b:${b.id}`,
          href: `/pipeline/buyers/${b.id}`,
          title: buyerContactNames.get(b.contact_id) ?? "Buyer",
          nextAction: b.next_action as string,
          nextActionDate: b.next_action_date as string,
          tag: "buyer",
        })
      ),
  ]
    .sort((a, b) => a.nextActionDate.localeCompare(b.nextActionDate))
    .slice(0, 12);

  const overdueActions = nextActions.filter((n) => n.nextActionDate < today);
  const todayActions = nextActions.filter((n) => n.nextActionDate === today);
  const upcomingActions = nextActions.filter((n) => n.nextActionDate > today).slice(0, 6);

  return (
    <div className="space-y-10">
      {/* Welcome */}
      <div className="flex items-start sm:items-end justify-between gap-6 flex-col sm:flex-row">
        <h1 className="font-display text-4xl sm:text-5xl text-foreground leading-none">
          Hi, {firstName}
        </h1>
        <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2 w-full sm:w-auto">
          <LinkButton href="/pipeline/listings/new" variant="secondary">
            <HomeIcon size={14} /> Add listing
          </LinkButton>
          <LinkButton href="/contacts/new" variant="secondary">
            <Users size={14} /> Add client
          </LinkButton>
        </div>
      </div>

      {/* The four numbers that tell her where things stand. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          href="/pipeline"
          label="Active work"
          value={`${activeListings.length} · ${activeBuyers.length}`}
          sub={
            listingsOnMarket > 0
              ? `${activeListings.length} listings · ${activeBuyers.length} buyers · ${formatCurrencyShort(listingsOnMarket)} on market`
              : `${activeListings.length} listings · ${activeBuyers.length} buyers`
          }
          icon={KanbanSquare}
        />
        <StatCard
          href="/contacts"
          label="Clients"
          value={String(allContacts.length)}
          sub={`${buyers} buyers · ${sellers} sellers`}
          icon={Users}
        />
        <StatCard
          href="/transactions"
          label={`${year} volume`}
          value={formatCurrencyShort(ytdVolume)}
          sub={`${ytd.length} ${ytd.length === 1 ? "deal" : "deals"} closed`}
          icon={DollarSign}
        />
        <StatCard
          href="/transactions"
          label={`${year} GCI`}
          value={formatCurrencyShort(ytdGci)}
          icon={HomeIcon}
        />
      </div>

      {/* Working on — the one list that keeps her moving. */}
      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="font-display text-2xl text-foreground">Working on</h2>
            <p className="text-sm text-muted mt-1">
              Pipeline items with a next action scheduled.
            </p>
          </div>
          <Link href="/pipeline" className="text-sm text-muted hover:text-foreground whitespace-nowrap">
            All in pipeline →
          </Link>
        </div>

        {nextActions.length === 0 ? (
          <Card className="p-10 text-center">
            <p className="text-sm text-muted">
              Nothing scheduled.{" "}
              <Link href="/pipeline" className="text-brand underline">
                Open the pipeline
              </Link>{" "}
              to set a next action on a listing or buyer.
            </p>
          </Card>
        ) : (
          <Card className="p-5 space-y-6">
            {overdueActions.length > 0 && (
              <div>
                <div className="eyebrow text-brand mb-1">Overdue</div>
                {overdueActions.map((r) => (
                  <NextActionRow key={r.key} row={r} />
                ))}
              </div>
            )}
            {todayActions.length > 0 && (
              <div>
                <div className="eyebrow mb-1">Today</div>
                {todayActions.map((r) => (
                  <NextActionRow key={r.key} row={r} />
                ))}
              </div>
            )}
            {upcomingActions.length > 0 && (
              <div>
                <div className="eyebrow mb-1">Coming up</div>
                {upcomingActions.map((r) => (
                  <NextActionRow key={r.key} row={r} />
                ))}
              </div>
            )}
          </Card>
        )}
      </section>

      {/* Rates — handy for client calls. */}
      {(rates.thirty || rates.fifteen) && (
        <section className="space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="font-display text-2xl text-foreground">Rates this week</h2>
              <p className="text-sm text-muted mt-1 inline-flex items-center gap-1.5">
                <Percent size={12} /> Freddie Mac PMMS
                {rates.thirty?.date ? ` · week of ${formatDate(rates.thirty.date)}` : ""}
              </p>
            </div>
          </div>
          <Card className="p-5">
            <div className="grid grid-cols-2 gap-6">
              <RateBlock label="30-yr fixed" curr={rates.thirty} prev={rates.thirtyPrev} />
              <RateBlock label="15-yr fixed" curr={rates.fifteen} prev={rates.fifteenPrev} />
            </div>
          </Card>
        </section>
      )}
    </div>
  );
}
