"use client";

import { useState } from "react";
import { Card, Field, Input, Select, Textarea } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import AddressLineInput from "@/components/AddressLineInput";
import type { Transaction } from "@/lib/types";

export default function TransactionForm({
  action,
  deal,
  contacts,
  submitLabel = "Save",
}: {
  action: (formData: FormData) => void | Promise<void>;
  deal?: Partial<Transaction>;
  contacts: { id: string; display_name: string }[];
  submitLabel?: string;
}) {
  const d = deal ?? {};
  const [price, setPrice] = useState(d.sold_price?.toString() ?? "");
  const [pct, setPct] = useState(d.commission_pct?.toString() ?? "");
  const [gci, setGci] = useState(d.gci?.toString() ?? "");

  // Auto-fill GCI from price × commission% unless the user has typed one.
  function recalc(nextPrice: string, nextPct: string) {
    const p = parseFloat(nextPrice.replace(/[$,]/g, ""));
    const c = parseFloat(nextPct);
    if (!Number.isNaN(p) && !Number.isNaN(c)) {
      setGci(((p * c) / 100).toFixed(2));
    }
  }

  return (
    <Card className="p-5">
      <form action={action} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Client name">
          <Input name="client_name" defaultValue={d.client_name ?? ""} required />
        </Field>
        <Field label="Linked contact" hint="Optional — connects this deal to a contact record.">
          <Select name="contact_id" defaultValue={d.contact_id ?? ""}>
            <option value="">— Not linked —</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.display_name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Property address">
            <AddressLineInput name="address" defaultValue={d.address ?? ""} />
          </Field>
        </div>
        <Field label="Date closed">
          <Input type="date" name="closed_date" defaultValue={d.closed_date ?? ""} />
        </Field>
        <Field label="Deal type">
          <Select name="deal_type" defaultValue={d.deal_type ?? ""}>
            <option value="">—</option>
            <option value="buyer">Buyer side</option>
            <option value="seller">Seller side</option>
          </Select>
        </Field>
        <Field label="Source of business">
          <Input name="source_of_business" defaultValue={d.source_of_business ?? ""} placeholder="SOI, Previous Client, Referral…" />
        </Field>
        <Field label="Sold price">
          <Input
            name="sold_price"
            inputMode="decimal"
            value={price}
            onChange={(e) => {
              setPrice(e.target.value);
              recalc(e.target.value, pct);
            }}
          />
        </Field>
        <Field label="Commission %">
          <Input
            name="commission_pct"
            inputMode="decimal"
            value={pct}
            onChange={(e) => {
              setPct(e.target.value);
              recalc(price, e.target.value);
            }}
          />
        </Field>
        <Field label="GCI" hint="Auto-filled from price × %; editable.">
          <Input name="gci" inputMode="decimal" value={gci} onChange={(e) => setGci(e.target.value)} />
        </Field>
        <Field label="Broker share">
          <Input name="broker_share" inputMode="decimal" defaultValue={d.broker_share?.toString() ?? ""} />
        </Field>
        <Field label="Admin fee">
          <Input name="admin_fee" inputMode="decimal" defaultValue={d.admin_fee?.toString() ?? ""} />
        </Field>
        <Field label="Agent share (net)">
          <Input name="agent_share" inputMode="decimal" defaultValue={d.agent_share?.toString() ?? ""} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notes">
            <Textarea name="notes" rows={2} defaultValue={d.notes ?? ""} />
          </Field>
        </div>
        <div className="sm:col-span-2 flex justify-end">
          <SubmitButton>{submitLabel}</SubmitButton>
        </div>
      </form>
    </Card>
  );
}
