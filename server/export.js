const fs = require("fs");
const path = require("path");
const JSZip = require("jszip");

const TEMPLATE_DIR = path.join(__dirname, "templates");

const TEMPLATES = {
  pistole: "bezirksmatch-pistole.docx",
  "bk-a": "bk-a.xlsx",
  "bk-b": "bk-b.xlsx",
  "bk-c": "bk-c.xlsx",
};

function xmlEsc(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isoToDe(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "";
}

function dbTimeToZurich(value) {
  const d = new Date(String(value).replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("de-CH", {
    timeZone: "Europe/Zurich",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------- Excel (Bezirkskonkurrenz Kat. A/B/C) ----------

function sortForList(participants) {
  return [...participants].sort(
    (a, b) =>
      a.verein.localeCompare(b.verein, "de") ||
      a.name.localeCompare(b.name, "de") ||
      a.vorname.localeCompare(b.vorname, "de")
  );
}

function numOrNull(v) {
  return v === null || v === undefined || v === "" ? null : Number(v);
}

function shiftRowXml(rowXml, delta) {
  return rowXml
    .replace(/^<row ([^>]*?)r="(\d+)"/, (m, pre, r) => `<row ${pre}r="${Number(r) + delta}"`)
    .replace(/<c r="([A-Z]+)(\d+)"/g, (m, col, r) => `<c r="${col}${Number(r) + delta}"`);
}

async function buildXlsx(typ, { year, participants }) {
  const zip = await JSZip.loadAsync(fs.readFileSync(path.join(TEMPLATE_DIR, TEMPLATES[typ])));
  let sheet = await zip.file("xl/worksheets/sheet1.xml").async("string");

  const shared = sheet.match(/<f t="shared" ref="A6:A(\d+)" si="0">/);
  if (!shared) throw new Error("Unerwartetes Excel-Format der Vorlage.");
  const lastRow = Number(shared[1]);
  const capacity = lastRow - 5;
  const list = sortForList(participants);
  const delta = Math.max(0, list.length - capacity);
  const newLast = lastRow + delta;

  const rows = sheet.match(/<row [\s\S]*?<\/row>/g);
  const templateRow = rows.find((r) => /^<row r="6"/.test(r));
  const rowOpen = templateRow.match(/^<row [^>]*>/)[0];
  const style = {};
  for (const col of ["A", "B", "C", "D", "E", "F", "G", "H"]) {
    style[col] = (templateRow.match(new RegExp(`<c r="${col}6" s="(\\d+)"`)) || [])[1];
  }

  const cell = (col, r, inner, type) =>
    `<c r="${col}${r}" s="${style[col]}"${type ? ` t="${type}"` : ""}${inner ? `>${inner}</c>` : "/>"}`;
  const text = (col, r, value) =>
    cell(col, r, `<is><t xml:space="preserve">${xmlEsc(value)}</t></is>`, "inlineStr");
  const num = (col, r, value) => (value === null ? cell(col, r, "") : cell(col, r, `<v>${value}</v>`));

  const dataRow = (r, p) => {
    const op = p ? numOrNull(p.op) : null;
    const fs_ = p ? numOrNull(p.fs) : null;
    const bs = p ? numOrNull(p.bs) : null;
    const total = (op || 0) + (fs_ || 0) + (bs || 0);
    const formula =
      r === 6
        ? `<f t="shared" ref="A6:A${newLast}" si="0">B6+C6+D6</f>`
        : `<f t="shared" si="0"/>`;
    return (
      rowOpen.replace(/r="6"/, `r="${r}"`) +
      `<c r="A${r}" s="${style.A}">${formula}<v>${total}</v></c>` +
      num("B", r, op) +
      num("C", r, fs_) +
      num("D", r, bs) +
      (p ? text("E", r, p.name) : cell("E", r, "")) +
      (p ? text("F", r, p.vorname) : cell("F", r, "")) +
      (p && p.jahrgang ? num("G", r, Number(p.jahrgang)) : cell("G", r, "")) +
      (p ? text("H", r, p.verein) : cell("H", r, "")) +
      "</row>"
    );
  };

  const out = [];
  for (const rowXml of rows) {
    const r = Number(rowXml.match(/^<row [^>]*?r="(\d+)"/)[1]);
    if (r < 6) {
      out.push(rowXml);
    } else if (r <= lastRow) {
      out.push(dataRow(r, list[r - 6]));
      if (r === lastRow) {
        for (let extra = lastRow + 1; extra <= newLast; extra++) {
          out.push(dataRow(extra, list[extra - 6]));
        }
      }
    } else {
      out.push(delta ? shiftRowXml(rowXml, delta) : rowXml);
    }
  }

  const start = sheet.indexOf("<sheetData>") + "<sheetData>".length;
  const end = sheet.indexOf("</sheetData>");
  sheet = sheet.slice(0, start) + out.join("") + sheet.slice(end);

  if (delta) {
    sheet = sheet
      .replace(/(<dimension ref="A3:I)(\d+)"/, (m, a, n) => `${a}${Number(n) + delta}"`)
      .replace(/(sqref="B6:H)(\d+)"/, (m, a, n) => `${a}${Number(n) + delta}"`)
      .replace(/<mergeCell ref="A(\d+):I(\d+)"/, (m, a, b) => `<mergeCell ref="A${Number(a) + delta}:I${Number(b) + delta}"`)
      .replace(/<hyperlink ref="A(\d+):I(\d+)"/, (m, a, b) => `<hyperlink ref="A${Number(a) + delta}:I${Number(b) + delta}"`);
  }

  if (year) {
    sheet = sheet.replace(/Bezirkskonkurrenz \d{4}/, `Bezirkskonkurrenz ${year}`);
  }

  zip.file("xl/worksheets/sheet1.xml", sheet);

  // Excel soll die Summen beim Öffnen neu berechnen; die alte Berechnungskette würde nicht mehr passen.
  let workbook = await zip.file("xl/workbook.xml").async("string");
  workbook = workbook.replace(/<calcPr([^>]*?)\/>/, '<calcPr$1 fullCalcOnLoad="1"/>');
  zip.file("xl/workbook.xml", workbook);
  zip.remove("xl/calcChain.xml");
  let rels = await zip.file("xl/_rels/workbook.xml.rels").async("string");
  rels = rels.replace(/<Relationship [^>]*calcChain[^>]*\/>/, "");
  zip.file("xl/_rels/workbook.xml.rels", rels);
  let types = await zip.file("[Content_Types].xml").async("string");
  types = types.replace(/<Override [^>]*calcChain[^>]*\/>/, "");
  zip.file("[Content_Types].xml", types);

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

// ---------- Word (Bezirksmatch Pistole) ----------

const FONT = '<w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/>';
const RPR = `<w:rPr>${FONT}<w:szCs w:val="22"/></w:rPr>`;
const RPR_BOLD = `<w:rPr>${FONT}<w:b/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>`;
const TABS =
  '<w:tabs><w:tab w:val="left" w:pos="1701"/><w:tab w:val="left" w:pos="4678"/><w:tab w:val="left" w:pos="6521"/></w:tabs>';

const run = (value, bold) =>
  `<w:r>${bold ? RPR_BOLD : RPR}<w:t xml:space="preserve">${xmlEsc(value)}</w:t></w:r>`;
const tab = () => `<w:r>${RPR}<w:tab/></w:r>`;
const line = (...runs) =>
  `<w:p><w:pPr>${TABS}<w:spacing w:line="360" w:lineRule="auto"/></w:pPr>${runs.join("")}</w:p>`;
const empty = () => `<w:p><w:pPr><w:rPr>${FONT}</w:rPr></w:pPr></w:p>`;
// Abstand unter dem Logo, wie in der Vorlage (vier Leerabsätze)
const spacer = () =>
  '<w:p><w:pPr><w:pStyle w:val="berschrift1"/></w:pPr></w:p>' +
  empty() +
  `<w:p><w:pPr><w:rPr>${FONT}<w:sz w:val="24"/></w:rPr></w:pPr></w:p>` +
  '<w:p><w:pPr><w:spacing w:line="360" w:lineRule="auto"/></w:pPr></w:p>';
const pageBreak = () => `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;
const heading = (value) =>
  `<w:p><w:pPr><w:pStyle w:val="berschrift1"/><w:jc w:val="left"/><w:rPr>${FONT}<w:b/></w:rPr></w:pPr>` +
  `<w:r><w:rPr>${FONT}<w:b/><w:szCs w:val="28"/></w:rPr><w:t xml:space="preserve">${xmlEsc(value)}</w:t></w:r></w:p>`;

function participantPage(event, slots, p) {
  const chosen = new Set(JSON.parse(p.slots || "[]"));
  const parts = [
    heading(event.title),
    spacer(),
    line(run("Name:"), tab(), run(p.name, true), tab(), run("Vorname:"), tab(), run(p.vorname, true)),
    line(run("Geb. Datum:"), tab(), run(isoToDe(p.geb_datum), true), tab(), run("Verein:"), tab(), run(p.verein, true)),
    line(run("Tel:"), tab(), run(p.tel || "", true), tab(), run("Lizenznummer:"), tab(), run(p.lizenz || "", true)),
    line(run("e-mail:"), tab(), run(p.email || "", true)),
    empty(),
    line(run("Ich melde mich für folgende Disziplinen an:", true)),
  ];
  slots.forEach((label, i) => {
    parts.push(line(run(chosen.has(i) ? "☒  " : "☐  "), run(label)));
  });
  parts.push(empty());
  parts.push(line(run("Anmeldeschluss:"), tab(), run(isoToDe(event.deadline))));
  if (event.contact_name || event.contact_email) {
    parts.push(
      line(
        run("Fragen an:"),
        tab(),
        run([event.contact_name, event.contact_email].filter(Boolean).join(", "))
      )
    );
  }
  parts.push(line(run("Angemeldet am:"), tab(), run(dbTimeToZurich(p.created_at))));
  return parts.join("");
}

async function buildDocx(event, participants) {
  const zip = await JSZip.loadAsync(fs.readFileSync(path.join(TEMPLATE_DIR, TEMPLATES.pistole)));
  const doc = await zip.file("word/document.xml").async("string");
  const head = doc.slice(0, doc.indexOf("<w:body>") + "<w:body>".length);
  const sectPr = doc.slice(doc.lastIndexOf("<w:sectPr"), doc.lastIndexOf("</w:body>"));
  const slots = JSON.parse(event.slots || "[]");

  const list = [...participants].sort(
    (a, b) => a.name.localeCompare(b.name, "de") || a.vorname.localeCompare(b.vorname, "de")
  );
  const body = list.length
    ? list.map((p) => participantPage(event, slots, p)).join(pageBreak())
    : heading(event.title) + spacer() + line(run("Noch keine Anmeldungen."));

  zip.file("word/document.xml", head + body + sectPr + "</w:body></w:document>");
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

async function buildExport(event, participants) {
  if (event.typ === "pistole") {
    return {
      buffer: await buildDocx(event, participants),
      ext: "docx",
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
  }
  const year = (event.deadline || "").slice(0, 4);
  return {
    buffer: await buildXlsx(event.typ, { year, participants }),
    ext: "xlsx",
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
}

module.exports = { buildExport, isoToDe };
