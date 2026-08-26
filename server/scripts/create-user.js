const bcrypt = require("bcryptjs");
const db = require("../db");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const [name, email, verein, password, roleArg] = process.argv.slice(2);

if (!name || !email || !verein || !password) {
  console.error(
    "Verwendung: node server/scripts/create-user.js <name> <email> <verein> <passwort> [admin]"
  );
  process.exit(1);
}

if (!EMAIL_RE.test(email)) {
  console.error("Ungültige E-Mail-Adresse.");
  process.exit(1);
}

if (password.length < 8) {
  console.error("Das Passwort muss mindestens 8 Zeichen haben.");
  process.exit(1);
}

const role = roleArg === "admin" ? "admin" : "member";

const existing = db
  .prepare("SELECT id FROM users WHERE email = ?")
  .get(email.toLowerCase().trim());
if (existing) {
  console.error(`Für ${email} existiert bereits ein Konto.`);
  process.exit(1);
}

const passwordHash = bcrypt.hashSync(password, 10);
db.prepare(
  "INSERT INTO users (name, email, password_hash, verein, role) VALUES (?, ?, ?, ?, ?)"
).run(name.trim(), email.toLowerCase().trim(), passwordHash, verein.trim(), role);

console.log(`OK: Konto für ${name} (${email}) wurde erstellt${role === "admin" ? " als Admin" : ""}.`);
