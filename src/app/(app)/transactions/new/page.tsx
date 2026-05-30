import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import TransactionForm from "@/components/TransactionForm";
import { createTransactionAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewTransactionPage() {
  const supabase = await createClient();
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, display_name")
    .order("display_name");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/transactions" className="text-sm text-slate-600 dark:text-slate-400 hover:underline">
          ← All deals
        </Link>
      </div>
      <PageHeader title="New deal" />
      <TransactionForm
        action={createTransactionAction}
        contacts={contacts ?? []}
        submitLabel="Create deal"
      />
    </div>
  );
}
