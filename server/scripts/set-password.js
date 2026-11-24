const bcrypt = require("bcryptjs");
const db = require("../db");

const email = process.argv[2];
const newPassword = process.argv[3];

if (!email || !newPassword) {
  console.error("Verwendung: node server/scripts/set-password.js <email> <neues-passwort>");
  process.exit(1);
}

if (newPassword.length < 8) {
  console.error("Das Passwort muss mindestens 8 Zeichen haben.");
  process.exit(1);
}

const passwordHash = bcrypt.hashSync(newPassword, 10);
const info = db
  .prepare("UPDATE users SET password_hash = ? WHERE email = ?")
  .run(passwordHash, email.toLowerCase().trim());

if (info.changes) {
  console.log(`OK: Passwort für ${email} wurde gesetzt.`);
} else {
  console.error(`Kein Konto mit der E-Mail ${email} gefunden.`);
  process.exit(1);
}
