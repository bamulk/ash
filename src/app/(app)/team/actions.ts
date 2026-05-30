"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

function ensureServiceKey() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Team management needs SUPABASE_SERVICE_ROLE_KEY in .env.local (Supabase → Project Settings → API)."
    );
  }
}

export async function createMemberAction(formData: FormData) {
  await requireAdmin();
  ensureServiceKey();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const full_name = String(formData.get("full_name") || "").trim();
  const role = String(formData.get("role") || "member");
  const password = String(formData.get("password") || "");
  if (!email || !password) throw new Error("Email and a temporary password are required");
  if (password.length < 8) throw new Error("Temporary password must be at least 8 characters");

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });
  if (error) throw new Error(error.message);
  const id = data.user?.id;
  if (id) {
    await admin.from("profiles").update({ full_name, role }).eq("id", id);
  }
  revalidatePath("/team");
}

export async function updateMemberRoleAction(id: string, formData: FormData) {
  await requireAdmin();
  ensureServiceKey();
  const role = String(formData.get("role") || "member");
  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ role }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/team");
}

export async function deleteMemberAction(id: string) {
  await requireAdmin();
  ensureServiceKey();
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) throw new Error(error.message);
  revalidatePath("/team");
}
