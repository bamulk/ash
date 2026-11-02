import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import ListingForm from "../_ListingForm";
import { createListingAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function NewListingPage() {
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
      <PageHeader title="Add listing" subtitle="A property Ashley is actively representing." />
      <ListingForm action={createListingAction} contacts={contacts ?? []} submitLabel="Create listing" />
    </div>
  );
}
