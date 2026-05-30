#!/usr/bin/env node
/**
 * Parse the Ashley Stone Homes contact Google Sheet (saved as
 * scripts/data/sheet-dump.md — a markdown dump of every tab) into a
 * normalized, de-duplicated contact list and emit:
 *   - scripts/data/contacts.normalized.json  (for inspection)
 *   - scripts/data/contacts.insert.sql        (run against Postgres)
 *
 * The sheet has the same people spread across several differently-shaped
 * tabs. We treat the tabs that actually carry contact info (name +
 * address + email + phone, and the Buyer/Seller role tab) as the source,
 * dedupe by normalized name, and union emails/phones. Structured-only
 * tabs (no email/phone) are ignored to avoid duplicate noise.
 *
 *   node scripts/import-contacts.mjs            # parse + write files, print summary
 */
import fs from "node:fs";
import path from "node:path";

const DATA = path.resolve("scripts/data");
const DUMP = path.join(DATA, "sheet-dump.md");

// ---- known Sacramento-area cities (longest first for greedy match) ----
const CITIES = [
  "West Sacramento", "Rancho Cordova", "Citrus Heights", "El Dorado Hills",
  "Cameron Park", "Granite Bay", "North Highlands", "Gold River",
  "Fair Oaks", "Elk Grove", "Rio Linda", "Mapleton", "Sacramento",
  "Carmichael", "Orangevale", "Roseville", "Antelope", "Elverta",
  "Placerville", "Folsom", "Rocklin", "Lincoln", "Loomis", "Galt",
  "Wilton", "Auburn", "Davis", "Woodland", "Mather", "Represa",
  "Antioch", "Livermore", "Lodi", "Natomas",
].sort((a, b) => b.length - a.length);

const STATE_MAP = {
  ca: "CA", california: "CA", ut: "UT", utah: "UT", nv: "NV",
  nevada: "NV", tx: "TX", az: "AZ", or: "OR", wa: "WA", fl: "FL",
};

function normName(s) {
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitMulti(s) {
  if (!s) return [];
  return s
    .split(/[,;]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function cleanPhone(p) {
  return p.replace(/\\/g, "").trim();
}
function cleanEmail(e) {
  return e.replace(/\\/g, "").trim().toLowerCase();
}

/** Best-effort parse of a free-form address string. */
function parseAddress(raw) {
  if (!raw) return { street: null, city: null, state: null, zip: null };
  let s = raw.replace(/\\/g, "").replace(/\s+/g, " ").trim();
  s = s.replace(/[,\s]+(usa|united states)\.?\s*$/i, "").trim();
  let zip = null, state = null, city = null;

  const zipM = s.match(/(\d{5})(?:-\d{4})?\s*$/);
  if (zipM) {
    zip = zipM[1];
    s = s.slice(0, zipM.index).trim().replace(/[,]+$/, "").trim();
  }
  const stateM = s.match(/[, ]+([A-Za-z]{2,12})\.?\s*$/);
  if (stateM && STATE_MAP[stateM[1].toLowerCase()]) {
    state = STATE_MAP[stateM[1].toLowerCase()];
    s = s.slice(0, stateM.index).trim().replace(/[,]+$/, "").trim();
  }
  for (const c of CITIES) {
    const re = new RegExp(`[ ,]${c.replace(/ /g, "\\s+")}\\s*$`, "i");
    if (re.test(s) || s.toLowerCase() === c.toLowerCase()) {
      city = c;
      s = s.replace(re, "").trim().replace(/[,]+$/, "").trim();
      break;
    }
  }
  return { street: s || null, city, state, zip };
}

function mapRole(raw) {
  if (!raw) return null;
  const r = raw.toLowerCase();
  const buyer = r.includes("buyer");
  const seller = r.includes("seller");
  if (buyer && seller) return "both";
  if (buyer) return "buyer";
  if (seller) return "seller";
  return null;
}

function splitName(display) {
  // "Alison & Kevin Lanius" -> last = "Lanius", first = "Alison & Kevin"
  const parts = display.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

// ---- parse the markdown dump into table blocks ----
const lines = fs.readFileSync(DUMP, "utf8").split("\n");
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

function cells(line) {
  return line
    .replace(/^\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((c) => c.trim());
}
const isAlign = (l) => /^[|\s:-]+$/.test(l) && l.includes(":-:");

// Records collected from the contact-bearing tabs.
const raw = [];

for (const block of blocks) {
  const alignIdx = block.findIndex(isAlign);
  if (alignIdx === -1) continue;
  const header = cells(block[alignIdx - 1]);
  const dataRows = block.slice(alignIdx + 1).filter((l) => l.includes("|"));
  const ncols = header.length;
  const headerJoined = header.join(" | ").toLowerCase();

  // Classify the tab by shape.
  if (ncols === 5) {
    // Buyer/Seller role tab: [name, "name - address", email, phone, role]
    // The header row is actually the first data row here.
    for (const row of [block[alignIdx - 1], ...dataRows]) {
      const c = cells(row);
      if (isAlign(row)) continue;
      const name = c[0];
      if (!name) continue;
      const addr = (c[1] || "").includes(" - ")
        ? c[1].split(" - ").slice(1).join(" - ")
        : c[1];
      raw.push({
        name,
        address: addr,
        emails: splitMulti(c[2]).map(cleanEmail),
        phones: splitMulti(c[3]).map(cleanPhone),
        role: mapRole(c[4]),
      });
    }
  } else if (ncols === 4 && headerJoined.includes("name") && headerJoined.includes("email")) {
    // NAME | ADDRESS | EMAIL | PHONE NUMBER
    for (const row of dataRows) {
      const c = cells(row);
      if (!c[0]) continue;
      raw.push({
        name: c[0],
        address: c[1],
        emails: splitMulti(c[2]).map(cleanEmail),
        phones: splitMulti(c[3]).map(cleanPhone),
        role: null,
      });
    }
  } else if (ncols === 8 && headerJoined.includes("email address")) {
    // First | Last | Address | City | State | Zip | Email Address | Phone Number
    for (const row of dataRows) {
      const c = cells(row);
      const name = `${c[0]} ${c[1]}`.trim();
      if (!name) continue;
      raw.push({
        name,
        address: [c[2], c[3], `${c[4] || ""} ${c[5] || ""}`].filter(Boolean).join(", "),
        emails: splitMulti(c[6]).map(cleanEmail),
        phones: splitMulti(c[7]).map(cleanPhone),
        role: null,
        city: c[3] || null,
        state: c[4] || null,
        zip: c[5] || null,
      });
    }
  }
  // Other tabs (structured, no email/phone) are intentionally skipped.
}

// ---- merge by normalized name ----
const byName = new Map();
let mergedCount = 0;
for (const r of raw) {
  const key = normName(r.name);
  if (!key) continue;
  if (!byName.has(key)) {
    byName.set(key, {
      display_name: r.name.replace(/\\/g, "").trim(),
      emails: new Set(r.emails),
      phones: new Set(r.phones),
      role: r.role,
      addresses: r.address ? [r.address] : [],
      city: r.city || null,
      state: r.state || null,
      zip: r.zip || null,
    });
  } else {
    mergedCount++;
    const e = byName.get(key);
    r.emails.forEach((x) => e.emails.add(x));
    r.phones.forEach((x) => e.phones.add(x));
    if (!e.role && r.role) e.role = r.role;
    if (r.address) e.addresses.push(r.address);
    if (!e.city && r.city) e.city = r.city;
    if (!e.state && r.state) e.state = r.state;
    if (!e.zip && r.zip) e.zip = r.zip;
  }
}

const contacts = [];
for (const e of byName.values()) {
  // Pick the longest address string as the canonical one to parse.
  const bestAddr = e.addresses.sort((a, b) => b.length - a.length)[0] || null;
  const parsed = parseAddress(bestAddr);
  const { first, last } = splitName(e.display_name);
  contacts.push({
    first_name: first,
    last_name: last,
    display_name: e.display_name,
    emails: [...e.emails].filter((x) => /@/.test(x)),
    phones: [...e.phones],
    street: parsed.street,
    city: e.city || parsed.city,
    state: e.state || parsed.state || (bestAddr ? "CA" : null),
    zip: e.zip || parsed.zip,
    role: e.role,
    source: "Sheet import",
  });
}

contacts.sort((a, b) => a.display_name.localeCompare(b.display_name));

// ---- write JSON ----
fs.writeFileSync(
  path.join(DATA, "contacts.normalized.json"),
  JSON.stringify(contacts, null, 2)
);

// ---- write SQL ----
const q = (v) =>
  v == null || v === "" ? "null" : `'${String(v).replace(/'/g, "''")}'`;
const arr = (xs) =>
  !xs || xs.length === 0
    ? "'{}'"
    : `array[${xs.map((x) => `'${String(x).replace(/'/g, "''")}'`).join(",")}]::text[]`;

const values = contacts
  .map(
    (c) =>
      `(${q(c.first_name)}, ${q(c.last_name)}, ${q(c.display_name)}, ${arr(
        c.emails
      )}, ${arr(c.phones)}, ${q(c.street)}, ${q(c.city)}, ${q(c.state)}, ${q(
        c.zip
      )}, ${q(c.role)}, ${q(c.source)})`
  )
  .join(",\n");

const sql = `insert into public.contacts
(first_name, last_name, display_name, emails, phones, street, city, state, zip, role, source)
values
${values};
`;
fs.writeFileSync(path.join(DATA, "contacts.insert.sql"), sql);

// ---- summary ----
const withEmail = contacts.filter((c) => c.emails.length).length;
const withPhone = contacts.filter((c) => c.phones.length).length;
const withCity = contacts.filter((c) => c.city).length;
const roles = contacts.reduce((m, c) => {
  const k = c.role || "none";
  m[k] = (m[k] || 0) + 1;
  return m;
}, {});
console.log("Parsed raw rows:", raw.length);
console.log("Merged duplicate rows:", mergedCount);
console.log("Unique contacts:", contacts.length);
console.log("  with email:", withEmail, " with phone:", withPhone, " with city:", withCity);
console.log("  roles:", JSON.stringify(roles));
console.log("Wrote contacts.normalized.json and contacts.insert.sql");
