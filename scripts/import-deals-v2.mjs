#!/usr/bin/env node
/**
 * Parse the "Ashley Stone Real Estate" Google Sheet
 * (scripts/data/deals-sheet.md) into normalized transactions.
 *
 * The sheet contains multiple sections with subtly different column
 * shapes across years (2017 → 2026), plus two in-escrow deals. This
 * importer detects each section by its header, normalizes everything to
 * the canonical transactions schema, and emits SQL inserts.
 */
import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve("scripts/data/deals-sheet.md");
const OUT_JSON = path.resolve("scripts/data/deals.normalized.json");
const OUT_SQL = path.resolve("scripts/data/deals.insert.sql");

// --- helpers --------------------------------------------------------

function cells(line) {
  return line
    .replace(/^\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((s) => s.trim());
}
const isAlign = (l) => /^[|\s:-]+$/.test(l) && l.includes(":-:");

function parseDate(raw) {
  if (!raw) return null;
  const s = raw.replace(/\\/g, "").trim();
  // M/D/YY, M/D/YYYY, MM/DD/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  let [, mo, d, y] = m;
  if (y.length === 2) y = "20" + y;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parseMoney(raw) {
  if (!raw) return null;
  const s = String(raw).replace(/\\/g, "").replace(/[$,\s]/g, "").trim();
  if (!s || /^[a-z]/i.test(s)) return null;
  const n = parseFloat(s);
  return Number.isNaN(n) ? null : n;
}
function parsePct(raw) {
  if (!raw) return null;
  const s = String(raw).replace(/\\/g, "").replace(/[%$,\s]/g, "").trim();
  if (!s) return null;
  // Skip non-numeric markers like "Flat Rate", "None", "Dollar Amount"
  if (/[a-z]/i.test(s)) return null;
  const n = parseFloat(s);
  if (Number.isNaN(n)) return null;
  // Drop obvious data-entry errors (real commission % is at most ~10);
  // values like 660 / 2250 are flat-dollar amounts typo'd into the % column.
  if (n > 100) return null;
  return n;
}
function parseType(raw) {
  if (!raw) return null;
  const s = raw.toLowerCase();
  const isBuyer = s.includes("buyer");
  const isSeller = s.includes("seller");
  if (isBuyer && isSeller) return "buyer"; // dual representations import as buyer side
  if (isBuyer) return "buyer";
  if (isSeller) return "seller";
  return null;
}
function clean(raw) {
  if (raw == null) return null;
  const s = String(raw).replace(/\\([_#])/g, "$1").replace(/\s+/g, " ").trim();
  return s === "" ? null : s;
}

// --- parse the markdown into table blocks ---------------------------

const lines = fs.readFileSync(SRC, "utf8").split("\n");
const blocks = [];
let cur = [];
for (const line of lines) {
  if (line.trim() === "") {
    if (cur.length) blocks.push(cur);
    cur = [];
  } else {
    cur.push(line);
  }
}
if (cur.length) blocks.push(cur);

const records = [];
let inEscrow = 0;
let closed = 0;
let skipped = 0;

for (const block of blocks) {
  const alignIdx = block.findIndex(isAlign);
  if (alignIdx === -1) continue;
  const header = cells(block[alignIdx - 1]);
  const dataRows = block
    .slice(alignIdx + 1)
    .filter((l) => l.includes("|") && !isAlign(l));

  const sig = header.join("|").toLowerCase();

  // Pending leads tab (Name | Source | Type | Contact Number | Notes) — skip
  if (header[0]?.toLowerCase() === "name" && header.includes("Contact Number")) {
    skipped += dataRows.length;
    continue;
  }
  // Subtotals (NO_HEADER) — skip
  if (sig.includes("no_header") || sig.includes("no\\_header")) continue;

  // In-escrow blocks
  if (sig.includes("estimated coe date")) {
    for (const row of dataRows) {
      const c = cells(row);
      const client = clean(c[0]);
      if (!client || client === "L") continue;
      records.push({
        client_name: client,
        address: clean(c[1]),
        status: "in_escrow",
        closed_date: null,
        target_coe_date: parseDate(c[4]),
        source_of_business: null,
        deal_type: null,
        sold_price: parseMoney(c[3]),
        commission_pct: null,
        gci: null,
        broker_share: null,
        admin_fee: null,
        agent_share: null,
        notes: null,
      });
      inEscrow++;
    }
    continue;
  }

  // Closed-deals shapes — detect by column signature
  // Shape A (standard 2020+): Sold Price | Commission % | GCI | Broker Share | Admin Fee | Agent Share
  // Shape B (2019): Listing Price | Sold Price | Commission % | GCI | Broker Share | Admin Fee | Agent Share
  // Shape C (2018): Sold Price | Commission % | GCI | TC fee | Agent Share  (no broker share)
  // Shape D (2017): Client | Address | Date Closed | Sold Price | Commission % | GCI | Agent Share
  let shape = null;
  if (sig.includes("listing price")) shape = "B";
  else if (sig.includes("tc fee")) shape = "C";
  else if (
    sig.includes("commision %") &&
    !sig.includes("source of business")
  )
    shape = "D";
  else if (sig.includes("date closed") && sig.includes("sold price")) shape = "A";

  if (!shape) {
    skipped += dataRows.length;
    continue;
  }

  for (const row of dataRows) {
    const c = cells(row);
    const client = clean(c[0]);
    if (!client) {
      skipped++;
      continue;
    }
    let rec;
    if (shape === "A") {
      rec = {
        client_name: client,
        address: clean(c[1]),
        closed_date: parseDate(c[2]),
        source_of_business: clean(c[3]),
        deal_type: parseType(c[4]),
        sold_price: parseMoney(c[5]),
        commission_pct: parsePct(c[6]),
        gci: parseMoney(c[7]),
        broker_share: parseMoney(c[8]),
        admin_fee: parseMoney(c[9]),
        agent_share: parseMoney(c[10]),
      };
    } else if (shape === "B") {
      // 2019: c[5]=listing, c[6]=sold, c[7]=pct, c[8]=gci, c[9]=broker, c[10]=admin, c[11]=agent
      rec = {
        client_name: client,
        address: clean(c[1]),
        closed_date: parseDate(c[2]),
        source_of_business: clean(c[3]),
        deal_type: parseType(c[4]),
        sold_price: parseMoney(c[6]),
        commission_pct: parsePct(c[7]),
        gci: parseMoney(c[8]),
        broker_share: parseMoney(c[9]),
        admin_fee: parseMoney(c[10]),
        agent_share: parseMoney(c[11]),
      };
    } else if (shape === "C") {
      // 2018: c[5]=sold, c[6]=pct, c[7]=gci, c[8]=TC fee → admin_fee, c[9]=agent
      rec = {
        client_name: client,
        address: clean(c[1]),
        closed_date: parseDate(c[2]),
        source_of_business: clean(c[3]),
        deal_type: parseType(c[4]),
        sold_price: parseMoney(c[5]),
        commission_pct: parsePct(c[6]),
        gci: parseMoney(c[7]),
        broker_share: null,
        admin_fee: parseMoney(c[8]),
        agent_share: parseMoney(c[9]),
      };
    } else if (shape === "D") {
      // 2017: Client | Address | Date Closed | Sold Price | Pct | GCI | Agent Share
      rec = {
        client_name: client,
        address: clean(c[1]),
        closed_date: parseDate(c[2]),
        source_of_business: null,
        deal_type: null,
        sold_price: parseMoney(c[3]),
        commission_pct: parsePct(c[4]),
        gci: parseMoney(c[5]),
        broker_share: null,
        admin_fee: null,
        agent_share: parseMoney(c[6]),
      };
    }
    rec.status = "closed";
    rec.target_coe_date = null;
    rec.notes = null;
    records.push(rec);
    closed++;
  }
}

// Sort by closed_date desc (in-escrow first)
records.sort((a, b) => {
  if (a.status === "in_escrow" && b.status !== "in_escrow") return -1;
  if (b.status === "in_escrow" && a.status !== "in_escrow") return 1;
  return (b.closed_date || "").localeCompare(a.closed_date || "");
});

fs.writeFileSync(OUT_JSON, JSON.stringify(records, null, 2));

// --- emit SQL -------------------------------------------------------

const q = (v) =>
  v == null || v === "" ? "null" : `'${String(v).replace(/'/g, "''")}'`;
const n = (v) => (v == null ? "null" : Number(v));

const values = records
  .map(
    (r) =>
      `((select id from public.contacts where lower(display_name) = lower(${q(
        r.client_name
      )}) limit 1), ${q(r.client_name)}, ${q(r.address)}, ${q(
        r.closed_date
      )}, ${q(r.target_coe_date)}, ${q(r.status)}, ${q(
        r.source_of_business
      )}, ${q(r.deal_type)}, ${n(r.sold_price)}, ${n(
        r.commission_pct
      )}, ${n(r.gci)}, ${n(r.broker_share)}, ${n(r.admin_fee)}, ${n(
        r.agent_share
      )})`
  )
  .join(",\n");

const sql = `delete from public.transactions;

insert into public.transactions
(contact_id, client_name, address, closed_date, target_coe_date, status, source_of_business, deal_type, sold_price, commission_pct, gci, broker_share, admin_fee, agent_share)
values
${values};
`;
fs.writeFileSync(OUT_SQL, sql);

console.log(`Parsed ${records.length} records — closed: ${closed}, in_escrow: ${inEscrow}, skipped: ${skipped}`);
console.log(`Saved ${OUT_JSON} and ${OUT_SQL}`);
console.log("Year breakdown:");
const years = {};
for (const r of records) {
  const y = r.closed_date ? r.closed_date.slice(0, 4) : "in_escrow";
  years[y] = (years[y] || 0) + 1;
}
for (const y of Object.keys(years).sort()) console.log(`  ${y}: ${years[y]}`);
