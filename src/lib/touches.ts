/**
 * Templates and dispatcher for every automated outbound email the app
 * sends on its own (as opposed to campaigns Ashley composes by hand):
 *
 *   - lead drip (drip_welcome -> immediately, drip_market -> day 7,
 *     drip_cta -> day 30; triggered by a public home-value form submit)
 *   - anniversary of a closed deal (triggered by the daily cron)
 *   - birthday (triggered by the daily cron)
 *   - internal "new lead" notice to Ashley herself
 *
 * Keep every template short and personal — if these ever feel like
 * marketing blast, pause the automation at the contact level
 * (contacts.auto_touches_opt_out).
 */
import {
  appUrl,
  defaultFrom,
  isResendConfigured,
  renderTemplate,
  sendOne,
  wrapHtml,
} from "./resend";

export type TouchKind =
  | "drip_welcome"
  | "drip_market"
  | "drip_cta"
  | "anniversary"
  | "birthday";

export const TOUCH_KINDS: TouchKind[] = [
  "drip_welcome",
  "drip_market",
  "drip_cta",
  "anniversary",
  "birthday",
];

/** How many days after a lead first comes in the drip steps go out. */
export const DRIP_SCHEDULE: { kind: TouchKind; days: number }[] = [
  { kind: "drip_welcome", days: 0 },
  { kind: "drip_market", days: 7 },
  { kind: "drip_cta", days: 30 },
];

type TemplateVars = {
  display_name: string;
  first_name: string;
  last_name: string;
};

type Template = {
  subject: string;
  body: string;
};

const SIGNATURE = `
<p style="margin:28px 0 0;">
  — Ashley Stone<br/>
  <span style="color:#4a4944;">Ashley Stone Real Estate Group · eXp Realty · DRE #01961466</span><br/>
  <a href="tel:9163354203" style="color:#8a1c2b;text-decoration:none;">916-335-4203</a>
  &nbsp;·&nbsp;
  <a href="mailto:ashleystonehomes@gmail.com" style="color:#8a1c2b;text-decoration:none;">ashleystonehomes@gmail.com</a>
</p>`;

function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;line-height:1.6;color:#1d1d1b;">${text}</p>`;
}

const TEMPLATES: Record<TouchKind, Template> = {
  drip_welcome: {
    subject: "Thanks for reaching out, {first_name}",
    body: [
      paragraph("Hi {first_name},"),
      paragraph(
        "Thanks for the home value request — I&rsquo;ll pull current comps for your street and send you a detailed estimate within one business day."
      ),
      paragraph(
        "A quick note while that&rsquo;s working: an automated estimate (Zillow, Redfin, the one you just submitted) is a starting point, not the market. Two homes on the same block with the same square footage can sell $75K apart because of condition, updates, and how the listing is presented. The number I send you will account for that."
      ),
      paragraph(
        "If you&rsquo;d rather skip the back-and-forth and just talk, grab 15 minutes with me &mdash; call or text <a href=\"tel:9163354203\" style=\"color:#8a1c2b;\">916-335-4203</a>."
      ),
      SIGNATURE,
    ].join("\n"),
  },
  drip_market: {
    subject: "{first_name} — the Sacramento market right now",
    body: [
      paragraph("Hi {first_name},"),
      paragraph(
        "Checking back in with the latest Sacramento County numbers. The headline is: prices are still edging up (median sold $555K, +2.8% year-over-year), but inventory is up 8.8% and average days on market is now 35. The homes selling first are the ones priced right at day one and presented well — not the ones that chase the market down."
      ),
      paragraph(
        "What that means for you: if you&rsquo;re thinking about selling in the next six months, this is the moment to decide on price and prep, not after a few weeks of &ldquo;let&rsquo;s see.&rdquo;"
      ),
      paragraph(
        "Happy to walk you through what a listing-ready version of your home would look like, including staging through my own company. No pressure &mdash; just a conversation."
      ),
      SIGNATURE,
    ].join("\n"),
  },
  drip_cta: {
    subject: "Still thinking about it, {first_name}?",
    body: [
      paragraph("Hi {first_name},"),
      paragraph(
        "A month ago you asked what your home might be worth, and I wanted to check in &mdash; the market has moved a bit since then, and I can refresh the estimate with the last four weeks of comps if that would help."
      ),
      paragraph(
        "If you&rsquo;re ready to list, or just want to start sketching a plan for next spring, I&rsquo;d love 20 minutes with you. If you&rsquo;ve decided to stay put, that&rsquo;s great too &mdash; just let me know and I&rsquo;ll stop checking in."
      ),
      paragraph(
        "<a href=\"tel:9163354203\" style=\"color:#8a1c2b;\">916-335-4203</a> or reply to this email."
      ),
      SIGNATURE,
    ].join("\n"),
  },
  anniversary: {
    subject: "{first_name} — a year in your home 🏡",
    body: [
      paragraph("Hi {first_name},"),
      paragraph(
        "Hard to believe it&rsquo;s already been a year (or more!) since we closed on your home. I hope it&rsquo;s been treating you well."
      ),
      paragraph(
        "Little housekeeping note: this is a good time to check your HVAC filter, test smoke detectors, and glance at your homeowner&rsquo;s insurance renewal. And if you&rsquo;ve ever wondered what your home might sell for today, just reply &mdash; I&rsquo;ll pull fresh comps for your street, no obligation."
      ),
      paragraph("Thinking of you."),
      SIGNATURE,
    ].join("\n"),
  },
  birthday: {
    subject: "Happy birthday, {first_name} 🎉",
    body: [
      paragraph("Hi {first_name},"),
      paragraph(
        "Just a quick note to say happy birthday. Hope your day is lovely and that whoever&rsquo;s cooking knows what you like."
      ),
      paragraph("Cheers,"),
      SIGNATURE,
    ].join("\n"),
  },
};

/**
 * Render + send one scheduled touch to a contact. Returns the Resend
 * message id on success, or throws. The caller is responsible for
 * marking the queue row sent/errored.
 */
export async function sendTouch({
  kind,
  contact,
  unsubscribeToken,
}: {
  kind: TouchKind;
  contact: {
    id: string;
    display_name: string;
    first_name: string;
    last_name: string;
    emails: string[];
  };
  unsubscribeToken: string;
}): Promise<string> {
  if (!isResendConfigured()) throw new Error("Resend not configured");
  const to = (contact.emails || []).find((e) => /@/.test(e));
  if (!to) throw new Error("Contact has no email address");

  const template = TEMPLATES[kind];
  if (!template) throw new Error(`Unknown touch kind: ${kind}`);

  const vars: TemplateVars = {
    display_name: contact.display_name,
    first_name: contact.first_name || contact.display_name.split(/\s+/)[0] || "",
    last_name: contact.last_name,
  };

  const unsubUrl = `${appUrl()}/unsubscribe/${unsubscribeToken}`;
  const html = wrapHtml(renderTemplate(template.body, vars), unsubUrl);

  return sendOne({
    from: defaultFrom(),
    to,
    subject: renderTemplate(template.subject, vars),
    html,
    reply_to: "ashleystonehomes@gmail.com",
    headers: {
      "List-Unsubscribe": `<${unsubUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    tags: [
      { name: "touch_kind", value: kind },
      { name: "contact_id", value: contact.id },
    ],
  });
}

/**
 * Internal notice to Ashley when a new lead comes in. Not queued —
 * sent inline so she sees it right away.
 */
export async function notifyNewLead({
  contactName,
  contactEmail,
  contactPhone,
  address,
  message,
  avm,
}: {
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  address: string;
  message: string | null;
  avm: {
    estimate: number | null;
    low: number | null;
    high: number | null;
    error?: string | null;
  };
}): Promise<void> {
  if (!isResendConfigured()) return;
  const fmt = (n: number | null) =>
    n == null
      ? "—"
      : new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        }).format(n);

  const avmBlock = avm.error
    ? `<p style="margin:0 0 12px;color:#8a1c2b;">RentCast couldn&rsquo;t estimate this address: ${avm.error}</p>`
    : `<table style="border-collapse:collapse;margin:0 0 16px;">
         <tr><td style="padding:4px 12px 4px 0;color:#4a4944;">Estimate</td><td style="padding:4px 0;font-weight:600;">${fmt(avm.estimate)}</td></tr>
         <tr><td style="padding:4px 12px 4px 0;color:#4a4944;">Range</td><td style="padding:4px 0;">${fmt(avm.low)} &ndash; ${fmt(avm.high)}</td></tr>
       </table>`;

  const html = wrapHtml(
    [
      paragraph(`<strong>${contactName}</strong> just submitted the home-value form.`),
      paragraph(`<a href="mailto:${contactEmail}">${contactEmail}</a>${contactPhone ? ` · <a href="tel:${contactPhone.replace(/\D/g, "")}">${contactPhone}</a>` : ""}`),
      paragraph(`<strong>Address:</strong> ${address}`),
      message
        ? paragraph(`<strong>Note from them:</strong><br/>${message.replace(/\n/g, "<br/>")}`)
        : "",
      `<h3 style="margin:24px 0 8px;font-family:Jost,sans-serif;">RentCast AVM</h3>`,
      avmBlock,
      paragraph(
        `They&rsquo;re on the auto drip (welcome now, market update in 7 days, nudge in 30). If you reply or they book a call, that&rsquo;s on top.`
      ),
      paragraph(
        `<a href="${appUrl()}/contacts" style="color:#8a1c2b;">Open in Ashley Stone Homes</a>`
      ),
    ].join("\n"),
    // Internal mail doesn't need a real unsub token — pass a placeholder
    // so wrapHtml's footer renders a dead link rather than a crash.
    `${appUrl()}/unsubscribe/internal`
  );

  await sendOne({
    from: defaultFrom(),
    to: "ashleystonehomes@gmail.com",
    subject: `New home value request — ${contactName}`,
    html,
    reply_to: contactEmail,
    tags: [
      { name: "touch_kind", value: "internal_lead_notice" },
      { name: "lead_email", value: contactEmail },
    ],
  });
}
