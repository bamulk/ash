/**
 * Thin wrapper around the Anthropic Messages API — just enough to
 * extract structured contact fields from a free-form dictation.
 *
 * Why not the AI SDK: we want zero new deps and nothing to configure
 * client-side; a single fetch to the Messages endpoint does what we
 * need. If a second AI use ever lands, consider upgrading to
 * @ai-sdk/anthropic or Vercel's AI Gateway.
 *
 * Env (server-only):
 *   ANTHROPIC_API_KEY — https://console.anthropic.com/settings/keys
 *
 * The model is pinned here on purpose: anything that compiles against
 * this module gets the same model + behavior.
 */
const MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-5-5";

export function isAnthropicConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY?.trim();
}

export type ParsedContact = {
  display_name: string;
  first_name: string;
  last_name: string;
  emails: string[];
  phones: string[];
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  role: "buyer" | "seller" | "both" | null;
  birthday: string | null;
  notes: string | null;
  budget_min: number | null;
  budget_max: number | null;
  target_neighborhoods: string | null;
};

const SYSTEM_PROMPT = `You extract real-estate contact details from a short dictation by Ashley Stone, a realtor in the Sacramento area.

Return a single JSON object matching this exact TypeScript type:

type ParsedContact = {
  display_name: string;           // "First Last" or best guess
  first_name: string;
  last_name: string;
  emails: string[];               // all mentioned, lowercased, trimmed
  phones: string[];               // formatted as "(555) 555-5555"
  street: string | null;
  city: string | null;
  state: string | null;           // 2-letter code, uppercase
  zip: string | null;
  role: "buyer" | "seller" | "both" | null;
  birthday: string | null;        // ISO YYYY-MM-DD when a year is given
  notes: string | null;           // anything else Ashley said that doesn't fit above, written as a note to self
  budget_min: number | null;      // whole dollars
  budget_max: number | null;      // whole dollars
  target_neighborhoods: string | null;  // comma-separated if several
};

Rules:
- Output ONLY the JSON object, no prose, no code fences.
- If a field isn't in the dictation, use null (or [] for arrays).
- "Half a million" = 500000; "900K" = 900000; "1.2 million" = 1200000.
- Trust Ashley's role call: "buyer" / "seller" / "lead" (map lead to buyer unless she says they're selling).
- "Lives in East Sac" is address info (city = Sacramento, neighborhood goes to notes). "Looking in East Sac" is target_neighborhoods.
- Preserve what she actually said in notes rather than guessing at it. Short note, same voice.
- If no name is detectable at all, set display_name/first_name/last_name to the empty string.`;

/**
 * Extract a ParsedContact from a dictation transcript. Throws when
 * the Anthropic API errors, when the response isn't valid JSON, or
 * when the parsed object doesn't match the expected shape. Callers
 * should fall back to a hand-fill form in that case.
 */
export async function parseContactFromDictation(
  transcript: string
): Promise<ParsedContact> {
  if (!isAnthropicConfigured()) throw new Error("Anthropic not configured");
  const r = await fetch(MESSAGES_URL, {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Dictation:\n${transcript.trim()}`,
        },
      ],
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Anthropic ${r.status}: ${text.slice(0, 300)}`);
  }
  const j = (await r.json()) as {
    content?: { type: string; text?: string }[];
  };
  const first = j.content?.find((b) => b.type === "text")?.text?.trim() ?? "";
  if (!first) throw new Error("Anthropic returned no text");

  // The system prompt asks for raw JSON but models sometimes still
  // wrap it in a code fence. Peel it defensively.
  const raw = first
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Anthropic returned non-JSON");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Anthropic returned non-object");
  }
  return normalize(parsed as Partial<ParsedContact>);
}

function normalize(p: Partial<ParsedContact>): ParsedContact {
  const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
  const strOrNull = (v: unknown): string | null => {
    const s = str(v);
    return s === "" ? null : s;
  };
  const arrStr = (v: unknown): string[] =>
    Array.isArray(v)
      ? v.map((x) => str(x)).filter((s) => s.length > 0)
      : [];
  const num = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  const role = (v: unknown): "buyer" | "seller" | "both" | null => {
    const s = str(v).toLowerCase();
    return s === "buyer" || s === "seller" || s === "both" ? s : null;
  };

  return {
    display_name: str(p.display_name),
    first_name: str(p.first_name),
    last_name: str(p.last_name),
    emails: arrStr(p.emails).map((e) => e.toLowerCase()),
    phones: arrStr(p.phones),
    street: strOrNull(p.street),
    city: strOrNull(p.city),
    state: strOrNull(p.state)?.toUpperCase() ?? null,
    zip: strOrNull(p.zip),
    role: role(p.role),
    birthday: strOrNull(p.birthday),
    notes: strOrNull(p.notes),
    budget_min: num(p.budget_min),
    budget_max: num(p.budget_max),
    target_neighborhoods: strOrNull(p.target_neighborhoods),
  };
}
