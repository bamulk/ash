import { notFound } from "next/navigation";
import Image from "next/image";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createAnonClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui";
import { unsubscribeAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function UnsubscribePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Public page: use the admin client if we have the service-role key so
  // that logged-out visitors can look up their own token. Falls back to
  // the authed client (will miss the row for anonymous visitors — the
  // page then shows the generic "unknown link" state).
  const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createAdminClient()
    : await createAnonClient();
  const { data: contact } = await supabase
    .from("contacts")
    .select("display_name, emails, unsubscribed_at")
    .eq("unsubscribe_token", token)
    .maybeSingle();
  if (!contact) notFound();

  const already = !!contact.unsubscribed_at;
  const bound = unsubscribeAction.bind(null, token);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900/90 p-8 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700/70 space-y-5">
        <div className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="Ashley Stone Homes"
            width={44}
            height={44}
            className="w-11 h-11 object-contain"
            priority
          />
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              Ashley Stone Homes
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Email preferences
            </p>
          </div>
        </div>

        {already ? (
          <div className="space-y-2">
            <p className="text-sm text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 rounded-lg px-3 py-2">
              You&rsquo;re already unsubscribed. No further marketing emails will be sent to this address.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Changed your mind? Reach out to Ashley directly and she&rsquo;ll re-enable it.
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Unsubscribe <strong>{contact.display_name}</strong>
              {contact.emails?.[0] ? ` (${contact.emails[0]})` : ""} from marketing emails?
            </p>
            <form action={bound} className="space-y-3">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Reason (optional)
                </span>
                <textarea
                  name="reason"
                  rows={3}
                  placeholder="Too many emails, not interested, moved out of area…"
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm"
                />
              </label>
              <Button type="submit" variant="danger" className="w-full">
                Unsubscribe
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
