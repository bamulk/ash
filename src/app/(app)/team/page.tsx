import { redirect } from "next/navigation";
import { UserCog, Plus, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, Badge, Field, Input, Select } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import DeleteButton from "@/components/DeleteButton";
import type { Profile } from "@/lib/types";
import { createMemberAction, updateMemberRoleAction, deleteMemberAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/");

  const { data: members } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at");
  const list = (members ?? []) as Profile[];

  const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  return (
    <div className="space-y-6">
      <PageHeader title="Team" subtitle={`${list.length} ${list.length === 1 ? "member" : "members"}`} />

      {!hasServiceKey && (
        <Card className="p-4 border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
          <div className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-200">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>
              To add or remove members, set <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> in{" "}
              <code className="font-mono">.env.local</code> (Supabase → Project Settings → API → service_role) and restart the dev server.
            </span>
          </div>
        </Card>
      )}

      <Card className="divide-y divide-slate-100 dark:divide-slate-800">
        {list.map((m) => {
          const setRole = updateMemberRoleAction.bind(null, m.id);
          const del = deleteMemberAction.bind(null, m.id);
          const isSelf = m.id === user.id;
          return (
            <div key={m.id} className="flex items-center gap-3 p-4">
              <div className="flex-1 min-w-0">
                <div className="font-medium flex items-center gap-2">
                  {m.full_name || m.email}
                  {isSelf && <span className="text-xs text-slate-400">(you)</span>}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{m.email}</div>
              </div>
              {hasServiceKey && !isSelf ? (
                <form action={setRole} className="flex items-center gap-2">
                  <Select name="role" defaultValue={m.role} className="!py-1 text-xs">
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </Select>
                  <SubmitButton variant="secondary" size="sm">
                    Save
                  </SubmitButton>
                </form>
              ) : (
                <Badge tone="planned">{m.role}</Badge>
              )}
              {hasServiceKey && !isSelf && (
                <DeleteButton action={del} label="Remove" confirmText={`Remove ${m.full_name || m.email}?`} />
              )}
            </div>
          );
        })}
      </Card>

      {hasServiceKey && (
        <Card className="p-5">
          <h2 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Plus size={14} /> Add a member
          </h2>
          <form action={createMemberAction} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Full name">
              <Input name="full_name" placeholder="Jane Doe" />
            </Field>
            <Field label="Email">
              <Input type="email" name="email" required placeholder="jane@email.com" />
            </Field>
            <Field label="Role">
              <Select name="role" defaultValue="member">
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </Select>
            </Field>
            <Field label="Temporary password" hint="Share it with them; they can change it later under Set password.">
              <Input name="password" required minLength={8} placeholder="At least 8 characters" />
            </Field>
            <div className="sm:col-span-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <UserCog size={14} />
              They sign in at the login page, then can update their password.
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <SubmitButton>Add member</SubmitButton>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
