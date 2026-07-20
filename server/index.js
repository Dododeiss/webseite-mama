const path = require("path");
const crypto = require("crypto");
const express = require("express");
const session = require("express-session");

const authRoutes = require("./routes/auth");
const resultsRoutes = require("./routes/results");
const eventsRoutes = require("./routes/events");

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

// Static site (the existing plain HTML/CSS/JS prototype) lives at the repo root.
app.use(express.static(path.join(__dirname, "..")));

app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, "..", "index.html"));
});

app.listen(PORT, () => {
  console.log(`BSVZ-Webseite läuft auf http://localhost:${PORT}`);
});
