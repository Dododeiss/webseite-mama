const db = require("../db");

const email = process.argv[2];

if (!email) {
  console.error("Verwendung: node server/scripts/make-admin.js <email>");
  process.exit(1);
}

const info = db
  .prepare("UPDATE users SET role = 'admin' WHERE email = ?")
  .run(email.toLowerCase().trim());

if (info.changes) {
  console.log(`OK: ${email} ist jetzt Admin.`);
} else {
  console.error(`Kein Konto mit der E-Mail ${email} gefunden.`);
  process.exit(1);
}
