import { createClient } from "@/lib/supabase/server";
import { matchContacts } from "@/lib/segments";
import type { Contact, SegmentCriteria } from "@/lib/types";

/** Resolve a segment id to its matching contacts (server-side, RLS-scoped). */
export async function contactsForSegment(segmentId: string): Promise<{
  name: string;
  contacts: Contact[];
}> {
  const supabase = await createClient();
  const { data: segment } = await supabase
    .from("segments")
    .select("name, criteria")
    .eq("id", segmentId)
    .single();
  if (!segment) return { name: "segment", contacts: [] };

  const [{ data: contacts }, { data: links }] = await Promise.all([
    supabase.from("contacts").select("*").order("display_name"),
    supabase.from("contact_tags").select("contact_id, tag_id"),
  ]);
  const tagsByContact = new Map<string, Set<string>>();
  for (const l of links ?? []) {
    const s = tagsByContact.get(l.contact_id) ?? new Set<string>();
    s.add(l.tag_id);
    tagsByContact.set(l.contact_id, s);
  }
  return {
    name: segment.name,
    contacts: matchContacts(
      (contacts ?? []) as Contact[],
      (segment.criteria ?? {}) as SegmentCriteria,
      tagsByContact
    ),
  };
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "export";
}
