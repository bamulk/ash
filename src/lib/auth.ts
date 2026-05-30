import { createClient } from "@/lib/supabase/server";

/** Returns the signed-in user's id + profile, or throws if not signed in. */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  return { supabase, user };
}

/** Throws unless the signed-in user is an admin. */
export async function requireAdmin() {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") throw new Error("Admin only");
  return { supabase, user };
}
