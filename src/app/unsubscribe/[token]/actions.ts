"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createAnonClient } from "@/lib/supabase/server";

/**
 * Record an unsubscribe. Uses the service-role client when available so
 * logged-out visitors (the usual case for unsubscribe clicks from an
 * email) can write without RLS tripping on auth.role() = 'authenticated'.
 * Falls back to the anon client if the service key isn't configured.
 */
export async function unsubscribeAction(token: string, formData: FormData) {
  const reason = String(formData.get("reason") || "").trim() || null;
  const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createAdminClient()
    : await createAnonClient();

  const { error } = await supabase
    .from("contacts")
    .update({
      unsubscribed_at: new Date().toISOString(),
      unsubscribe_reason: reason,
    })
    .eq("unsubscribe_token", token);
  if (error) throw new Error(error.message);
}
