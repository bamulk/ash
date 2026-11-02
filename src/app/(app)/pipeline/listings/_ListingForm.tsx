import { Card, Field, Input, Select } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import {
  LISTING_STATUS_LABELS,
  type Contact,
  type Listing,
} from "@/lib/types";

/**
 * Shared layout for create + edit listing. The caller passes the server
 * action; this component just lays out the fields.
 */
export default function ListingForm({
  action,
  listing,
  contacts,
  submitLabel = "Save",
}: {
  action: (formData: FormData) => void | Promise<void>;
  listing?: Listing;
  contacts: Pick<Contact, "id" | "display_name" | "role">[];
  submitLabel?: string;
}) {
  const sellers = contacts.filter(
    (c) => c.role === "seller" || c.role === "both" || c.role === null
  );

  return (
    <form action={action} className="space-y-6">
      <Card className="p-5 space-y-4">
        <h2 className="font-display text-lg">Property</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <AddressAutocomplete
            streetName="address"
            streetLabel="Address"
            defaultStreet={listing?.address ?? ""}
            defaultCity={listing?.city ?? ""}
            defaultState={listing?.state ?? ""}
            defaultZip={listing?.zip ?? ""}
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label="MLS #">
            <Input name="mls_number" defaultValue={listing?.mls_number ?? ""} />
          </Field>
          <Field label="Bedrooms">
            <Input name="bedrooms" inputMode="decimal" defaultValue={listing?.bedrooms?.toString() ?? ""} />
          </Field>
          <Field label="Bathrooms">
            <Input name="bathrooms" inputMode="decimal" defaultValue={listing?.bathrooms?.toString() ?? ""} />
          </Field>
          <Field label="Sqft">
            <Input name="sqft" inputMode="numeric" defaultValue={listing?.sqft?.toString() ?? ""} />
          </Field>
        </div>
        <Field label="Lot size (optional)" hint="e.g. 6,500 sqft or 0.15 acres">
          <Input name="lot_size" defaultValue={listing?.lot_size ?? ""} />
        </Field>
      </Card>

      <Card className="p-5 space-y-4">
        <h2 className="font-display text-lg">Listing + status</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Seller">
            <Select name="contact_id" defaultValue={listing?.contact_id ?? ""}>
              <option value="">— unassigned —</option>
              {sellers.map((c) => (
                <option key={c.id} value={c.id}>{c.display_name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select name="status" defaultValue={listing?.status ?? "coming_soon"}>
              {Object.entries(LISTING_STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="List date">
            <Input type="date" name="list_date" defaultValue={listing?.list_date ?? ""} />
          </Field>
          <Field label="List price">
            <Input name="list_price" inputMode="decimal" defaultValue={listing?.list_price?.toString() ?? ""} placeholder="650000" />
          </Field>
          <Field label="Current price" hint="Falls back to list price on save.">
            <Input name="current_price" inputMode="decimal" defaultValue={listing?.current_price?.toString() ?? ""} />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Original price" hint="For price-drop math.">
            <Input name="original_price" inputMode="decimal" defaultValue={listing?.original_price?.toString() ?? ""} />
          </Field>
          <Field label="Contract date">
            <Input type="date" name="contract_date" defaultValue={listing?.contract_date ?? ""} />
          </Field>
          <Field label="Est. close date">
            <Input type="date" name="est_close_date" defaultValue={listing?.est_close_date ?? ""} />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Sold date">
            <Input type="date" name="sold_date" defaultValue={listing?.sold_date ?? ""} />
          </Field>
          <Field label="Sold price">
            <Input name="sold_price" inputMode="decimal" defaultValue={listing?.sold_price?.toString() ?? ""} />
          </Field>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <h2 className="font-display text-lg">Next action</h2>
        <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-3">
          <Field label="Next action">
            <Input name="next_action" defaultValue={listing?.next_action ?? ""} placeholder="Price-drop conversation with seller" />
          </Field>
          <Field label="Next action date">
            <Input type="date" name="next_action_date" defaultValue={listing?.next_action_date ?? ""} />
          </Field>
        </div>
        {/* Notes live in their own panel above the form (NotesPanel). */}
        <input type="hidden" name="notes" value={listing?.notes ?? ""} />
      </Card>

      <div className="flex justify-end">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
