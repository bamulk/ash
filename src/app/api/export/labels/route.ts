import { type NextRequest } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { contactsForSegment, slugify } from "@/lib/export-data";
import type { Contact } from "@/lib/types";

export const dynamic = "force-dynamic";

// Avery 5160 — 30 labels per Letter page (3 cols × 10 rows), in points.
const PAGE_W = 612;
const PAGE_H = 792;
const TOP_MARGIN = 36; // 0.5"
const LEFT_MARGIN = 13.5; // ~0.1875"
const LABEL_H = 72; // 1"
const COL_PITCH = 198; // label + 0.125" gutter
const COLS = 3;
const ROWS = 10;
const PAD_X = 8;

function addressLines(c: Contact): string[] {
  const cityLine = [c.city, c.state].filter(Boolean).join(", ");
  const cityZip = [cityLine, c.zip].filter(Boolean).join(" ");
  return [c.display_name, c.street || "", cityZip].filter(Boolean);
}

export async function GET(req: NextRequest) {
  const segmentId = req.nextUrl.searchParams.get("segment");
  if (!segmentId) return new Response("Missing segment", { status: 400 });

  const { name, contacts } = await contactsForSegment(segmentId);
  // Only contacts with a usable mailing address.
  const mailable = contacts.filter((c) => c.street && (c.city || c.zip));

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const perPage = COLS * ROWS;
  const black = rgb(0.1, 0.1, 0.12);

  if (mailable.length === 0) {
    const page = pdf.addPage([PAGE_W, PAGE_H]);
    page.drawText("No mailable addresses in this segment.", {
      x: 48,
      y: PAGE_H - 72,
      size: 12,
      font,
      color: black,
    });
  }

  for (let i = 0; i < mailable.length; i++) {
    if (i % perPage === 0) pdf.addPage([PAGE_W, PAGE_H]);
    const page = pdf.getPage(pdf.getPageCount() - 1);
    const idx = i % perPage;
    const row = Math.floor(idx / COLS);
    const col = idx % COLS;
    const x = LEFT_MARGIN + col * COL_PITCH + PAD_X;
    const labelTop = PAGE_H - TOP_MARGIN - row * LABEL_H;

    const lines = addressLines(mailable[i]);
    let y = labelTop - 22;
    lines.forEach((line, li) => {
      const text = line.length > 38 ? line.slice(0, 37) + "…" : line;
      page.drawText(text, {
        x,
        y,
        size: 10,
        font: li === 0 ? bold : font,
        color: black,
      });
      y -= 13;
    });
  }

  const bytes = await pdf.save();
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${slugify(name)}-labels.pdf"`,
    },
  });
}
