import { type NextRequest } from "next/server";
import { contactsForSegment, slugify } from "@/lib/export-data";

export const dynamic = "force-dynamic";

function csvCell(v: string | null | undefined): string {
  const s = String(v ?? "");
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(req: NextRequest) {
  const segmentId = req.nextUrl.searchParams.get("segment");
  if (!segmentId) return new Response("Missing segment", { status: 400 });

  const { name, contacts } = await contactsForSegment(segmentId);
  const header = ["Name", "Street", "City", "State", "ZIP", "Email", "Phone"];
  const lines = [header.map(csvCell).join(",")];
  for (const c of contacts) {
    lines.push(
      [
        c.display_name,
        c.street,
        c.city,
        c.state,
        c.zip,
        (c.emails || []).join("; "),
        (c.phones || []).join("; "),
      ]
        .map(csvCell)
        .join(",")
    );
  }
  const body = lines.join("\r\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slugify(name)}-contacts.csv"`,
    },
  });
}
