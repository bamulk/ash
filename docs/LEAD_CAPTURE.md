# Lead capture + automated touches

## What this ships

- A public API endpoint `POST /api/leads/home-value` that a form on
  ashleystonehomes.com (or any landing page) can submit to. The handler
  creates a Contact tagged `lead`, saves the inquiry, pulls a RentCast
  AVM, emails Ashley an internal notice, sends the lead a short welcome,
  and queues two follow-up drips (day 7, day 30).
- A daily Vercel cron at `GET /api/cron/daily-touches` that:
  1. Sends any drip steps whose `send_at` is due.
  2. Scans transactions and sends an anniversary email on the closed-
     date month-day to the buyer-side contact.
  3. Scans contacts and sends a birthday email on the birthday month-
     day.
- Idempotency is enforced by `scheduled_emails.dedupe_key` (unique index).
- Per-contact pause via the "Pause auto touches" button on the contact
  page (sets `contacts.auto_touches_opt_out`), plus the existing
  unsubscribe link.

## Env vars (set in Vercel, add to `.env.local` for local testing)

| Key | Why |
| --- | --- |
| `WEBSITE_LEAD_SECRET` | Shared secret the form sends in `x-asg-secret`. Pick a random 32-char string. |
| `CRON_SECRET` | Bearer token Vercel's cron sends in the `Authorization` header. |
| `SUPABASE_SERVICE_ROLE_KEY` | Needed for the public endpoint to insert as an unauthenticated caller. |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Already configured. The touches library reuses this. |
| `RENTCAST_API_KEY` | Already configured. If missing, the AVM step soft-fails and the inquiry still saves. |

After setting `CRON_SECRET`, add it to the Vercel cron with
`vercel env add CRON_SECRET` and the cron will pick it up on the next
deploy.

## Form snippet to drop on ashleystonehomes.com

```html
<form id="home-value-form">
  <input name="name" placeholder="Your name" required />
  <input name="email" type="email" placeholder="Email" required />
  <input name="phone" placeholder="Phone (optional)" />
  <input name="address" placeholder="Street address" required />
  <input name="city" placeholder="City" />
  <input name="state" placeholder="State" />
  <input name="zip" placeholder="ZIP" />
  <textarea name="message" placeholder="Anything else?"></textarea>
  <button type="submit">What's my home worth?</button>
</form>

<script>
  document.getElementById('home-value-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const res = await fetch('https://ashley-stone-homes.vercel.app/api/leads/home-value', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        // SET THIS to match WEBSITE_LEAD_SECRET on the app. Do NOT ship it
        // in a client bundle — proxy the request through your own server,
        // or set it as a build-time secret for a static site.
        'x-asg-secret': 'REPLACE_WITH_WEBSITE_LEAD_SECRET',
      },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      form.outerHTML = "<p>Thanks — Ashley will be in touch within one business day.</p>";
    } else {
      alert('Could not submit, please try again or call 916-335-4203.');
    }
  });
</script>
```

If the marketing site is static HTML, keep the secret OFF the client:
POST from a tiny server-side proxy (a Vercel function on the marketing
site, or Netlify form submission handler) that adds the header.

## Curl test (local)

```bash
curl -X POST http://localhost:3300/api/leads/home-value \
  -H "x-asg-secret: $WEBSITE_LEAD_SECRET" \
  -H "content-type: application/json" \
  -d '{
    "name": "Test Lead",
    "email": "test@example.com",
    "phone": "916-555-0101",
    "address": "123 J Street",
    "city": "Sacramento",
    "state": "CA",
    "zip": "95814",
    "message": "Thinking about selling next spring."
  }'
```

Expect `{"ok":true,"contact_id":"…"}` and a new row on `/contacts`.

## Curl test for the cron

```bash
curl -X POST "http://localhost:3300/api/cron/daily-touches" \
  -H "authorization: Bearer $CRON_SECRET"
```

Response contains `sent_count` and the list of what went out. Re-run
the same day and `sent_count` stays zero — the dedupe index blocks
duplicates.

## Timing

- The Vercel cron is scheduled for `0 17 * * *` — 10:00 AM Pacific
  (daylight-saving time; it drifts to 9:00 AM PST in winter). Change
  the cron entry in `vercel.json` if that's wrong for Ashley.
- Drip steps: welcome immediate (sent inline by the API handler),
  market update at day 7, follow-up CTA at day 30.
