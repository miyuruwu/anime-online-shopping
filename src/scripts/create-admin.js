const readline = require("node:readline");
const { getDb } = require("../db/db");
const {
  normalizeEmail,
  normalizeName,
  isValidEmail,
  hashPassword
} = require("../lib/auth");

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--email") out.email = argv[++i];
    else if (a === "--name") out.name = argv[++i];
    else if (a === "--password") out.password = argv[++i];
  }
  return out;
}

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const emailRaw = args.email || process.env.ADMIN_EMAIL;
  const nameRaw = args.name || process.env.ADMIN_NAME;
  const passwordRaw = args.password || process.env.ADMIN_PASSWORD;

  const email = normalizeEmail(
    emailRaw || (await ask("Admin email: "))
  );
  const displayName = normalizeName(
    nameRaw || (await ask("Display name: "))
  );
  const password = String(
    passwordRaw || (await ask("Password (8–72 chars): "))
  );

  if (!email || !displayName || !password) {
    console.error("Missing required fields.");
    process.exit(1);
  }
  if (!isValidEmail(email)) {
    console.error("Invalid email.");
    process.exit(1);
  }

  let passwordHash;
  try {
    passwordHash = await hashPassword(password);
  } catch (e) {
    console.error(e?.message || "Invalid password.");
    process.exit(1);
  }

  const db = getDb();

  const exists = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (exists) {
    console.error("A user with that email already exists.");
    process.exit(1);
  }

  const result = db
    .prepare(
      `INSERT INTO users (email, display_name, password_hash, role)
       VALUES (?, ?, ?, 'admin')`
    )
    .run(email, displayName, passwordHash);

  console.log(`Created admin user #${result.lastInsertRowid}: ${email}`);
}

main().catch((e) => {
  console.error("Failed to create admin.", e);
  process.exit(1);
});

