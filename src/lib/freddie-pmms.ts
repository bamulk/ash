/**
 * Freddie Mac Primary Mortgage Market Survey (PMMS) — weekly 30-year
 * and 15-year fixed mortgage rates. We pull the numbers from FRED
 * (St. Louis Fed), which republishes the PMMS series as a clean JSON
 * API:
 *   MORTGAGE30US — 30-year fixed rate, weekly avg
 *   MORTGAGE15US — 15-year fixed rate, weekly avg
 *
 * Get a free key at https://fred.stlouisfed.org/docs/api/api_key.html
 * and set FRED_API_KEY in .env.local (and Vercel).
 *
 * Rates update every Thursday; we cache the result for 24 hours.
 */
import { unstable_cache } from "next/cache";

export type PmmsPoint = {
  /** Week-ending date YYYY-MM-DD. */
  date: string;
  /** Rate as a percent, e.g. 6.75. */
  rate: number;
};

export type PmmsRates = {
  thirty: PmmsPoint | null;
  fifteen: PmmsPoint | null;
  /** Same shape, one week earlier — for the week-over-week delta. */
  thirtyPrev: PmmsPoint | null;
  fifteenPrev: PmmsPoint | null;
};

export function isFredConfigured(): boolean {
  return !!process.env.FRED_API_KEY?.trim();
}

async function fetchSeries(seriesId: string, limit = 2): Promise<PmmsPoint[]> {
  const key = process.env.FRED_API_KEY;
  if (!key) return [];
  const url = new URL("https://api.stlouisfed.org/fred/series/observations");
  url.searchParams.set("series_id", seriesId);
  url.searchParams.set("api_key", key);
  url.searchParams.set("file_type", "json");
  url.searchParams.set("sort_order", "desc");
  url.searchParams.set("limit", String(limit));
  const r = await fetch(url.toString(), {
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) return [];
  const j = (await r.json()) as { observations?: { date: string; value: string }[] };
  return (j.observations ?? [])
    .map((o) => ({ date: o.date, rate: parseFloat(o.value) }))
    .filter((p) => !Number.isNaN(p.rate));
}

/** Cached for 24h; underlying data only changes weekly (Thursdays). */
export const getPmmsRates = unstable_cache(
  async (): Promise<PmmsRates> => {
    if (!isFredConfigured()) {
      return { thirty: null, fifteen: null, thirtyPrev: null, fifteenPrev: null };
    }
    const [thirty, fifteen] = await Promise.all([
      fetchSeries("MORTGAGE30US", 2),
      fetchSeries("MORTGAGE15US", 2),
    ]);
    return {
      thirty: thirty[0] ?? null,
      thirtyPrev: thirty[1] ?? null,
      fifteen: fifteen[0] ?? null,
      fifteenPrev: fifteen[1] ?? null,
    };
  },
  ["pmms-rates"],
  { revalidate: 86_400, tags: ["pmms-rates"] }
);
