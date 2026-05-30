import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, LinkButton, Card, Badge, EmptyState } from "@/components/ui";
import { formatCurrency, formatDate, formatRole } from "@/lib/format";
import type { Transaction } from "@/lib/types";

export const dynamic = "force-dynamic";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </Card>
  );
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("transactions")
    .select("*")
    .order("closed_date", { ascending: false });
  const all = (data ?? []) as Transaction[];

  const years = [
    ...new Set(all.map((t) => t.closed_date?.slice(0, 4)).filter(Boolean)),
  ].sort().reverse() as string[];
  const year = sp.year || years[0] || "";
  const rows = year ? all.filter((t) => t.closed_date?.startsWith(year)) : all;

  const sum = (f: (t: Transaction) => number | null) =>
    rows.reduce((acc, t) => acc + (f(t) || 0), 0);
  const volume = sum((t) => t.sold_price);
  const gci = sum((t) => t.gci);
  const net = sum((t) => t.agent_share);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Deals"
        subtitle={`${rows.length} closed ${year ? `in ${year}` : "total"}`}
        actions={
          <LinkButton href="/transactions/new">
            <Plus size={14} /> New deal
          </LinkButton>
        }
      />

      {years.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {years.map((y) => (
            <Link
              key={y}
              href={`/transactions?year=${y}`}
              className={`px-3 py-1 rounded-full text-sm ${
                y === year
                  ? "bg-brand text-white"
                  : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
              }`}
            >
              {y}
            </Link>
          ))}
          <Link
            href="/transactions?year="
            className={`px-3 py-1 rounded-full text-sm ${
              !year ? "bg-brand text-white" : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
            }`}
          >
            All
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Deals" value={String(rows.length)} />
        <Stat label="Sales volume" value={formatCurrency(volume)} />
        <Stat label="GCI" value={formatCurrency(gci)} />
        <Stat label="Agent net" value={formatCurrency(net)} />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No deals yet"
          description="Add a closed deal to start tracking commissions."
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="p-3 font-medium">Closed</th>
                <th className="p-3 font-medium">Client / Address</th>
                <th className="p-3 font-medium">Type</th>
                <th className="p-3 font-medium text-right">Price</th>
                <th className="p-3 font-medium text-right">GCI</th>
                <th className="p-3 font-medium text-right">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
              {rows.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="p-3 whitespace-nowrap text-slate-500 dark:text-slate-400">
                    {formatDate(t.closed_date)}
                  </td>
                  <td className="p-3">
                    <Link href={`/transactions/${t.id}`} className="font-medium hover:underline">
                      {t.client_name}
                    </Link>
                    {t.address && (
                      <div className="text-xs text-slate-400">{t.address}</div>
                    )}
                  </td>
                  <td className="p-3">
                    {t.deal_type && <Badge tone={t.deal_type}>{formatRole(t.deal_type)}</Badge>}
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">{formatCurrency(t.sold_price)}</td>
                  <td className="p-3 text-right whitespace-nowrap">{formatCurrency(t.gci)}</td>
                  <td className="p-3 text-right whitespace-nowrap font-medium">{formatCurrency(t.agent_share)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
