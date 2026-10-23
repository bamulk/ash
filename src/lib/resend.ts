/**
 * Thin wrapper around the Resend HTTP API.
 *
 * Docs: https://resend.com/docs/api-reference/emails/send-batch-emails
 *
 * Why no official SDK: the raw REST API is six lines and keeps the
 * dependency surface clean. Also, Next.js server actions ship these
 * calls, and we don't want to pull in another transitive heap.
 *
 * Required env (server-only):
 *   RESEND_API_KEY     — key from https://resend.com/api-keys
 *   RESEND_FROM_EMAIL  — e.g. "Ashley Stone Homes <ashley@ashleystonehomes.com>"
 *                        The domain MUST be verified in Resend first.
 *
 * Optional env:
 *   NEXT_PUBLIC_APP_URL — used to build unsubscribe links; falls back to
 *                         https://ashley-stone-homes.vercel.app.
 */
const RESEND_API = "https://api.resend.com/emails";
const RESEND_BATCH_API = "https://api.resend.com/emails/batch";
const BATCH_SIZE = 100; // Resend's cap per /emails/batch call

export type ResendEmail = {
  from?: string; // overrides RESEND_FROM_EMAIL
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  reply_to?: string | string[];
  headers?: Record<string, string>;
  tags?: { name: string; value: string }[];
};

export type ResendBatchResult = {
  data?: { id: string }[];
  error?: { message: string; name: string };
};

export function isResendConfigured(): boolean {
  return !!process.env.RESEND_API_KEY?.trim() &&
    !!process.env.RESEND_FROM_EMAIL?.trim();
}

export function defaultFrom(): string {
  return process.env.RESEND_FROM_EMAIL!.trim();
}

export function appUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_APP_URL || "https://ashley-stone-homes.vercel.app").trim();
  return raw.replace(/\/$/, "");
}

/** Send a single email. Returns the Resend message id. */
export async function sendOne(email: ResendEmail): Promise<string> {
  if (!isResendConfigured()) throw new Error("Resend not configured");
  const body = { from: email.from || defaultFrom(), ...email };
  const r = await fetch(RESEND_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  const j = await r.json();
  if (!r.ok) {
    const msg = j?.message || j?.error?.message || `HTTP ${r.status}`;
    throw new Error(`Resend: ${msg}`);
  }
  return j.id as string;
}

/**
 * Send up to 100 emails in one batch call. Returns one id per input
 * email in the same order (or throws if the batch call itself fails).
 */
async function sendBatch(emails: ResendEmail[]): Promise<string[]> {
  if (!isResendConfigured()) throw new Error("Resend not configured");
  const payload = emails.map((e) => ({ from: e.from || defaultFrom(), ...e }));
  const r = await fetch(RESEND_BATCH_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
  });
  const j = (await r.json()) as ResendBatchResult;
  if (!r.ok || j.error) {
    const msg = j.error?.message || `HTTP ${r.status}`;
    throw new Error(`Resend batch: ${msg}`);
  }
  return (j.data || []).map((d) => d.id);
}

/** Chunk + send; returns an array of per-email outcomes aligned with the input. */
export async function sendMany(
  emails: ResendEmail[]
): Promise<{ id?: string; error?: string }[]> {
  const out: { id?: string; error?: string }[] = new Array(emails.length);
  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const slice = emails.slice(i, i + BATCH_SIZE);
    try {
      const ids = await sendBatch(slice);
      slice.forEach((_, j) => (out[i + j] = { id: ids[j] }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      slice.forEach((_, j) => (out[i + j] = { error: msg }));
    }
  }
  return out;
}

/** Replace {display_name} / {first_name} / {last_name} tokens in a template. */
export function renderTemplate(
  template: string,
  vars: { display_name?: string; first_name?: string; last_name?: string }
): string {
  return template
    .replace(/\{\{?\s*display_name\s*\}?\}/gi, vars.display_name || "")
    .replace(/\{\{?\s*first_name\s*\}?\}/gi, vars.first_name || "")
    .replace(/\{\{?\s*last_name\s*\}?\}/gi, vars.last_name || "");
}

/**
 * Wrap plain / minimal HTML with a boilerplate shell that includes the
 * unsubscribe link (required by CAN-SPAM and Gmail's bulk-sender rules).
 *
 * If the input is already a complete HTML document (e.g. pasted from a
 * Claude artifact or an email designer), skip the shell and inject the
 * unsubscribe footer just before </body> so we don't double-wrap it.
 */
export function wrapHtml(bodyHtml: string, unsubscribeUrl: string): string {
  const footer = `
<hr style="border:0;border-top:1px solid #e2e8f0;margin:28px auto 16px;max-width:600px;" />
<p style="font-size:12px;color:#94a3b8;margin:0 auto 24px;max-width:600px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  You received this because you&rsquo;re a contact of Ashley Stone Homes.
  <a href="${unsubscribeUrl}" style="color:#841618;text-decoration:underline;">Unsubscribe</a>.
</p>`;

  const isFullDoc = /<!doctype\s|<html[\s>]/i.test(bodyHtml);
  if (isFullDoc) {
    // Inject the footer just before </body>; append at the end if there
    // isn't a clean </body> (robustness over strictness).
    if (/<\/body>/i.test(bodyHtml)) {
      return bodyHtml.replace(/<\/body>/i, `${footer}\n</body>`);
    }
    return bodyHtml + footer;
  }

  return `<!DOCTYPE html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;line-height:1.55;color:#0f172a;max-width:600px;margin:0 auto;padding:24px;">
${bodyHtml}
${footer}
</body></html>`;
}

/** Minimal "text if you squint, HTML if you pass real HTML" renderer. */
export function toHtmlIfPlain(body: string): string {
  if (/<[a-z!][\s\S]*>/i.test(body)) return body; // already HTML
  // Convert blank-line paragraphs + single newlines to <br>.
  const esc = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const paragraphs = esc.split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`);
  return paragraphs.join("\n");
}
