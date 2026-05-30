import { Card, Field, Input, Select, Textarea } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import type { Contact } from "@/lib/types";

export default function ContactForm({
  action,
  contact,
  submitLabel = "Save",
}: {
  action: (formData: FormData) => void | Promise<void>;
  contact?: Partial<Contact>;
  submitLabel?: string;
}) {
  const c = contact ?? {};
  return (
    <Card className="p-5">
      <form action={action} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="First name">
          <Input name="first_name" defaultValue={c.first_name ?? ""} />
        </Field>
        <Field label="Last name">
          <Input name="last_name" defaultValue={c.last_name ?? ""} />
        </Field>
        <Field label="Display name" hint="How they appear in lists (e.g. “Joe & Darci Keller”).">
          <Input name="display_name" defaultValue={c.display_name ?? ""} required />
        </Field>
        <Field label="Role">
          <Select name="role" defaultValue={c.role ?? ""}>
            <option value="">—</option>
            <option value="buyer">Buyer</option>
            <option value="seller">Seller</option>
            <option value="both">Buyer &amp; Seller</option>
          </Select>
        </Field>
        <Field label="Emails" hint="Comma-separated for multiple.">
          <Input name="emails" defaultValue={(c.emails ?? []).join(", ")} />
        </Field>
        <Field label="Phones" hint="Comma-separated for multiple.">
          <Input name="phones" defaultValue={(c.phones ?? []).join(", ")} />
        </Field>
        <Field label="Street">
          <Input name="street" defaultValue={c.street ?? ""} />
        </Field>
        <Field label="City">
          <Input name="city" defaultValue={c.city ?? ""} />
        </Field>
        <Field label="State">
          <Input name="state" defaultValue={c.state ?? ""} />
        </Field>
        <Field label="ZIP">
          <Input name="zip" defaultValue={c.zip ?? ""} />
        </Field>
        <Field label="Birthday">
          <Input type="date" name="birthday" defaultValue={c.birthday ?? ""} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notes">
            <Textarea name="notes" rows={3} defaultValue={c.notes ?? ""} />
          </Field>
        </div>
        <div className="sm:col-span-2 flex justify-end">
          <SubmitButton>{submitLabel}</SubmitButton>
        </div>
      </form>
    </Card>
  );
}
