// Erzeugt search-index.json aus den HTML-Seiten.
// Aufruf: npm run search-index   (nach dem Hinzufügen oder Entfernen von Dokumenten oder Personen)
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

const decode = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/↗/g, "")
    .replace(/\s+/g, " ")
    .trim();

const entries = [];
const seen = new Set();
const add = (e) => {
  const key = e.url + "|" + e.title;
  if (!e.title || seen.has(key)) return;
  seen.add(key);
  entries.push(e);
};

// ---------- Seiten und Bereiche ----------
const pages = [
  ["index.html", "Startseite", "Aktuelles Termine Start"],
  ["verband.html#portrait", "Portrait", "Verband Geschichte Über uns"],
  ["verband.html#vorstand", "Vorstand", "Präsident Kontakt Personen"],
  ["verband.html#mitgliedervereine", "Mitgliedervereine", "Vereine Schützenvereine Clubs Sektionen"],
  ["verband.html#pflichtenhefte", "Pflichtenhefte", "Aufgaben Funktionen"],
  ["verband.html#jobs", "Offene Stellen", "Jobs Mitarbeit Ämter"],
  ["ressorts.html#feldschiessen", "Feldschiessen", "Ressort Resultate Ranglisten"],
  ["ressorts.html#feldstich", "Feldstich", "Ressort Reglement"],
  ["ressorts.html#lupi", "Lupi Bezirks-Einzelmatch", "Ressort Probstei Match"],
  ["ressorts.html#bezirksverbandsschiessen", "Bezirksverbandsschiessen", "Ressort BVS Schiessen"],
  ["ressorts.html#bezirkskonkurrenz", "Bezirkskonkurrenz", "Ressort Anmeldung Kategorie A B C"],
  ["ressorts.html#bezirksmatch", "Bezirksmatch", "Ressort Anmeldung Pistole 300m"],
  ["ressorts.html#jugend", "Jugend / Nachwuchs", "Ressort Jungschützen Jugendschiesskurs Goldig Züri-Träffer"],
  ["dienste.html#reglemente", "Reglemente & Vorschriften", "Regeln Dokumente"],
  ["dienste.html#medien", "Medien", "Presse Bilder Logo"],
  ["dienste.html#waffengesetz", "Waffengesetz & Formulare", "Gesetz Formulare Waffen"],
  ["dienste.html#kontakte", "Wichtige Kontakte", "Adressen Telefon Ansprechpersonen"],
  ["archiv.html#jahresberichte", "Jahresberichte", "Archiv Berichte"],
  ["archiv.html#dv-protokolle", "DV-Protokolle", "Archiv Protokolle Delegiertenversammlung"],
  ["archiv.html#ranglisten-schiessplaene", "Ranglisten & Schiesspläne", "Archiv Resultate ältere Jahre"],
  ["kalender.html", "Kalender", "Termine Anlässe Veranstaltungen iCal"],
  ["anmeldung.html", "Anmeldung zu Wettkämpfen", "online anmelden Bezirksmatch Bezirkskonkurrenz Formular"],
  ["resultate.html", "Resultate", "Ranglisten Wettkampf"],
  ["impressum.html", "Impressum", "Kontakt Verantwortlich"],
  ["datenschutz.html", "Datenschutz", "Daten Privatsphäre Cookies"],
  ["login.html", "Anmelden", "Login Konto Vorstand"],
];
pages.forEach(([url, title, keywords]) => add({ url, title, type: "Seite", keywords }));

// ---------- Dokumente (PDF, Word, Excel) ----------
const TYPE = { pdf: "PDF", doc: "Word", docx: "Word", xls: "Excel", xlsx: "Excel" };
const RESSORT_WORDS = {
  feldschiessen: "Feldschiessen",
  feldstich: "Feldstich",
  lupi: "Lupi Bezirks-Einzelmatch",
  bezirksverbandsschiessen: "Bezirksverbandsschiessen",
  bezirkskonkurrenz: "Bezirkskonkurrenz",
  bezirksmatch: "Bezirksmatch",
  "jugend-gewehr300": "Jugend Gewehr 300m",
  gzt: "Goldig Züri-Träffer Jugend",
};

function keywordsFor(href) {
  const words = [];
  if (href.includes("/jahresberichte/")) words.push("Jahresbericht Bericht Archiv");
  if (href.includes("/dv-protokolle/")) words.push("Protokoll Delegiertenversammlung DV Archiv");
  if (href.includes("/rsp-")) words.push("Rangliste Resultate Archiv");
  if (href.includes("/reglemente/")) words.push("Reglement Vorschrift");
  if (href.includes("/pflichtenhefte/")) words.push("Pflichtenheft");
  if (href.includes("/formulare/")) words.push("Formular Anmeldung");
  const m = href.match(/assets\/ressorts\/([^/]+)\//);
  if (m && RESSORT_WORDS[m[1]]) words.push("Ressort " + RESSORT_WORDS[m[1]]);
  return words.join(" ");
}

for (const file of ["archiv.html", "dienste.html", "ressorts.html", "verband.html"]) {
  const html = read(file);
  const re = /<a href="(assets\/[^"]+\.(pdf|docx?|xlsx?))"[^>]*>([^<]+)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const href = decode(m[1]);
    add({
      url: href,
      title: decode(m[3]),
      type: TYPE[m[2].toLowerCase()],
      keywords: (keywordsFor(href) + " " + TYPE[m[2].toLowerCase()] + " " + m[2]).trim(),
    });
  }
}

// ---------- Vorstand ----------
const verband = read("verband.html");
const vre = /<article class="card vorstand-card">[\s\S]*?<h3>([^<]+)<\/h3>\s*<p class="meta">([^<]+)<\/p>/g;
let vm;
while ((vm = vre.exec(verband))) {
  add({
    url: "verband.html#vorstand",
    title: `${decode(vm[1])} (${decode(vm[2])})`,
    type: "Vorstand",
    keywords: "Vorstand Kontakt Person " + decode(vm[2]),
  });
}

// ---------- Mitgliedervereine ----------
const vereinSection = (verband.match(/id="mitgliedervereine"[\s\S]*?<\/section>/) || [""])[0];
const tre = /<tr><td>([^<]*)<\/td><td><a [^>]*>([^<]+)<\/a>/g;
let tm;
while ((tm = tre.exec(vereinSection))) {
  add({
    url: "verband.html#mitgliedervereine",
    title: decode(tm[2]),
    type: "Verein",
    keywords: "Mitgliederverein Schützenverein " + decode(tm[1]),
  });
}

fs.writeFileSync(path.join(root, "search-index.json"), JSON.stringify(entries), "utf8");
const byType = entries.reduce((acc, e) => ((acc[e.type] = (acc[e.type] || 0) + 1), acc), {});
console.log(`search-index.json: ${entries.length} Einträge`, byType);
