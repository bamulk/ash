import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import BuyerForm from "../_BuyerForm";
import { createBuyerAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function NewBuyerPage() {
  const supabase = await createClient();
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, display_name, role")
    .order("display_name");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/pipeline" className="text-sm text-muted hover:text-foreground">
          ← Pipeline
        </Link>
      </div>
      <PageHeader
        title="Add buyer engagement"
        subtitle="Someone Ashley is actively helping buy a home."
      />
      <BuyerForm action={createBuyerAction} contacts={contacts ?? []} submitLabel="Create engagement" />
    </div>
  );
}
