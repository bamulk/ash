export function formatCurrency(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

/**
 * Short-form currency for dashboard tiles and other narrow spaces where
 * seven-figure dollar amounts would overflow. Keeps full precision up
 * to $999,999, then switches to compact ($4.7M, $12M, $1.2B). Realtors
 * read these at a glance — the hundreds place in "$4,728,000" is noise.
 */
export function formatCurrencyShort(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  if (Math.abs(n) < 1_000_000) {
    return formatCurrency(n);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

export function formatCurrencyCents(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

/** Format a YYYY-MM-DD (or ISO) date without timezone drift. */
export function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  const iso = d.length > 10 ? d.slice(0, 10) : d;
  const [y, m, day] = iso.split("-").map(Number);
  if (!y || !m || !day) return d;
  return new Date(y, m - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatRole(role: string | null | undefined): string {
  if (!role) return "—";
  if (role === "both") return "Buyer & Seller";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

/** Today as YYYY-MM-DD in local time. */
export function todayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
