import { Card, Field, Input, Select } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import type { Segment, Tag } from "@/lib/types";

export default function SegmentForm({
  action,
  segment,
  tags,
  submitLabel = "Save segment",
}: {
  action: (formData: FormData) => void | Promise<void>;
  segment?: Partial<Segment>;
  tags: Tag[];
  submitLabel?: string;
}) {
  const s = segment ?? {};
  const c = s.criteria ?? {};
  return (
    <Card className="p-5">
      <form action={action} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Segment name">
            <Input name="name" defaultValue={s.name ?? ""} required placeholder="e.g. Past sellers in Sacramento" />
          </Field>
          <Field label="Description">
            <Input name="description" defaultValue={s.description ?? ""} />
          </Field>
        </div>

        <div className="text-xs font-medium text-slate-500 dark:text-slate-400 pt-2">Filters</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Role">
            <Select name="role" defaultValue={c.role ?? ""}>
              <option value="">Any</option>
              <option value="buyer">Buyer</option>
              <option value="seller">Seller</option>
              <option value="both">Buyer &amp; Seller</option>
            </Select>
          </Field>
          <Field label="City">
            <Input name="city" defaultValue={c.city ?? ""} placeholder="Any" />
          </Field>
          <Field label="State">
            <Input name="state" defaultValue={c.state ?? ""} placeholder="Any" />
          </Field>
          <Field label="ZIP starts with">
            <Input name="zip" defaultValue={c.zip ?? ""} placeholder="Any" />
          </Field>
          <Field label="Tag">
            <Select name="tag_id" defaultValue={c.tag_id ?? ""}>
              <option value="">Any</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Name/email contains">
            <Input name="search" defaultValue={c.search ?? ""} placeholder="Any" />
          </Field>
        </div>
        <div className="flex gap-6 text-sm">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" name="has_email" defaultChecked={!!c.has_email} /> Has email
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" name="has_phone" defaultChecked={!!c.has_phone} /> Has phone
          </label>
        </div>
        <div className="flex justify-end">
          <SubmitButton>{submitLabel}</SubmitButton>
        </div>
      </form>
    </Card>
  );
}
