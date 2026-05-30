import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui";
import DeleteButton from "@/components/DeleteButton";
import TransactionForm from "@/components/TransactionForm";
import { formatCurrency, formatDate, formatRole } from "@/lib/format";
import type { Transaction } from "@/lib/types";
import { updateTransactionAction, deleteTransactionAction } from "../actions";

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 text-sm border-b border-slate-50 dark:border-slate-800/60 last:border-0">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: deal }, { data: contacts }] = await Promise.all([
    supabase.from("transactions").select("*").eq("id", id).single(),
    supabase.from("contacts").select("id, display_name").order("display_name"),
  ]);
  if (!deal) notFound();
  const t = deal as Transaction;

  const updateAction = updateTransactionAction.bind(null, id);
  const deleteAction = deleteTransactionAction.bind(null, id);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/transactions" className="text-sm text-slate-600 dark:text-slate-400 hover:underline">
          ← All deals
        </Link>
      </div>

      <PageHeader
        title={t.client_name}
        subtitle={t.address || undefined}
        actions={
          <DeleteButton
            action={deleteAction}
            label="Delete deal"
            confirmText={`Delete the ${t.client_name} deal? This cannot be undone.`}
          />
        }
      />

      <Card className="p-5 max-w-md">
        <h2 className="text-sm font-medium mb-2">Commission breakdown</h2>
        <Row label="Closed" value={formatDate(t.closed_date)} />
        <Row label="Type" value={t.deal_type ? formatRole(t.deal_type) : "—"} />
        <Row label="Source" value={t.source_of_business || "—"} />
        <Row label="Sold price" value={formatCurrency(t.sold_price)} />
        <Row label="Commission %" value={t.commission_pct != null ? `${t.commission_pct}%` : "—"} />
        <Row label="GCI" value={formatCurrency(t.gci)} />
        <Row label="Broker share" value={formatCurrency(t.broker_share)} />
        <Row label="Admin fee" value={formatCurrency(t.admin_fee)} />
        <Row label="Agent net" value={formatCurrency(t.agent_share)} />
        {t.contact_id && (
          <div className="mt-3 text-sm">
            <Link href={`/contacts/${t.contact_id}`} className="text-brand hover:underline">
              View linked contact →
            </Link>
          </div>
        )}
      </Card>

      <div>
        <h2 className="text-sm font-medium mb-3 text-slate-700 dark:text-slate-300">Edit deal</h2>
        <TransactionForm
          action={updateAction}
          deal={t}
          contacts={contacts ?? []}
          submitLabel="Save changes"
        />
      </div>
    </div>
  );
}
