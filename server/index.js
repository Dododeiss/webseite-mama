const path = require("path");
const crypto = require("crypto");
const express = require("express");
const session = require("express-session");

const authRoutes = require("./routes/auth");
const resultsRoutes = require("./routes/results");
const eventsRoutes = require("./routes/events");
const internalRoutes = require("./routes/internal");
const anmeldungenRoutes = require("./routes/anmeldungen");

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.SESSION_SECRET) {
  console.warn(
    "[warn] SESSION_SECRET ist nicht gesetzt – verwende ein zufälliges Dev-Secret. " +
      "Für den produktiven Betrieb SESSION_SECRET als Umgebungsvariable setzen."
  );
}
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");

app.use(express.json());
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production" && process.env.FORCE_HTTPS === "1",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/results", resultsRoutes);
app.use("/api/events", eventsRoutes);
app.use("/api/internal", internalRoutes);
app.use("/api/anmeldungen", anmeldungenRoutes);

app.use(
  "/avatars",
  express.static(path.join(__dirname, "..", "data", "avatars"))
);
app.use(
  "/result-documents",
  express.static(path.join(__dirname, "..", "data", "result-documents"))
);

// Static site (the existing plain HTML/CSS/JS prototype) lives at the repo root.
// Nur die öffentliche Webseite ausliefern – niemals data/, server/, .git, node_modules oder package.json.
// Jeder öffentliche Ordner hat eine eigene Auslieferung, aus der man nicht herausnavigieren kann.
const siteRoot = path.join(__dirname, "..");
["css", "js", "img", "assets"].forEach((dir) =>
  app.use(
    "/" + dir,
    express.static(path.join(siteRoot, dir), { dotfiles: "deny", index: false })
  )
);
const ROOT_FILE_RE = /^(?:[A-Za-z0-9-]+\.html|robots\.txt|sitemap\.xml|search-index\.json)$/;
app.get("/:file?", (req, res, next) => {
  const file = req.params.file || "index.html";
  if (!ROOT_FILE_RE.test(file)) return next();
  res.sendFile(file, { root: siteRoot, dotfiles: "deny" }, (err) => {
    if (err && !res.headersSent) next();
  });
});

app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, "..", "index.html"));
});

app.listen(PORT, () => {
  console.log(`BSVZ-Webseite läuft auf http://localhost:${PORT}`);
});
