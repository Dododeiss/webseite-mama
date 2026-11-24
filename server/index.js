const path = require("path");
const crypto = require("crypto");
const express = require("express");
const session = require("express-session");

const authRoutes = require("./routes/auth");
const resultsRoutes = require("./routes/results");
const eventsRoutes = require("./routes/events");
const internalRoutes = require("./routes/internal");
const anmeldungenRoutes = require("./routes/anmeldungen");
const usersRoutes = require("./routes/users");

const app = express();
const PORT = process.env.PORT || 3000;

// Hinter dem Infomaniak-Proxy: echte Besucher-Adresse und HTTPS erkennen (für Login-Sperre und Cookie).
app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; " +
      "base-uri 'self'; form-action 'self'; frame-ancestors 'self'"
  );
  if (req.secure) {
    res.setHeader("Strict-Transport-Security", "max-age=15552000");
  }
  next();
});

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
      secure: "auto",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/results", resultsRoutes);
app.use("/api/events", eventsRoutes);
app.use("/api/internal", internalRoutes);
app.use("/api/anmeldungen", anmeldungenRoutes);
app.use("/api/users", usersRoutes);
app.use("/api", (req, res) => res.status(404).json({ error: "Nicht gefunden." }));

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
  res.status(404).sendFile(path.join(siteRoot, "404.html"), (err) => {
    if (err && !res.headersSent) res.status(404).type("text").send("Seite nicht gefunden.");
  });
});

// Fehler nie mit Details nach aussen geben.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err.status >= 400 && err.status < 500 ? err.status : 500;
  if (status === 500) console.error(err);
  res.status(status).json({
    error: status === 500 ? "Interner Serverfehler." : "Ungültige Anfrage.",
  });
});

app.listen(PORT, () => {
  console.log(`BSVZ-Webseite läuft auf http://localhost:${PORT}`);
});
