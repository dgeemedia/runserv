#!/usr/bin/env node
/**
 * generate-secrets.js
 *
 * Generates cryptographically secure random values for the secrets
 * your app controls (JWT signing secrets, cron shared secret).
 *
 * It CANNOT generate the third-party keys (Brevo, Paystack, Flutterwave) —
 * those are issued by those services' dashboards and must be copied in
 * manually. It also skips DATABASE_URL / WEB_APP_URL / API_URL since
 * those are environment-specific, not random secrets.
 *
 * Usage:
 *   node generate-secrets.js
 *   node generate-secrets.js --write .env      # write values into an env file in-place
 *   node generate-secrets.js --write .env --force  # overwrite even if already set
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// key -> [byteLength, encoding]
// 32 bytes -> 43-char base64url or 64-char hex; both are plenty strong for HMAC/JWT secrets.
const SECRETS_TO_GENERATE = {
  JWT_SECRET: [32, "base64url"],
  ADMIN_JWT_SECRET: [32, "base64url"],
  CRON_SECRET: [32, "hex"], // hex reads nicely when pasted into a header value
};

function generateValue(bytes, encoding) {
  const buf = crypto.randomBytes(bytes);
  if (encoding === "base64url") {
    return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  return buf.toString(encoding); // 'hex'
}

function generateAll() {
  const out = {};
  for (const [key, [bytes, encoding]] of Object.entries(SECRETS_TO_GENERATE)) {
    out[key] = generateValue(bytes, encoding);
  }
  return out;
}

function printOnly(values) {
  console.log("\nGenerated secrets (copy these into your .env):\n");
  for (const [key, value] of Object.entries(values)) {
    console.log(`${key}="${value}"`);
  }
  console.log(
    "\nNote: BREVO_*, PAYSTACK_*, FLUTTERWAVE_*, ADMIN_EMAIL, ADMIN_PASSWORD, and DATABASE_URL " +
      "are NOT generated — get those from their respective dashboards / your own config."
  );
}

function writeToEnvFile(filePath, values, force) {
  const resolved = path.resolve(process.cwd(), filePath);
  let content = fs.existsSync(resolved) ? fs.readFileSync(resolved, "utf8") : "";

  for (const [key, value] of Object.entries(values)) {
    const lineRegex = new RegExp(`^${key}=.*$`, "m");
    const existingMatch = content.match(lineRegex);
    const alreadySet = existingMatch && /=("?).+\1$/.test(existingMatch[0]) && !/=""$/.test(existingMatch[0]) && existingMatch[0] !== `${key}=`;

    if (existingMatch) {
      if (alreadySet && !force) {
        console.log(`Skipping ${key} (already has a value; use --force to overwrite)`);
        continue;
      }
      content = content.replace(lineRegex, `${key}="${value}"`);
      console.log(`Set ${key}`);
    } else {
      content += `\n${key}="${value}"\n`;
      console.log(`Added ${key}`);
    }
  }

  fs.writeFileSync(resolved, content);
  console.log(`\nWrote secrets into ${resolved}`);
}

function main() {
  const args = process.argv.slice(2);
  const writeIdx = args.indexOf("--write");
  const force = args.includes("--force");

  const values = generateAll();

  if (writeIdx !== -1) {
    const filePath = args[writeIdx + 1];
    if (!filePath) {
      console.error("Usage: node generate-secrets.js --write <path-to-env-file> [--force]");
      process.exit(1);
    }
    writeToEnvFile(filePath, values, force);
  } else {
    printOnly(values);
  }
}

main();