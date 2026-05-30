import Link from "next/link";
import { PageHeader } from "@/components/ui";
import ContactForm from "@/components/ContactForm";
import { createContactAction } from "../actions";

export default function NewContactPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link href="/contacts" className="text-sm text-slate-600 dark:text-slate-400 hover:underline">
          ← All contacts
        </Link>
      </div>
      <PageHeader title="New contact" />
      <ContactForm action={createContactAction} submitLabel="Create contact" />
    </div>
  );
}
