#!/usr/bin/env node
/**
 * Read the "Closed Deals 2025" sheet from the local
 * "Ashley Stone Homes 2025.xlsx" and emit SQL inserts for
 * public.transactions. Excel serial dates are converted to YYYY-MM-DD.
 * Each deal's contact_id is resolved at insert time by an exact
 * display_name match (subquery) — unmatched deals keep contact_id null.
 *
 *   node scripts/import-transactions.mjs [path-to-xlsx]
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const XLSX =
  process.argv[2] ||
  "/Users/brettmulkey/Downloads/_To Trash 2026-04-21/Ashley Stone Homes 2025.xlsx";
const OUT = path.resolve("scripts/data/transactions.insert.sql");

// ---- minimal xlsx reader (no deps): unzip + parse sheet1 + sharedStrings ----
function readZipEntries(buf) {
  // Parse the central directory of a ZIP to get entry name -> raw bytes.
  const entries = {};
  // Find End Of Central Directory record.
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error("Not a zip");
  let cd = buf.readUInt32LE(eocd + 16);
  const count = buf.readUInt16LE(eocd + 10);
  for (let i = 0; i < count; i++) {
    const nameLen = buf.readUInt16LE(cd + 28);
    const extraLen = buf.readUInt16LE(cd + 30);
    const commentLen = buf.readUInt16LE(cd + 32);
    const localOff = buf.readUInt32LE(cd + 42);
    const name = buf.toString("utf8", cd + 46, cd + 46 + nameLen);
    // Read local header to find data offset + compression.
    const method = buf.readUInt16LE(localOff + 8);
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const compSize = buf.readUInt32LE(cd + 20);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compSize);
    entries[name] = method === 8 ? zlib.inflateRawSync(raw) : raw;
    cd += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

const buf = fs.readFileSync(XLSX);
const entries = readZipEntries(buf);
const dec = (b) => Buffer.from(b).toString("utf8");
const unescape = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const ssXml = dec(entries["xl/sharedStrings.xml"] || Buffer.from(""));
const shared = [...ssXml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) =>
  unescape(m[1])
);

const sheetXml = dec(entries["xl/worksheets/sheet1.xml"]);
function colNum(ref) {
  const c = ref.match(/[A-Z]+/)[0];
  let n = 0;
  for (const ch of c) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}
const rows = [];
for (const rowM of sheetXml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
  const cells = {};
  for (const cM of rowM[1].matchAll(/<c r="([A-Z]+\d+)"([^>]*)>([\s\S]*?)<\/c>/g)) {
    const ref = cM[1];
    const attrs = cM[2];
    const inner = cM[3];
    const t = (attrs.match(/t="([^"]+)"/) || [])[1];
    const vM = inner.match(/<v>([\s\S]*?)<\/v>/);
    let val = "";
    if (vM) val = t === "s" ? shared[Number(vM[1])] : vM[1];
    cells[colNum(ref)] = val;
  }
  const max = Math.max(0, ...Object.keys(cells).map(Number));
  rows.push(Array.from({ length: max }, (_, i) => cells[i + 1] ?? ""));
}

function serialToDate(serial) {
  const n = Number(serial);
  if (!n || Number.isNaN(n)) return null;
  const ms = (n - 25569) * 86400 * 1000;
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

// Header is row 0. Data rows have a non-empty client (col 1).
const deals = [];
for (const r of rows.slice(1)) {
  const client = (r[0] || "").trim();
  if (!client || client.toLowerCase().startsWith("total")) continue;
  const num = (x) => {
    const v = parseFloat(String(x).replace(/[$,]/g, ""));
    return Number.isNaN(v) ? null : v;
  };
  deals.push({
    client_name: client,
    address: (r[1] || "").trim() || null,
    closed_date: serialToDate(r[2]),
    source_of_business: (r[3] || "").trim() || null,
    deal_type: /sell/i.test(r[4]) ? "seller" : /buy/i.test(r[4]) ? "buyer" : null,
    sold_price: num(r[5]),
    commission_pct: num(r[6]),
    gci: num(r[7]),
    broker_share: num(r[8]),
    admin_fee: num(r[9]),
    agent_share: num(r[10]),
  });
}

const q = (v) => (v == null || v === "" ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const n = (v) => (v == null ? "null" : Number(v));

const values = deals
  .map(
    (d) =>
      `((select id from public.contacts where lower(display_name) = lower(${q(
        d.client_name
      )}) limit 1), ${q(d.client_name)}, ${q(d.address)}, ${q(d.closed_date)}, ${q(
        d.source_of_business
      )}, ${q(d.deal_type)}, ${n(d.sold_price)}, ${n(d.commission_pct)}, ${n(
        d.gci
      )}, ${n(d.broker_share)}, ${n(d.admin_fee)}, ${n(d.agent_share)})`
  )
  .join(",\n");

const sql = `insert into public.transactions
(contact_id, client_name, address, closed_date, source_of_business, deal_type, sold_price, commission_pct, gci, broker_share, admin_fee, agent_share)
values
${values};
`;
fs.writeFileSync(OUT, sql);

console.log("Deals parsed:", deals.length);
for (const d of deals)
  console.log(`  ${d.closed_date}  ${d.client_name.padEnd(28)} ${d.deal_type}  $${d.sold_price}`);
console.log("Wrote", OUT);
