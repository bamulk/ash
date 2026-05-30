import type { Contact, SegmentCriteria } from "@/lib/types";

/**
 * Resolve a segment's saved criteria to a list of contacts.
 * `tagsByContact` maps contact id -> set of tag ids (for tag filtering).
 */
export function matchContacts(
  contacts: Contact[],
  criteria: SegmentCriteria,
  tagsByContact?: Map<string, Set<string>>
): Contact[] {
  const c = criteria || {};
  const city = (c.city || "").trim().toLowerCase();
  const state = (c.state || "").trim().toLowerCase();
  const zip = (c.zip || "").trim();
  const search = (c.search || "").trim().toLowerCase();

  return contacts.filter((ct) => {
    if (c.role && ct.role !== c.role) return false;
    if (city && !(ct.city || "").toLowerCase().includes(city)) return false;
    if (state && (ct.state || "").toLowerCase() !== state) return false;
    if (zip && !(ct.zip || "").startsWith(zip)) return false;
    if (c.has_email && !(ct.emails?.length > 0)) return false;
    if (c.has_phone && !(ct.phones?.length > 0)) return false;
    if (c.tag_id) {
      const tags = tagsByContact?.get(ct.id);
      if (!tags || !tags.has(c.tag_id)) return false;
    }
    if (search) {
      const hay = [ct.display_name, ct.city, ct.zip, ...(ct.emails || [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });
}

export function describeCriteria(c: SegmentCriteria, tagName?: string): string {
  const parts: string[] = [];
  if (c.role) parts.push(c.role === "both" ? "Buyers & Sellers" : `${c.role}s`);
  if (c.city) parts.push(`in ${c.city}`);
  if (c.state) parts.push(c.state);
  if (c.zip) parts.push(`ZIP ${c.zip}`);
  if (c.tag_id) parts.push(`tagged ${tagName || "…"}`);
  if (c.has_email) parts.push("with email");
  if (c.has_phone) parts.push("with phone");
  if (c.search) parts.push(`matching “${c.search}”`);
  return parts.length ? parts.join(", ") : "All contacts";
}
