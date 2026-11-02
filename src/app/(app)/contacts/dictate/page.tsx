import Link from "next/link";
import { PageHeader, Card } from "@/components/ui";
import DictationComposer from "@/components/DictationComposer";
import { parseAndCreateContactAction } from "../actions";

export const dynamic = "force-dynamic";

/**
 * Hands the dictation off to Claude via the Anthropic Messages API,
 * saves the resulting Contact (and, when the dictation names a buyer
 * budget or neighborhood, a BuyerEngagement too), then opens the new
 * contact's page.
 *
 * Scoped to the field use case: capturing a lead while walking back
 * from a showing. The composer uses the browser's native speech
 * recognition where it's available, and falls back to the keyboard's
 * mic (iOS, Android) otherwise.
 */
export default function DictateContactPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link href="/contacts" className="text-sm text-muted hover:text-foreground">
          ← Contacts
        </Link>
      </div>

      <PageHeader
        title="Dictate a contact"
        subtitle="Tap the mic and talk. The full transcript is saved on the contact for reference."
      />

      <Card className="p-6">
        <DictationComposer action={parseAndCreateContactAction} />
      </Card>
    </div>
  );
}
