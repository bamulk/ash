import Link from "next/link";
import { Users, DollarSign, Bell, Cake, Home as HomeIcon, ArrowRight, TrendingDown, TrendingUp, Percent } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, Badge, LinkButton } from "@/components/ui";
import { formatCurrency, formatDate, todayISO } from "@/lib/format";
import type { Contact, Transaction, Reminder } from "@/lib/types";
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
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className="text-xl font-semibold mt-0.5 flex items-baseline gap-2">
        {curr ? `${curr.rate.toFixed(2)}%` : "—"}
        {delta != null && Math.abs(delta) > 0.0001 && (
          <span
            className={`inline-flex items-center text-xs font-medium ${
              delta > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
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
    <Link href={href}>
      <Card className="p-4 hover:border-brand/40 transition-colors h-full">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
          <Icon size={16} className="text-brand" />
        </div>
        <div className="text-2xl font-semibold mt-2">{value}</div>
        {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
      </Card>
    </Link>
  );
}

export default async function Dashboard() {
  const supabase = await createClient();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  const today = todayISO();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("full_name").eq("id", user.id).single()
    : { data: null };
  const firstName = (profile?.full_name || "there").split(" ")[0];

  const [{ data: contacts }, { data: txns }, { data: reminders }, rates] = await Promise.all([
    supabase.from("contacts").select("id, display_name, role, birthday"),
    supabase.from("transactions").select("*"),
    supabase
      .from("reminders")
      .select("*, contacts(display_name)")
      .eq("is_done", false)
      .order("due_date"),
    getPmmsRates(),
  ]);

  const allContacts = (contacts ?? []) as Pick<Contact, "id" | "display_name" | "role" | "birthday">[];
  const buyers = allContacts.filter((c) => c.role === "buyer" || c.role === "both").length;
  const sellers = allContacts.filter((c) => c.role === "seller" || c.role === "both").length;

  const allTxns = (txns ?? []) as Transaction[];
  const ytd = allTxns.filter((t) => t.closed_date?.startsWith(String(year)));
  const ytdVolume = ytd.reduce((a, t) => a + (t.sold_price || 0), 0);
  const ytdGci = ytd.reduce((a, t) => a + (t.gci || 0), 0);

  const openRems = (reminders ?? []) as (Reminder & { contacts: { display_name: string } | null })[];
  const overdue = openRems.filter((r) => r.due_date < today);
  const dueSoon = openRems.filter((r) => r.due_date >= today).slice(0, 6);

  // Home-purchase anniversaries this month (from closed deals).
  const anniversaries = allTxns
    .filter((t) => t.closed_date && Number(t.closed_date.slice(5, 7)) === month)
    .map((t) => ({
      name: t.client_name,
      contactId: t.contact_id,
      date: t.closed_date!,
      years: year - Number(t.closed_date!.slice(0, 4)),
    }))
    .filter((a) => a.years >= 1)
    .sort((a, b) => a.date.slice(8, 10).localeCompare(b.date.slice(8, 10)));

  // Birthdays this month.
  const birthdays = allContacts
    .filter((c) => c.birthday && Number(c.birthday.slice(5, 7)) === month)
    .sort((a, b) => (a.birthday || "").slice(8, 10).localeCompare((b.birthday || "").slice(8, 10)));

  const monthName = now.toLocaleString("en-US", { month: "long" });

  return (
    <div className="space-y-8">
      <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {firstName}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Here&apos;s what&apos;s happening at Ashley Stone Homes.
          </p>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2 w-full sm:w-auto">
          <LinkButton href="/contacts/new" variant="secondary">
            <Users size={14} /> Add contact
          </LinkButton>
          <LinkButton href="/transactions/new" variant="secondary">
            <DollarSign size={14} /> Add deal
          </LinkButton>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard href="/contacts" label="Contacts" value={String(allContacts.length)} sub={`${buyers} buyers · ${sellers} sellers`} icon={Users} />
        <StatCard href="/transactions" label={`${year} volume`} value={formatCurrency(ytdVolume)} sub={`${ytd.length} deals closed`} icon={DollarSign} />
        <StatCard href="/transactions" label={`${year} GCI`} value={formatCurrency(ytdGci)} icon={HomeIcon} />
        <StatCard href="/reminders" label="Open reminders" value={String(openRems.length)} sub={`${overdue.length} overdue`} icon={Bell} />
      </div>

      {(rates.thirty || rates.fifteen) && (
        <Card className="p-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-sm font-medium flex items-center gap-2">
                <Percent size={14} className="text-brand" /> Mortgage rates this week
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Freddie Mac PMMS via FRED
                {rates.thirty?.date ? ` · week of ${formatDate(rates.thirty.date)}` : ""}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <RateBlock label="30-yr fixed" curr={rates.thirty} prev={rates.thirtyPrev} />
              <RateBlock label="15-yr fixed" curr={rates.fifteen} prev={rates.fifteenPrev} />
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Reminders */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium flex items-center gap-2">
              <Bell size={16} className="text-brand" /> Reminders
            </h2>
            <Link href="/reminders" className="text-xs text-brand hover:underline inline-flex items-center gap-1">
              All <ArrowRight size={12} />
            </Link>
          </div>
          {overdue.length === 0 && dueSoon.length === 0 ? (
            <p className="text-sm text-slate-400">Nothing due. You&apos;re all caught up.</p>
          ) : (
            <div className="space-y-2">
              {overdue.map((r) => (
                <div key={r.id} className="flex items-center justify-between text-sm">
                  <span>{r.title}</span>
                  <Badge tone="overdue">{formatDate(r.due_date)}</Badge>
                </div>
              ))}
              {dueSoon.map((r) => (
                <div key={r.id} className="flex items-center justify-between text-sm">
                  <span>{r.title}</span>
                  <span className="text-xs text-slate-400">{formatDate(r.due_date)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* This month */}
        <Card className="p-5">
          <h2 className="font-medium flex items-center gap-2 mb-3">
            <Cake size={16} className="text-brand" /> {monthName} milestones
          </h2>
          {anniversaries.length === 0 && birthdays.length === 0 ? (
            <p className="text-sm text-slate-400">No home anniversaries or birthdays this month.</p>
          ) : (
            <div className="space-y-3">
              {anniversaries.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Home anniversaries</div>
                  <div className="space-y-1">
                    {anniversaries.map((a, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        {a.contactId ? (
                          <Link href={`/contacts/${a.contactId}`} className="hover:underline">{a.name}</Link>
                        ) : (
                          <span>{a.name}</span>
                        )}
                        <span className="text-xs text-slate-400">
                          {a.years} yr{a.years === 1 ? "" : "s"} · {formatDate(a.date)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {birthdays.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Birthdays</div>
                  <div className="space-y-1">
                    {birthdays.map((c) => (
                      <div key={c.id} className="flex items-center justify-between text-sm">
                        <Link href={`/contacts/${c.id}`} className="hover:underline">{c.display_name}</Link>
                        <span className="text-xs text-slate-400">{formatDate(c.birthday)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

    </div>
  );
}
