import { Card, Field, Input, Select, Textarea } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import {
  BUYER_STATUS_LABELS,
  type BuyerEngagement,
  type Contact,
} from "@/lib/types";

export default function BuyerForm({
  action,
  buyer,
  contacts,
  submitLabel = "Save",
}: {
  action: (formData: FormData) => void | Promise<void>;
  buyer?: BuyerEngagement;
  contacts: Pick<Contact, "id" | "display_name" | "role">[];
  submitLabel?: string;
}) {
  const buyerCandidates = contacts.filter(
    (c) => c.role === "buyer" || c.role === "both" || c.role === null
  );

  return (
    <form action={action} className="space-y-6">
      <Card className="p-5 space-y-4">
        <h2 className="font-display text-lg">Buyer + status</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Buyer">
            <Select name="contact_id" required defaultValue={buyer?.contact_id ?? ""}>
              <option value="">— select a contact —</option>
              {buyerCandidates.map((c) => (
                <option key={c.id} value={c.id}>{c.display_name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select name="status" defaultValue={buyer?.status ?? "prospecting"}>
              {Object.entries(BUYER_STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <h2 className="font-display text-lg">Pre-approval + budget</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Pre-approved for">
            <Input name="preapproval_amount" inputMode="decimal" defaultValue={buyer?.preapproval_amount?.toString() ?? ""} placeholder="750000" />
          </Field>
          <Field label="Lender">
            <Input name="preapproval_lender" defaultValue={buyer?.preapproval_lender ?? ""} />
          </Field>
          <Field label="Pre-approval expires">
            <Input type="date" name="preapproval_expires" defaultValue={buyer?.preapproval_expires ?? ""} />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Budget min">
            <Input name="budget_min" inputMode="decimal" defaultValue={buyer?.budget_min?.toString() ?? ""} />
          </Field>
          <Field label="Budget max">
            <Input name="budget_max" inputMode="decimal" defaultValue={buyer?.budget_max?.toString() ?? ""} />
          </Field>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <h2 className="font-display text-lg">What they&rsquo;re looking for</h2>
        <Field label="Target neighborhoods" hint="Comma-separated or free-text.">
          <Input name="target_neighborhoods" defaultValue={buyer?.target_neighborhoods ?? ""} placeholder="East Sac, Land Park, Curtis Park" />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Property type">
            <Input name="property_type" defaultValue={buyer?.property_type ?? ""} placeholder="SFR, condo, …" />
          </Field>
          <Field label="Min beds">
            <Input name="min_beds" inputMode="decimal" defaultValue={buyer?.min_beds?.toString() ?? ""} />
          </Field>
          <Field label="Min baths">
            <Input name="min_baths" inputMode="decimal" defaultValue={buyer?.min_baths?.toString() ?? ""} />
          </Field>
        </div>
        <Field label="Must haves" hint="Anything specific — garage, pool, yard, office.">
          <Textarea name="must_haves" rows={3} defaultValue={buyer?.must_haves ?? ""} />
        </Field>
      </Card>

      <Card className="p-5 space-y-4">
        <h2 className="font-display text-lg">In escrow (if applicable)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr] gap-3">
          <Field label="Property under contract">
            <Input name="under_contract_address" defaultValue={buyer?.under_contract_address ?? ""} />
          </Field>
          <Field label="Contract price">
            <Input name="under_contract_price" inputMode="decimal" defaultValue={buyer?.under_contract_price?.toString() ?? ""} />
          </Field>
          <Field label="Est. close date">
            <Input type="date" name="est_close_date" defaultValue={buyer?.est_close_date ?? ""} />
          </Field>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <h2 className="font-display text-lg">Next action + notes</h2>
        <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-3">
          <Field label="Next action">
            <Input name="next_action" defaultValue={buyer?.next_action ?? ""} placeholder="Tour 1234 K Street Saturday" />
          </Field>
          <Field label="Next action date">
            <Input type="date" name="next_action_date" defaultValue={buyer?.next_action_date ?? ""} />
          </Field>
        </div>
        <Field label="Notes">
          <Textarea name="notes" rows={5} defaultValue={buyer?.notes ?? ""} />
        </Field>
      </Card>

      <div className="flex justify-end">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
