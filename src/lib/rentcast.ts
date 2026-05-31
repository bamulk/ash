/**
 * Thin wrapper around the RentCast AVM endpoint.
 * Docs: https://developers.rentcast.io/reference/avm-value-estimate
 *
 * Free tier: 50 calls/mo. The endpoint accepts an address-only query and
 * returns a price estimate, a low/high range, and a few comparable sales.
 *
 * Set RENTCAST_API_KEY in .env.local (and in Vercel) to enable this. When
 * unset, isRentCastConfigured() returns false and the UI hides the action.
 */
export type RentCastAvm = {
  estimate: number | null;
  rangeLow: number | null;
  rangeHigh: number | null;
  raw: unknown;
};

export function isRentCastConfigured(): boolean {
  return !!process.env.RENTCAST_API_KEY?.trim();
}

export async function fetchAvm(address: string): Promise<RentCastAvm> {
  if (!isRentCastConfigured()) throw new Error("RentCast not configured");
  const url = new URL("https://api.rentcast.io/v1/avm/value");
  url.searchParams.set("address", address);
  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "X-Api-Key": process.env.RENTCAST_API_KEY!,
    },
    // 30s ceiling — RentCast is usually quick but can stall on cold address
    // lookups. cache:"no-store" keeps Next.js from caching paid API calls.
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`RentCast ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  // RentCast field names: `price`, `priceRangeLow`, `priceRangeHigh`.
  return {
    estimate: typeof json.price === "number" ? json.price : null,
    rangeLow: typeof json.priceRangeLow === "number" ? json.priceRangeLow : null,
    rangeHigh: typeof json.priceRangeHigh === "number" ? json.priceRangeHigh : null,
    raw: json,
  };
}

/** Build a single-line address from a contact's structured parts. */
export function contactAddress(c: {
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}): string {
  return [c.street, c.city, c.state, c.zip].filter(Boolean).join(", ");
}
