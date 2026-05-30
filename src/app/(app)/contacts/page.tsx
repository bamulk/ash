import Link from "next/link";
import { UserPlus, Search, Mail, Phone, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, LinkButton, Card, Badge, EmptyState } from "@/components/ui";
import { formatRole } from "@/lib/format";
import type { Contact, Tag } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; city?: string; tag?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q || "").trim().toLowerCase();
  const role = sp.role || "";
  const city = (sp.city || "").trim().toLowerCase();
  const tagId = sp.tag || "";

  const supabase = await createClient();
  const [{ data: contacts }, { data: tags }, { data: links }] = await Promise.all([
    supabase.from("contacts").select("*").order("display_name"),
    supabase.from("tags").select("id, name, color").order("name"),
    supabase.from("contact_tags").select("contact_id, tag_id"),
  ]);

  const tagsById = new Map((tags ?? []).map((t) => [t.id, t as Tag]));
  const tagsByContact = new Map<string, Tag[]>();
  for (const l of links ?? []) {
    const t = tagsById.get(l.tag_id);
    if (!t) continue;
    const arr = tagsByContact.get(l.contact_id) ?? [];
    arr.push(t);
    tagsByContact.set(l.contact_id, arr);
  }

  let rows = (contacts ?? []) as Contact[];
  if (role) rows = rows.filter((c) => c.role === role);
  if (city) rows = rows.filter((c) => (c.city || "").toLowerCase().includes(city));
  if (tagId)
    rows = rows.filter((c) => (tagsByContact.get(c.id) ?? []).some((t) => t.id === tagId));
  if (q)
    rows = rows.filter((c) => {
      const hay = [
        c.display_name,
        c.city,
        c.zip,
        c.street,
        ...(c.emails || []),
        ...(c.phones || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });

  const cities = [...new Set((contacts ?? []).map((c) => c.city).filter(Boolean))].sort();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contacts"
        subtitle={`${rows.length} of ${contacts?.length ?? 0} shown`}
        actions={
          <LinkButton href="/contacts/new">
            <UserPlus size={14} /> New contact
          </LinkButton>
        }
      />

      <Card className="p-4">
        <form method="get" className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <label className="block space-y-1 sm:col-span-2">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Search</span>
            <span className="relative block">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                name="q"
                defaultValue={sp.q || ""}
                placeholder="Name, email, phone, address…"
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg pl-9 pr-3 py-2 text-sm"
              />
            </span>
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Role</span>
            <select
              name="role"
              defaultValue={role}
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">All</option>
              <option value="buyer">Buyer</option>
              <option value="seller">Seller</option>
              <option value="both">Buyer &amp; Seller</option>
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">City</span>
            <input
              name="city"
              defaultValue={sp.city || ""}
              list="city-list"
              placeholder="Any"
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm"
            />
            <datalist id="city-list">
              {cities.map((c) => (
                <option key={c} value={c!} />
              ))}
            </datalist>
          </label>
          {tagId && <input type="hidden" name="tag" value={tagId} />}
          <div className="sm:col-span-4 flex gap-2">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-brand text-white text-sm px-3.5 py-2 hover:bg-brand-hover"
            >
              <Search size={14} /> Filter
            </button>
            <Link
              href="/contacts"
              className="inline-flex items-center text-sm px-3 py-2 text-slate-600 dark:text-slate-400 hover:underline"
            >
              Clear
            </Link>
          </div>
        </form>
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          title="No contacts match"
          description="Try clearing the filters or adding a new contact."
        />
      ) : (
        <Card className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((c) => {
            const ctags = tagsByContact.get(c.id) ?? [];
            return (
              <Link
                key={c.id}
                href={`/contacts/${c.id}`}
                className="flex items-center gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-slate-900 dark:text-slate-100 truncate">
                      {c.display_name}
                    </span>
                    {c.role && <Badge tone={c.role}>{formatRole(c.role)}</Badge>}
                    {ctags.map((t) => (
                      <Badge key={t.id} tone="planned">
                        {t.name}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-0.5 flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                    {(c.city || c.state) && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={12} /> {[c.city, c.state].filter(Boolean).join(", ")}
                      </span>
                    )}
                    {c.emails?.[0] && (
                      <span className="inline-flex items-center gap-1 truncate">
                        <Mail size={12} /> {c.emails[0]}
                      </span>
                    )}
                    {c.phones?.[0] && (
                      <span className="inline-flex items-center gap-1">
                        <Phone size={12} /> {c.phones[0]}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </Card>
      )}
    </div>
  );
}
